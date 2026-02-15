'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { db } from '@/lib/db';

const LOCAL_STORAGE_KEY = 'sortie:currentEvent';

interface EventContextValue {
  currentEvent: string;
  setCurrentEvent: (eventId: string) => void;
  eventHistory: string[];
}

const EventContext = createContext<EventContextValue | undefined>(undefined);

export function EventProvider({ children }: { children: ReactNode }) {
  const [currentEvent, setCurrentEventState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(LOCAL_STORAGE_KEY) || '';
  });
  const [eventHistory, setEventHistory] = useState<string[]>([]);

  // Load event history from Dexie db
  useEffect(() => {
    async function loadHistory() {
      try {
        const events = await db.events.orderBy('lastUsed').reverse().toArray();
        const names = [...new Set(events.map((e) => e.name))];
        setEventHistory(names);
      } catch {
        // db may not be available yet; silently ignore
      }
    }
    loadHistory();
  }, []);

  const setCurrentEvent = useCallback((eventId: string) => {
    setCurrentEventState(eventId);
    localStorage.setItem(LOCAL_STORAGE_KEY, eventId);
  }, []);

  return (
    <EventContext.Provider
      value={{ currentEvent, setCurrentEvent, eventHistory }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvent(): EventContextValue {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}
