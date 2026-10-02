/** Per-device settings in localStorage. Nothing here ever leaves the device except when sent with an API request. */

export interface Settings {
  /** Bring-your-own OpenRouter key. Sent as a header, never stored server-side. */
  byoKey: string;
  /** Shared access code, if the deployment sets SORTIE_ACCESS_CODE. */
  accessCode: string;
  /** Optional model overrides (BYO key only unless the server allows it). */
  extractModel: string;
  sttModel: string;
  /** Voice notes: transcribe on the server, or on-device with the browser's speech recognition (experimental). */
  speech: 'server' | 'device';
  csvFormat: 'salesforce' | 'hubspot' | 'generic';
  csvBom: boolean;
  leadSource: string;
  activeEventId: string;
}

export const DEFAULT_SETTINGS: Settings = {
  byoKey: '',
  accessCode: '',
  extractModel: '',
  sttModel: '',
  speech: 'server',
  csvFormat: 'salesforce',
  csvBom: false,
  leadSource: 'Event',
  activeEventId: '',
};

const KEY = 'sortie.settings.v1';
const listeners = new Set<() => void>();
let cache: Settings | null = null;

export function loadSettings(): Settings {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    cache = { ...DEFAULT_SETTINGS, ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) };
  } catch {
    cache = { ...DEFAULT_SETTINGS };
  }
  return cache;
}

export function saveSettings(patch: Partial<Settings>): Settings {
  cache = { ...loadSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode or quota: keep the in-memory copy */
  }
  listeners.forEach((l) => l());
  return cache;
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}
