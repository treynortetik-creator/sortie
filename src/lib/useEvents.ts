'use client';

import { useCallback } from 'react';
import type { EventRecord } from './db';
import { createEvent } from './leads';
import { db, useLive, useSettings } from './runtime';

export interface ActiveEvent {
  loading: boolean;
  events: EventRecord[];
  event: EventRecord | null;
  setActive: (id: string) => void;
  create: (name: string) => Promise<EventRecord>;
}

/** The event the rep is working: remembered per device, defaulting to the newest. */
export function useActiveEvent(): ActiveEvent {
  const [settings, update] = useSettings();
  const events = useLive(() => db().events.orderBy('createdAt').reverse().toArray(), []);
  const event = events ? (events.find((e) => e.id === settings.activeEventId) ?? events[0] ?? null) : null;
  const setActive = useCallback((id: string) => update({ activeEventId: id }), [update]);
  const create = useCallback(
    async (name: string) => {
      const ev = await createEvent(db(), name);
      update({ activeEventId: ev.id });
      return ev;
    },
    [update],
  );
  return { loading: events === undefined, events: events ?? [], event, setActive, create };
}
