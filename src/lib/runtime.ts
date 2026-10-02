'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { liveQuery } from 'dexie';
import { callExtract, callTranscribe } from './api-client';
import { getDb, type SortieDB } from './db';
import { createQueue, type Queue } from './queue';
import { loadSettings, saveSettings, subscribeSettings, DEFAULT_SETTINGS, type Settings } from './settings';

export function db(): SortieDB {
  return getDb();
}

let queue: Queue | null = null;
export function getQueue(): Queue {
  if (!queue) {
    queue = createQueue({
      db: getDb(),
      extract: (image, settings) => callExtract(image, settings),
      transcribe: (audio, mime, settings) => callTranscribe(audio, mime, settings),
      getSettings: loadSettings,
      isOnline: () => (typeof navigator === 'undefined' ? false : navigator.onLine),
    });
  }
  return queue;
}

/** Fire-and-forget: kick the queue and never throw into UI code. */
export function kickQueue(): void {
  getQueue().run().catch((e) => console.error('[sortie] queue', e));
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useSyncExternalStore(subscribeSettings, loadSettings, () => DEFAULT_SETTINGS);
  const update = useCallback((patch: Partial<Settings>) => {
    saveSettings(patch);
  }, []);
  return [settings, update];
}

/** Subscribe to a Dexie query. `undefined` means "still loading". */
export function useLive<T>(querier: () => Promise<T> | T, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const q = useRef(querier);
  useEffect(() => {
    q.current = querier;
  });
  useEffect(() => {
    const sub = liveQuery(() => q.current()).subscribe({
      next: setValue,
      error: (e) => console.error('[sortie] liveQuery', e),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** An object URL for a Blob that is revoked when the blob changes or the component unmounts. */
export function useBlobUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u); // eslint-disable-line react-hooks/set-state-in-effect -- object URLs need a revoke on cleanup, so they live in an effect
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return blob ? url : undefined;
}

export interface ServerStatus {
  serverKey: boolean;
  needsCode: boolean;
  extractModel: string;
  sttModel: string;
}

/** What this deployment offers. null while loading or when offline. */
export function useServerStatus(): ServerStatus | null {
  const [s, setS] = useState<ServerStatus | null>(null);
  const online = useOnline();
  useEffect(() => {
    if (!online) return;
    fetch('/api/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setS(j as ServerStatus))
      .catch(() => {});
  }, [online]);
  return s;
}

export function haptic(ms = 25): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    /* iOS Safari has no vibrate: silently fine */
  }
}

export function formatUsd(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
