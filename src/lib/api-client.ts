import type { Extraction, Usage } from './extraction';
import type { Settings } from './settings';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Needs a human (wrong access code, no key): the queue pauses instead of burning retries. */
export function needsSetup(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || e.status === 403 || e.code === 'not_configured');
}

function headers(s: Pick<Settings, 'byoKey' | 'accessCode' | 'extractModel' | 'sttModel'>, model: string): Record<string, string> {
  const h: Record<string, string> = {};
  if (s.byoKey) h['x-openrouter-key'] = s.byoKey;
  if (s.accessCode) h['x-sortie-code'] = s.accessCode;
  if (model) h['x-sortie-model'] = model;
  return h;
}

async function post<T>(url: string, body: FormData, h: Record<string, string>, fetchImpl: typeof fetch): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(url, { method: 'POST', body, headers: h });
  } catch (e) {
    // fetch rejects on network failure: always worth retrying.
    throw new ApiError(e instanceof Error ? e.message : 'Network error', 0, 'network', true);
  }
  if (res.ok) return (await res.json()) as T;
  let payload: { error?: string; code?: string; retryable?: boolean } = {};
  try {
    payload = await res.json();
  } catch {
    /* non-JSON error page from a proxy */
  }
  const retryable = payload.retryable ?? (res.status === 408 || res.status === 429 || res.status >= 500);
  throw new ApiError(payload.error ?? `Request failed (${res.status})`, res.status, payload.code ?? 'http', retryable);
}

export interface ExtractResponse {
  contact: Extraction;
  usage: Usage;
}
export interface TranscribeResponse {
  text: string;
  usage: Usage;
}

export function callExtract(image: Blob, settings: Settings, fetchImpl: typeof fetch = fetch): Promise<ExtractResponse> {
  const fd = new FormData();
  fd.append('image', image, 'capture.jpg');
  return post<ExtractResponse>('/api/extract', fd, headers(settings, settings.extractModel), fetchImpl);
}

export function callTranscribe(audio: Blob, mime: string, settings: Settings, fetchImpl: typeof fetch = fetch): Promise<TranscribeResponse> {
  const fd = new FormData();
  fd.append('audio', new File([audio], `note.${audioExt(mime)}`, { type: mime }));
  return post<TranscribeResponse>('/api/transcribe', fd, headers(settings, settings.sttModel), fetchImpl);
}

export function audioExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a';
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  return 'm4a';
}
