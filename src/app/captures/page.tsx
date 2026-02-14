'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db, type LocalCapture } from '@/lib/db';
import { syncCapture } from '@/lib/sync';
import Link from 'next/link';
import CaptureCard from '@/components/CaptureCard';
import BottomNav from '@/components/BottomNav';
import { useToast } from '@/components/Toast';

export default function CapturesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
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
    toast(`Processed ${unsynced.length} capture${unsynced.length === 1 ? '' : 's'}`, 'success');
  };

  const hasUnsynced = captures.some((c) => c.status === 'captured');

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-olive-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-olive-700 border-t-olive-muted rounded-full animate-spin" />
          <p className="text-olive-muted text-sm">Loading captures…</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-olive-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-olive-900 border-b border-olive-700 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-olive-text tracking-wide">
            All Captures
          </h1>
          <span className="text-olive-muted text-sm">
            {captures.length} total
          </span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            aria-label="Filter by event"
            className="flex-1 bg-olive-800 border border-olive-700 rounded-lg px-4 py-3 text-olive-text text-sm focus:outline-none focus:border-olive-600"
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
              aria-label="Process all unsynced captures"
              className="bg-gold/20 text-gold text-xs uppercase tracking-wider font-semibold px-4 py-3 rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap active:scale-95"
            >
              {processing ? 'Processing...' : 'Process All'}
            </button>
          )}
        </div>
      </div>

      {/* Capture List */}
      <div className="px-4 py-3 space-y-3 scroll-container" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
        {captures.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-5xl">📷</div>
            <p className="text-olive-muted text-lg font-medium">No captures yet</p>
            <p className="text-olive-muted/60 text-sm max-w-xs mx-auto">
              Snap a photo of a business card or badge to start capturing leads
            </p>
            <Link
              href="/capture"
              className="inline-block bg-olive-600 hover:bg-olive-500 text-olive-text font-semibold uppercase tracking-wider text-sm px-6 py-3 rounded-lg transition-colors active:scale-95"
            >
              Start Capturing
            </Link>
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
