'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { TabBar } from './TabBar';
import { ToastHost } from './Toast';
import { getQueue, kickQueue } from '@/lib/runtime';

/** Registers the service worker, asks for durable storage, and keeps the offline queue draining. */
export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('[sortie] sw', e));
    }
    // Ask the browser not to evict our IndexedDB when space is tight.
    navigator.storage?.persist?.().catch(() => {});

    const onOnline = () => {
      getQueue()
        .onReconnect()
        .then(kickQueue)
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') kickQueue();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    kickQueue();
    // Backoff timers elapse with no event to announce them, so poll gently.
    const tick = window.setInterval(kickQueue, 15_000);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(tick);
    };
  }, []);

  return (
    <>
      {children}
      <TabBar />
      <ToastHost />
    </>
  );
}
