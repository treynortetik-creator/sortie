'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { db } from '@/lib/db';

export default function EventSelectPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { eventHistory, setCurrentEvent } = useEvent();
  const [eventName, setEventName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  const filteredEvents = useMemo(() => {
    if (eventName.trim()) {
      return eventHistory.filter((ev) =>
        ev.toLowerCase().includes(eventName.toLowerCase())
      );
    }
    return eventHistory;
  }, [eventName, eventHistory]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBeginMission = async () => {
    const trimmed = eventName.trim();
    if (!trimmed || !user) return;

    setCurrentEvent(trimmed);

    try {
      await db.events.put({
        name: trimmed,
        userId: user.id,
        lastUsed: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to store event in db:', err);
    }

    router.push('/capture');
  };

  const selectEvent = (ev: string) => {
    setEventName(ev);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-olive-900 flex items-center justify-center">
        <p className="text-olive-muted">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-olive-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-olive-text mb-2">
            What event are you at today?
          </h1>
          <p className="text-olive-muted text-sm">
            Enter or select your current mission location
          </p>
        </div>

        <div className="bg-olive-800 border border-olive-700 rounded-lg p-8 space-y-6">
          <div className="relative">
            <label
              htmlFor="event-name"
              className="block text-olive-muted text-xs uppercase tracking-wider mb-2"
            >
              Event Name
            </label>
            <input
              ref={inputRef}
              id="event-name"
              type="text"
              aria-label="Event name"
              value={eventName}
              onChange={(e) => {
                setEventName(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full bg-olive-900 border border-olive-700 rounded px-4 py-3 text-olive-text placeholder-olive-muted/50 focus:outline-none focus:border-olive-600 focus:ring-1 focus:ring-olive-600 transition-colors"
              placeholder="e.g. CES 2026, AWS re:Invent"
              autoComplete="off"
              enterKeyHint="go"
            />

            {showDropdown && filteredEvents.length > 0 && (
              <div
                ref={dropdownRef}
                role="listbox"
                className="absolute z-10 mt-1 w-full bg-olive-800 border border-olive-700 rounded-lg shadow-xl max-h-48 overflow-y-auto"
              >
                {filteredEvents.map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    role="option"
                    aria-selected={eventName === ev}
                    onClick={() => selectEvent(ev)}
                    className="w-full text-left px-4 py-3.5 text-olive-text hover:bg-olive-600/30 transition-colors border-b border-olive-700 last:border-b-0"
                  >
                    {ev}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleBeginMission}
            disabled={!eventName.trim()}
            className="w-full bg-olive-600 hover:bg-olive-500 disabled:opacity-40 disabled:cursor-not-allowed text-olive-text font-semibold uppercase tracking-wider text-sm py-3.5 rounded transition-colors active:scale-[0.98]"
          >
            Begin Mission
          </button>
        </div>

        {eventHistory.length > 0 && (
          <div className="mt-6">
            <p className="text-olive-muted text-xs uppercase tracking-wider mb-3">
              Recent Missions
            </p>
            <div className="flex flex-wrap gap-2.5">
              {eventHistory.slice(0, 5).map((ev) => (
                <button
                  key={ev}
                  onClick={() => {
                    setEventName(ev);
                    setShowDropdown(false);
                  }}
                  className="bg-olive-800 border border-olive-700 text-olive-muted hover:text-olive-text hover:border-olive-600 text-sm px-4 py-2.5 rounded transition-colors active:scale-95"
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
