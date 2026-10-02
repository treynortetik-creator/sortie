import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ExtractResponse, type TranscribeResponse } from './api-client';
import { DEFAULT_SETTINGS } from './settings';
import { SortieDB } from './db';
import { attachVoiceNote, createEvent, createLeadFromPhoto, editField, deleteLeads } from './leads';
import { MAX_ATTEMPTS, STALE_RUNNING_MS, backoffMs, createQueue, type QueueDeps } from './queue';

let db: SortieDB;
let clock: number;
let online: boolean;
const extractOk = (over: Partial<ExtractResponse['contact']> = {}): ExtractResponse => ({
  contact: { firstName: 'Priya', lastName: 'Raghunathan', title: 'Director', company: 'Northwind', email: 'p@n.example', phone: '', website: '', notes: '', confidence: 0.9, ...over },
  usage: { model: 'm/x', promptTokens: 1000, completionTokens: 50, costUsd: 0.0005 },
});
const sttOk = (text = 'call her back'): TranscribeResponse => ({ text, usage: { model: 'm/stt', promptTokens: 0, completionTokens: 0, costUsd: 0.00004 } });
const img = () => new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
const aud = () => new Blob(['m4a-bytes'], { type: 'audio/mp4' });

function setup(extract: QueueDeps['extract'] = vi.fn(async () => extractOk()), transcribe = vi.fn(async () => sttOk())) {
  const q = createQueue({ db, extract, transcribe, getSettings: () => DEFAULT_SETTINGS, isOnline: () => online, now: () => clock });
  return { q, extract, transcribe };
}

beforeEach(async () => {
  db = new SortieDB(`test-${Math.random()}`);
  clock = 1_000_000;
  online = true;
});

async function oneLead() {
  const ev = await createEvent(db, 'FieldCon');
  return createLeadFromPhoto(db, ev.id, img(), clock);
}

describe('offline queue', () => {
  it('saves a capture instantly as queued, with the photo stored locally', async () => {
    const lead = await oneLead();
    const row = await db.leads.get(lead.id);
    expect(row?.extract.status).toBe('queued');
    expect(row?.image).toBeDefined();
  });

  it('does not call the API while offline, then drains when back online', async () => {
    const lead = await oneLead();
    const { q, extract } = setup();
    online = false;
    await q.run();
    expect(extract).not.toHaveBeenCalled();
    expect((await db.leads.get(lead.id))?.extract.status).toBe('queued');

    online = true;
    await q.run();
    expect(extract).toHaveBeenCalledTimes(1);
    const row = await db.leads.get(lead.id);
    expect(row?.extract.status).toBe('done');
    expect(row?.firstName).toBe('Priya');
    expect(row?.company).toBe('Northwind');
  });

  it('transcribes voice notes and records cost for both steps', async () => {
    const lead = await oneLead();
    await attachVoiceNote(db, lead.id, aud(), 'audio/mp4', 12);
    const { q } = setup();
    await q.run();
    const row = await db.leads.get(lead.id);
    expect(row?.transcript).toBe('call her back');
    expect(row?.voice.status).toBe('done');
    expect(row?.costs.map((c) => c.kind).sort()).toEqual(['extract', 'transcribe']);
    expect(row?.costUsd).toBeCloseTo(0.00054, 8);
  });

  it('never overwrites a field the rep edited by hand', async () => {
    const lead = await oneLead();
    await editField(db, lead.id, 'company', 'My Own Company');
    await editField(db, lead.id, 'title', '');
    const { q } = setup();
    await q.run();
    const row = await db.leads.get(lead.id);
    expect(row?.company).toBe('My Own Company');
    expect(row?.title).toBe('');
    expect(row?.firstName).toBe('Priya');
  });

  it('does not extract twice for a lead that is already done (idempotent)', async () => {
    await oneLead();
    const { q, extract } = setup();
    await q.run();
    await q.run();
    await q.run();
    expect(extract).toHaveBeenCalledTimes(1);
  });

  it('shares one run across concurrent calls and never double-claims a job', async () => {
    await oneLead();
    await oneLead();
    let resolve!: () => void;
    const gate = new Promise<void>((r) => (resolve = r));
    const extract = vi.fn(async () => {
      await gate;
      return extractOk();
    });
    const { q } = setup(extract);
    const runs = [q.run(), q.run(), q.run()];
    await new Promise((r) => setTimeout(r, 20));
    resolve();
    await Promise.all(runs);
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it('retries transient failures with exponential backoff, then succeeds', async () => {
    const lead = await oneLead();
    const extract = vi
      .fn<() => Promise<ExtractResponse>>()
      .mockRejectedValueOnce(new ApiError('Network error', 0, 'network', true))
      .mockRejectedValueOnce(new ApiError('busy', 429, 'upstream_rate_limited', true))
      .mockResolvedValue(extractOk());
    const { q } = setup(extract);

    await q.run();
    let row = await db.leads.get(lead.id);
    expect(row?.extract.status).toBe('queued');
    expect(row?.extract.attempts).toBe(1);
    expect(row?.extract.nextAt).toBe(clock + backoffMs(1));

    await q.run(); // too early: backoff not elapsed
    expect(extract).toHaveBeenCalledTimes(1);

    clock += backoffMs(1);
    await q.run();
    row = await db.leads.get(lead.id);
    expect(row?.extract.attempts).toBe(2);
    expect(row?.extract.nextAt).toBe(clock + backoffMs(2));

    clock += backoffMs(2);
    await q.run();
    row = await db.leads.get(lead.id);
    expect(row?.extract.status).toBe('done');
    expect(extract).toHaveBeenCalledTimes(3);
  });

  it('gives up after MAX_ATTEMPTS and shows an error the rep can retry', async () => {
    const lead = await oneLead();
    const extract = vi.fn(async (): Promise<ExtractResponse> => {
      throw new ApiError('down', 503, 'upstream_error', true);
    });
    const { q } = setup(extract);
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await q.run();
      clock += 10 * 60_000;
    }
    const row = await db.leads.get(lead.id);
    expect(row?.extract.status).toBe('error');
    expect(row?.extract.transient).toBe(true);
    expect(extract).toHaveBeenCalledTimes(MAX_ATTEMPTS);

    extract.mockResolvedValue(extractOk());
    await q.retry(lead.id);
    await q.run();
    expect((await db.leads.get(lead.id))?.extract.status).toBe('done');
  });

  it('marks permanent errors (bad image) as error without retrying', async () => {
    const lead = await oneLead();
    const extract = vi.fn(async (): Promise<ExtractResponse> => {
      throw new ApiError('not an image', 415, 'not_an_image', false);
    });
    const { q } = setup(extract);
    await q.run();
    clock += 60 * 60_000;
    await q.run();
    expect(extract).toHaveBeenCalledTimes(1);
    const row = await db.leads.get(lead.id);
    expect(row?.extract.status).toBe('error');
    expect(row?.extract.transient).toBe(false);
  });

  it('pauses (blocked) on a bad key or access code and resumes after settings change', async () => {
    const lead = await oneLead();
    const extract = vi
      .fn<() => Promise<ExtractResponse>>()
      .mockRejectedValueOnce(new ApiError('Wrong or missing access code', 401, 'bad_code', false))
      .mockResolvedValue(extractOk());
    const { q } = setup(extract);
    await q.run();
    expect((await db.leads.get(lead.id))?.extract.status).toBe('blocked');
    await q.run();
    expect(extract).toHaveBeenCalledTimes(1);

    await q.onSettingsChanged();
    await q.run();
    expect((await db.leads.get(lead.id))?.extract.status).toBe('done');
  });

  it('onReconnect gives transient failures a fresh start immediately', async () => {
    const lead = await oneLead();
    const extract = vi
      .fn<() => Promise<ExtractResponse>>()
      .mockRejectedValueOnce(new ApiError('Network error', 0, 'network', true))
      .mockResolvedValue(extractOk());
    const { q } = setup(extract);
    await q.run();
    expect((await db.leads.get(lead.id))?.extract.nextAt).toBeGreaterThan(clock);
    await q.onReconnect();
    await q.run();
    expect((await db.leads.get(lead.id))?.extract.status).toBe('done');
  });

  it('recovers a job stuck in "running" after a crash', async () => {
    const lead = await oneLead();
    await db.leads.update(lead.id, { extract: { status: 'running', attempts: 0, nextAt: 0, startedAt: clock } });
    const { q, extract } = setup();
    await q.run();
    expect(extract).not.toHaveBeenCalled(); // still plausibly in flight
    clock += STALE_RUNNING_MS + 1;
    await q.run();
    expect(extract).toHaveBeenCalledTimes(1);
    expect((await db.leads.get(lead.id))?.extract.status).toBe('done');
  });

  it('survives a lead being deleted while its request is in flight', async () => {
    const lead = await oneLead();
    const extract = vi.fn(async () => {
      await deleteLeads(db, [lead.id]);
      return extractOk();
    });
    const { q } = setup(extract);
    await q.run();
    expect(await db.leads.get(lead.id)).toBeUndefined();
  });

  it('starts leads oldest first', async () => {
    const ev = await createEvent(db, 'E');
    await createLeadFromPhoto(db, ev.id, new Blob(['second'], { type: 'image/jpeg' }), 200);
    await createLeadFromPhoto(db, ev.id, new Blob(['first'], { type: 'image/jpeg' }), 100);
    const order: string[] = [];
    const extract = vi.fn(async (blob: Blob) => {
      order.push(await blob.text());
      return extractOk();
    });
    const { q } = setup(extract);
    await q.run();
    expect(order).toEqual(['first', 'second']);
  });
});

describe('backoffMs', () => {
  it('doubles and caps', () => {
    expect(backoffMs(1)).toBe(2000);
    expect(backoffMs(2)).toBe(4000);
    expect(backoffMs(3)).toBe(8000);
    expect(backoffMs(20)).toBe(120_000);
  });
});
