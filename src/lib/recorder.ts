/** MediaRecorder wrapper. iOS Safari records AAC in MP4; Chrome and Android record Opus in WebM. */

const CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

export function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  return CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export interface Recording {
  blob: Blob;
  mime: string;
  seconds: number;
}

export interface ActiveRecorder {
  stop(): Promise<Recording>;
  cancel(): void;
}

export async function startRecording(): Promise<ActiveRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mimeType = pickMime();
  const rec = mimeType ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  const started = Date.now();
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const release = () => stream.getTracks().forEach((t) => t.stop());
  rec.start(1000);
  return {
    stop: () =>
      new Promise<Recording>((resolve, reject) => {
        rec.onstop = () => {
          release();
          const mime = rec.mimeType || mimeType || 'audio/mp4';
          const blob = new Blob(chunks, { type: mime });
          if (blob.size > 0) resolve({ blob, mime, seconds: Math.max(1, Math.round((Date.now() - started) / 1000)) });
          else reject(new Error('Nothing was recorded'));
        };
        if (rec.state !== 'inactive') rec.stop();
        else rec.onstop?.(new Event('stop'));
      }),
    cancel: () => {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
      release();
    },
  };
}

type SpeechCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};

export function speechRecognitionCtor(): SpeechCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
