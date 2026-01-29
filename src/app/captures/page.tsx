'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db, type LocalCapture } from '@/lib/db';
import { syncCapture } from '@/lib/sync';
import CaptureCard from '@/components/CaptureCard';
import BottomNav from '@/components/BottomNav';

export default function CapturesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [captures, setCaptures] = useState<LocalCapture[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [filterEvent, setFilterEvent] = useState('all');
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  const loadCaptures = useCallback(async () => {
    if (!user) return;

    let results: LocalCapture[];
    if (filterEvent === 'all') {
      results = await db.captures
        .where({ userId: user.id })
        .reverse()
        .sortBy('createdAt');
    } else {
      results = await db.captures
        .where({ userId: user.id, event: filterEvent })
        .reverse()
        .sortBy('createdAt');
    }

    setCaptures(results);

    const allCaptures = await db.captures
      .where({ userId: user.id })
      .toArray();
    const uniqueEvents = [...new Set(allCaptures.map((c) => c.event))];
    setEvents(uniqueEvents);
    setLoading(false);
  }, [user, filterEvent]);

  useEffect(() => {
    loadCaptures(); // eslint-disable-line react-hooks/set-state-in-effect -- loading data from IndexedDB
  }, [loadCaptures]);

  const handleProcessAll = async () => {
    setProcessing(true);
    const unsynced = captures.filter((c) => c.status === 'captured');
    for (const cap of unsynced) {
      if (cap.id) {
        try {
          await syncCapture(cap.id);
        } catch (err) {
          console.error(`Failed to sync capture ${cap.id}:`, err);
        }
      }
    }
    await loadCaptures();
    setProcessing(false);
  };

  const hasUnsynced = captures.some((c) => c.status === 'captured');

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1f16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#3d4a2a] border-t-[#8b956d] rounded-full animate-spin" />
          <p className="text-[#8b956d] text-sm">Loading captures…</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1f16]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#1a1f16] border-b border-[#3d4a2a] px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-[#c8d5a3] tracking-wide">
            All Captures
          </h1>
          <span className="text-[#8b956d] text-sm">
            {captures.length} total
          </span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            aria-label="Filter by event"
            className="flex-1 bg-[#2d331f] border border-[#3d4a2a] rounded px-3 py-2 text-[#c8d5a3] text-sm focus:outline-none focus:border-[#4a5d23]"
          >
            <option value="all">All Events</option>
            {events.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>

          {hasUnsynced && (
            <button
              onClick={handleProcessAll}
              disabled={processing}
              className="bg-[#e8c547]/20 text-[#e8c547] text-xs uppercase tracking-wider font-semibold px-4 py-2 rounded hover:bg-[#e8c547]/30 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {processing ? 'Processing...' : 'Process All'}
            </button>
          )}
        </div>
      </div>

      {/* Capture List */}
      <div className="px-4 py-4 space-y-3 pb-20">
        {captures.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#8b956d] text-lg mb-2">No captures yet</p>
            <p className="text-[#8b956d]/60 text-sm">
              Start capturing leads from the capture screen
            </p>
          </div>
        ) : (
          captures.map((cap) => (
            <CaptureCard key={cap.id} capture={cap} />
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
