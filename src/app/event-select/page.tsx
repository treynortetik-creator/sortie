'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { db } from '@/lib/db';

export default function EventSelectPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { eventHistory, setCurrentEvent } = useEvent();
  const [eventName, setEventName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredEvents, setFilteredEvents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  useEffect(() => {
    if (eventName.trim()) {
      const filtered = eventHistory.filter((ev) =>
        ev.toLowerCase().includes(eventName.toLowerCase())
      );
      setFilteredEvents(filtered);
    } else {
      setFilteredEvents(eventHistory);
    }
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#1a1f16] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-[#c8d5a3] mb-2">
            What event are you at today?
          </h1>
          <p className="text-[#8b956d] text-sm">
            Enter or select your current mission location
          </p>
        </div>

        <div className="bg-[#2d331f] border border-[#3d4a2a] rounded-lg p-8 space-y-6">
          <div className="relative">
            <label
              htmlFor="event-name"
              className="block text-[#8b956d] text-xs uppercase tracking-wider mb-2"
            >
              Event Name
            </label>
            <input
              ref={inputRef}
              id="event-name"
              type="text"
              value={eventName}
              onChange={(e) => {
                setEventName(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full bg-[#1a1f16] border border-[#3d4a2a] rounded px-4 py-3 text-[#c8d5a3] placeholder-[#8b956d]/50 focus:outline-none focus:border-[#4a5d23] focus:ring-1 focus:ring-[#4a5d23] transition-colors"
              placeholder="e.g. CES 2026, AWS re:Invent"
              autoComplete="off"
            />

            {showDropdown && filteredEvents.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-10 mt-1 w-full bg-[#2d331f] border border-[#3d4a2a] rounded-lg shadow-xl max-h-48 overflow-y-auto"
              >
                {filteredEvents.map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => selectEvent(ev)}
                    className="w-full text-left px-4 py-3 text-[#c8d5a3] hover:bg-[#4a5d23]/30 transition-colors border-b border-[#3d4a2a] last:border-b-0"
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
            className="w-full bg-[#4a5d23] hover:bg-[#5a7028] disabled:opacity-40 disabled:cursor-not-allowed text-[#c8d5a3] font-semibold uppercase tracking-wider text-sm py-3 rounded transition-colors"
          >
            Begin Mission
          </button>
        </div>

        {eventHistory.length > 0 && (
          <div className="mt-6">
            <p className="text-[#8b956d] text-xs uppercase tracking-wider mb-3">
              Recent Missions
            </p>
            <div className="flex flex-wrap gap-2">
              {eventHistory.slice(0, 5).map((ev) => (
                <button
                  key={ev}
                  onClick={() => {
                    setEventName(ev);
                    setShowDropdown(false);
                  }}
                  className="bg-[#2d331f] border border-[#3d4a2a] text-[#8b956d] hover:text-[#c8d5a3] hover:border-[#4a5d23] text-sm px-3 py-1.5 rounded transition-colors"
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
