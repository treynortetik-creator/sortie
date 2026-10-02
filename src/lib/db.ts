import Dexie, { type EntityTable } from 'dexie';
import { emptyContact, type Contact, type Rating } from './contact';

export type StepStatus = 'none' | 'queued' | 'running' | 'done' | 'error' | 'blocked';

/** One unit of background work for a lead: reading the photo, or transcribing the voice note. */
export interface Step {
  status: StepStatus;
  attempts: number;
  /** Earliest time (ms) the queue may try again. */
  nextAt: number;
  startedAt?: number;
  error?: string;
  /** True if the failure was network or server trouble that should heal on its own. */
  transient?: boolean;
}

export interface CostEntry {
  kind: 'extract' | 'transcribe';
  model: string;
  costUsd: number | null;
  promptTokens: number;
  completionTokens: number;
  at: number;
}

export interface EventRecord {
  id: string;
  name: string;
  createdAt: number;
}

export interface LeadRecord extends Contact {
  id: string;
  eventId: string;
  createdAt: number;
  updatedAt: number;
  rating: Rating;
  transcript: string;
  /** Field names the rep edited by hand. Extraction never overwrites these. */
  touched: string[];
  image?: Blob;
  audio?: Blob;
  audioMime?: string;
  audioSeconds?: number;
  extract: Step;
  voice: Step;
  confidence: number | null;
  /** Sum of OpenRouter charges for this lead, USD. */
  costUsd: number;
  costs: CostEntry[];
  notDuplicateOf: string[];
}

export class SortieDB extends Dexie {
  events!: EntityTable<EventRecord, 'id'>;
  leads!: EntityTable<LeadRecord, 'id'>;

  constructor(name = 'sortie-v2') {
    super(name);
    this.version(1).stores({
      events: 'id, createdAt',
      leads: 'id, eventId, createdAt, [eventId+createdAt]',
    });
  }
}

let singleton: SortieDB | null = null;
/** The app database. Lazily created so server-side rendering never touches IndexedDB. */
export function getDb(): SortieDB {
  if (!singleton) singleton = new SortieDB();
  return singleton;
}

export const idleStep = (): Step => ({ status: 'none', attempts: 0, nextAt: 0 });
export const queuedStep = (): Step => ({ status: 'queued', attempts: 0, nextAt: 0 });

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function blankLead(eventId: string, now = Date.now()): LeadRecord {
  return {
    ...emptyContact(),
    id: newId(),
    eventId,
    createdAt: now,
    updatedAt: now,
    rating: '',
    transcript: '',
    touched: [],
    extract: idleStep(),
    voice: idleStep(),
    confidence: null,
    costUsd: 0,
    costs: [],
    notDuplicateOf: [],
  };
}

/** True while any background step still has work to do or needs attention. */
export function isPending(l: LeadRecord): boolean {
  const open = (s: Step) => s.status === 'queued' || s.status === 'running';
  return open(l.extract) || open(l.voice);
}

export function needsAttention(l: LeadRecord): boolean {
  const bad = (s: Step) => s.status === 'error' || s.status === 'blocked';
  return bad(l.extract) || bad(l.voice);
}
