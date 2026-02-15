import Dexie, { type EntityTable } from 'dexie';

export type CaptureStatus = 'captured' | 'processing' | 'ready' | 'needs_review' | 'error';

export interface LocalCapture {
  id?: number;
  remoteId?: string;
  userId: string;
  event: string;
  imageBlob: Blob;
  photoUrl?: string;
  audioBlob?: Blob;
  audioUrl?: string;
  audioDuration?: number;
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  notes?: string;
  audioTranscription?: string;
  transcriptionSource?: 'web_speech' | 'whisper';
  sfMatchStatus?: string;
  sfAccountId?: string;
  sfContactId?: string;
  clayData?: Record<string, unknown>;
  emailDraft?: string;
  status: CaptureStatus;
  processingError?: string;
  createdAt: string;
  updatedAt?: string;
  syncedAt?: string;
}

export interface LocalEvent {
  id?: number;
  remoteId?: string;
  userId: string;
  name: string;
  date?: string;
  location?: string;
  lastUsed?: string;
  createdAt?: string;
}

export interface LocalSetting {
  key: string;
  value: string;
}

export interface LocalProfile {
  id?: number;
  userId: string;
  displayName?: string;
  defaultEvent?: string;
  settings?: Record<string, unknown>;
}

class SortieDB extends Dexie {
  captures!: EntityTable<LocalCapture, 'id'>;
  events!: EntityTable<LocalEvent, 'id'>;
  profiles!: EntityTable<LocalProfile, 'id'>;
  settings!: EntityTable<LocalSetting, 'key'>;

  constructor() {
    super('sortie');
    this.version(1).stores({
      captures: '++id, remoteId, userId, event, status, createdAt, syncedAt',
      events: '++id, remoteId, userId, name, date, lastUsed',
      profiles: '++id, userId',
      settings: 'key',
    });

    // v2: Add updatedAt index for sync ordering.
    // No schema change needed — just adding the index.
    this.version(2).stores({
      captures: '++id, remoteId, userId, event, status, createdAt, syncedAt, updatedAt',
      events: '++id, remoteId, userId, name, date, lastUsed',
      profiles: '++id, userId',
      settings: 'key',
    });
  }
}

export const db = new SortieDB();
