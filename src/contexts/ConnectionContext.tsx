'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { syncAllCaptures } from '@/lib/sync';

interface ConnectionContextValue {
  isOnline: boolean;
}

const ConnectionContext = createContext<ConnectionContextValue | undefined>(
  undefined
);

function getSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const isOnline = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }
    // Auto-sync unprocessed captures when coming back online
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      syncAllCaptures().catch((err) => {
        console.error('Auto-sync on reconnect failed:', err);
      });
    }
  }, [isOnline]);

  return (
    <ConnectionContext.Provider value={{ isOnline }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection(): ConnectionContextValue {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error(
      'useConnection must be used within a ConnectionProvider'
    );
  }
  return context;
}
