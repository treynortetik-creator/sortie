'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DuplicatesSheet } from '@/components/DuplicatesSheet';
import { EventSheet } from '@/components/EventSheet';
import { ExportSheet } from '@/components/ExportSheet';
import { ChevronIcon, DownloadIcon, ImageIcon, MergeIcon, SearchIcon } from '@/components/icons';
import { SyncPill } from '@/components/SyncPill';
import { fullName } from '@/lib/contact';
import { findDuplicateGroups } from '@/lib/dedupe';
import { isPending, needsAttention, type LeadRecord } from '@/lib/db';
import { db, useBlobUrl, useLive } from '@/lib/runtime';
import { useActiveEvent } from '@/lib/useEvents';

type Filter = 'all' | 'hot' | 'attention';

function Thumb({ blob }: { blob?: Blob }) {
  const url = useBlobUrl(blob);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-line object-cover" loading="lazy" />
  ) : (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted"><ImageIcon width={22} height={22} /></span>
  );
}

function Status({ lead }: { lead: LeadRecord }) {
  if (needsAttention(lead)) return <span className="rounded-full bg-bad/15 px-2 py-0.5 text-xs font-bold text-bad">Needs attention</span>;
  if (isPending(lead)) return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">Reading…</span>;
  return null;
}

export default function LeadsPage() {
  const ev = useActiveEvent();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sheet, setSheet] = useState<'export' | 'dupes' | 'event' | null>(null);
  const eventId = ev.event?.id;
  const leads = useLive(() => (eventId ? db().leads.where('eventId').equals(eventId).reverse().sortBy('createdAt') : []), [eventId]);

  const dupGroups = useMemo(() => findDuplicateGroups(leads ?? []), [leads]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (leads ?? []).filter((l) => {
      if (filter === 'hot' && l.rating !== 'Hot') return false;
      if (filter === 'attention' && !needsAttention(l) && !isPending(l)) return false;
      if (!needle) return true;
      return [fullName(l), l.company, l.title, l.email, l.phone, l.notes, l.transcript].join(' ').toLowerCase().includes(needle);
    });
  }, [leads, q, filter]);

  if (ev.loading || leads === undefined) return <main className="page grid place-items-center text-muted">Loading…</main>;
  if (!ev.event) {
    return (
      <main className="page grid place-items-center p-8 text-center">
        <div>
          <p className="mb-4 text-lg font-bold">No events yet</p>
          <Link href="/" className="btn btn-primary">Create your first event</Link>
        </div>
      </main>
    );
  }

  const attention = leads.filter((l) => needsAttention(l) || isPending(l)).length;
  const chip = (id: Filter, label: string) => (
    <button type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={`min-h-[40px] shrink-0 rounded-full border px-4 text-[14px] font-bold ${filter === id ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}>
      {label}
    </button>
  );

  return (
    <main className="page">
      <header className="safe-top sticky top-0 z-30 space-y-3 bg-bg/95 px-4 pb-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setSheet('event')} className="flex min-h-[44px] min-w-0 items-center gap-1 text-left">
            <h1 className="truncate text-2xl font-extrabold">{ev.event.name}</h1>
            <ChevronIcon width={20} height={20} className="shrink-0 rotate-90 text-muted" />
          </button>
          <SyncPill />
        </div>
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search leads</span>
            <SearchIcon width={20} height={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" className="field !pl-10" placeholder={`Search ${leads.length} leads`} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary shrink-0 !px-4" onClick={() => setSheet('export')} disabled={leads.length === 0} aria-label="Export CSV">
            <DownloadIcon width={22} height={22} /> CSV
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {chip('all', `All ${leads.length}`)}
          {chip('hot', `Hot ${leads.filter((l) => l.rating === 'Hot').length}`)}
          {attention > 0 && chip('attention', `Pending ${attention}`)}
        </div>
        {dupGroups.length > 0 && (
          <button type="button" onClick={() => setSheet('dupes')} className="card flex min-h-[48px] w-full items-center gap-2 border-warn px-3 text-left text-[15px] font-semibold">
            <MergeIcon width={20} height={20} className="text-warn" />
            {dupGroups.length} possible duplicate{dupGroups.length === 1 ? '' : 's'}
            <span className="ml-auto text-accent">Review</span>
          </button>
        )}
      </header>

      {leads.length === 0 ? (
        <div className="p-10 text-center text-muted">
          <p className="mb-4 text-lg font-bold text-ink">No leads yet</p>
          <Link href="/" className="btn btn-primary">Capture the first one</Link>
        </div>
      ) : shown.length === 0 ? (
        <p className="p-10 text-center text-muted">Nothing matches.</p>
      ) : (
        <ul className="space-y-2 px-4">
          {shown.map((l) => (
            <li key={l.id}>
              <Link href={`/lead?id=${l.id}`} className="card flex min-h-[72px] items-center gap-3 p-2.5">
                <Thumb blob={l.image} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[17px] font-bold">{fullName(l) || l.email || 'Unnamed lead'}</span>
                    {l.rating && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold text-white ${l.rating === 'Hot' ? 'bg-bad' : l.rating === 'Warm' ? 'bg-warn' : 'bg-sky-600'}`}>{l.rating}</span>}
                  </span>
                  <span className="block truncate text-sm text-muted">{[l.title, l.company].filter(Boolean).join(' · ') || l.email || 'No details yet'}</span>
                  <Status lead={l} />
                </span>
                <ChevronIcon width={20} height={20} className="shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {sheet === 'export' && <ExportSheet event={ev.event} leads={[...leads].reverse()} onClose={() => setSheet(null)} />}
      {sheet === 'dupes' && <DuplicatesSheet leads={leads} onClose={() => setSheet(null)} />}
      {sheet === 'event' && <EventSheet ctx={ev} onClose={() => setSheet(null)} />}
    </main>
  );
}
