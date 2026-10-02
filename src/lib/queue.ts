import { FIELDS, type ContactField } from './contact';
import { ApiError, needsSetup, type ExtractResponse, type TranscribeResponse } from './api-client';
import type { CostEntry, LeadRecord, SortieDB, Step } from './db';
import type { Settings } from './settings';

/** After this many failed tries a step stops retrying on its own and waits for the rep. */
export const MAX_ATTEMPTS = 8;
/** A step stuck in "running" this long means the tab died mid-request. */
export const STALE_RUNNING_MS = 2 * 60_000;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_CAP_MS = 2 * 60_000;
const CONCURRENCY = 2;

export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
}

export interface QueueDeps {
  db: SortieDB;
  extract: (image: Blob, settings: Settings) => Promise<ExtractResponse>;
  transcribe: (audio: Blob, mime: string, settings: Settings) => Promise<TranscribeResponse>;
  getSettings: () => Settings;
  isOnline: () => boolean;
  now?: () => number;
}

type Kind = 'extract' | 'voice';
interface Job {
  id: string;
  kind: Kind;
}

/**
 * The offline queue. Captures are written to IndexedDB first; this drains the "extract" and "voice"
 * steps whenever there is signal. All state lives in the database, so a closed tab, a crash or a
 * dead connection never loses work. Safe to call run() as often as you like.
 */
export function createQueue(deps: QueueDeps) {
  const now = deps.now ?? Date.now;
  let running: Promise<void> | null = null;
  let again = false;

  async function recoverStale(): Promise<void> {
    const t = now();
    await deps.db.transaction('rw', deps.db.leads, async () => {
      await deps.db.leads.toCollection().modify((l) => {
        for (const kind of ['extract', 'voice'] as const) {
          const s = l[kind];
          if (s.status === 'running' && t - (s.startedAt ?? 0) > STALE_RUNNING_MS) {
            l[kind] = { ...s, status: 'queued', nextAt: 0 };
          }
        }
      });
    });
  }

  async function due(): Promise<Job[]> {
    const t = now();
    const leads = await deps.db.leads.orderBy('createdAt').toArray();
    const jobs: Job[] = [];
    for (const l of leads) {
      if (l.extract.status === 'queued' && l.extract.nextAt <= t && l.image) jobs.push({ id: l.id, kind: 'extract' });
      if (l.voice.status === 'queued' && l.voice.nextAt <= t && l.audio) jobs.push({ id: l.id, kind: 'voice' });
    }
    return jobs;
  }

  /** Atomically move queued -> running so two runners can never take the same job. */
  async function claim(job: Job): Promise<LeadRecord | null> {
    return deps.db.transaction('rw', deps.db.leads, async () => {
      const l = await deps.db.leads.get(job.id);
      if (!l || l[job.kind].status !== 'queued') return null;
      await deps.db.leads.update(job.id, { [job.kind]: { ...l[job.kind], status: 'running', startedAt: now() } } as Partial<LeadRecord>);
      return l;
    });
  }

  function costEntry(kind: CostEntry['kind'], u: ExtractResponse['usage']): CostEntry {
    return { kind, model: u.model, costUsd: u.costUsd, promptTokens: u.promptTokens, completionTokens: u.completionTokens, at: now() };
  }

  async function succeed(job: Job, res: ExtractResponse | TranscribeResponse): Promise<void> {
    await deps.db.transaction('rw', deps.db.leads, async () => {
      const l = await deps.db.leads.get(job.id);
      if (!l) return; // deleted while in flight
      const patch: Partial<LeadRecord> = {};
      const done: Step = { status: 'done', attempts: l[job.kind].attempts, nextAt: 0 };
      if (job.kind === 'extract') {
        const { contact, usage } = res as ExtractResponse;
        for (const f of FIELDS) {
          const field: ContactField = f;
          // Never overwrite what the rep typed; never blank what is already there.
          if (!l.touched.includes(field) && contact[field] && !l[field].trim()) patch[field] = contact[field];
        }
        patch.confidence = contact.confidence;
        patch.extract = done;
        patch.costs = [...l.costs, costEntry('extract', usage)];
        patch.costUsd = l.costUsd + (usage.costUsd ?? 0);
      } else {
        const { text, usage } = res as TranscribeResponse;
        if (!l.touched.includes('transcript')) patch.transcript = text.trim();
        patch.voice = done;
        patch.costs = [...l.costs, costEntry('transcribe', usage)];
        patch.costUsd = l.costUsd + (usage.costUsd ?? 0);
      }
      patch.updatedAt = now();
      await deps.db.leads.update(job.id, patch);
    });
  }

  async function fail(job: Job, err: unknown): Promise<void> {
    await deps.db.transaction('rw', deps.db.leads, async () => {
      const l = await deps.db.leads.get(job.id);
      if (!l) return;
      const prev = l[job.kind];
      const message = err instanceof Error ? err.message : 'Unknown error';
      let next: Step;
      if (needsSetup(err)) {
        // Wrong access code or no key: retrying cannot help. Pause until Settings change.
        next = { status: 'blocked', attempts: prev.attempts, nextAt: 0, error: message };
      } else if (err instanceof ApiError && !err.retryable) {
        next = { status: 'error', attempts: prev.attempts + 1, nextAt: 0, error: message, transient: false };
      } else {
        const attempts = prev.attempts + 1;
        next =
          attempts >= MAX_ATTEMPTS
            ? { status: 'error', attempts, nextAt: 0, error: message, transient: true }
            : { status: 'queued', attempts, nextAt: now() + backoffMs(attempts), error: message, transient: true };
      }
      await deps.db.leads.update(job.id, { [job.kind]: next, updatedAt: now() } as Partial<LeadRecord>);
    });
  }

  async function runJob(job: Job): Promise<void> {
    const lead = await claim(job);
    if (!lead) return;
    try {
      const settings = deps.getSettings();
      if (job.kind === 'extract') {
        if (!lead.image) throw new ApiError('Photo is missing', 400, 'no_image', false);
        await succeed(job, await deps.extract(lead.image, settings));
      } else {
        if (!lead.audio) throw new ApiError('Audio is missing', 400, 'no_audio', false);
        await succeed(job, await deps.transcribe(lead.audio, lead.audioMime ?? 'audio/mp4', settings));
      }
    } catch (e) {
      await fail(job, e);
    }
  }

  async function drain(): Promise<void> {
    do {
      again = false;
      await recoverStale();
      // Keep pulling due work until nothing is due. Failed jobs have a future nextAt, so this ends.
      for (;;) {
        if (!deps.isOnline()) return;
        const jobs = await due();
        if (jobs.length === 0) break;
        const pool = [...jobs];
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, pool.length) }, async () => {
            for (let job = pool.shift(); job; job = pool.shift()) await runJob(job);
          }),
        );
      }
    } while (again);
  }

  return {
    /** Drain everything that is due. Concurrent calls share one run. */
    run(): Promise<void> {
      if (running) {
        again = true;
        return running;
      }
      running = drain().finally(() => {
        running = null;
      });
      return running;
    },

    /** Manual "try again": revive failed and paused steps, optionally for a single lead. */
    async retry(id?: string): Promise<void> {
      await deps.db.transaction('rw', deps.db.leads, async () => {
        const revive = (s: Step, has: boolean): Step =>
          has && (s.status === 'error' || s.status === 'blocked') ? { status: 'queued', attempts: 0, nextAt: 0 } : s;
        await deps.db.leads
          .filter((l) => !id || l.id === id)
          .modify((l) => {
            l.extract = revive(l.extract, !!l.image);
            l.voice = revive(l.voice, !!l.audio);
          });
      });
    },

    /** Called when the connection returns: transient failures get a fresh start, paused ones stay paused. */
    async onReconnect(): Promise<void> {
      await deps.db.leads.toCollection().modify((l) => {
        for (const kind of ['extract', 'voice'] as const) {
          const s = l[kind];
          if ((s.status === 'error' && s.transient) || (s.status === 'queued' && s.nextAt > now())) {
            l[kind] = { status: 'queued', attempts: 0, nextAt: 0 };
          }
        }
      });
    },

    /** Called after Settings change (new key or code): un-pause blocked steps. */
    async onSettingsChanged(): Promise<void> {
      await deps.db.leads.toCollection().modify((l) => {
        for (const kind of ['extract', 'voice'] as const) {
          if (l[kind].status === 'blocked') l[kind] = { status: 'queued', attempts: 0, nextAt: 0 };
        }
      });
    },
  };
}

export type Queue = ReturnType<typeof createQueue>;
