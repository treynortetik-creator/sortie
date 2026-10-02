'use client';

import { useState } from 'react';
import { ExportSheet } from '@/components/ExportSheet';
import { CheckIcon, DownloadIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { SyncPill } from '@/components/SyncPill';
import { toast } from '@/components/Toast';
import { isPending, type EventRecord, type LeadRecord } from '@/lib/db';
import { deleteEvent, renameEvent } from '@/lib/leads';
import { db, formatUsd, useLive } from '@/lib/runtime';
import { useActiveEvent } from '@/lib/useEvents';

export default function EventsPage() {
  const ctx = useActiveEvent();
  const [name, setName] = useState('');
  const [exporting, setExporting] = useState<{ event: EventRecord; leads: LeadRecord[] } | null>(null);
  const leads = useLive(() => db().leads.toArray(), []);

  async function add() {
    if (!name.trim()) return;
    await ctx.create(name);
    setName('');
  }

  return (
    <main className="page">
      <header className="safe-top flex items-center justify-between px-4 pb-3">
        <h1 className="text-2xl font-extrabold">Events</h1>
        <SyncPill />
      </header>
      <div className="space-y-4 px-4">
        <div>
          <label className="label" htmlFor="ev-name">New event</label>
          <div className="flex gap-2">
            <input id="ev-name" className="field" placeholder="e.g. FieldCon 2026" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add()} />
            <button type="button" className="btn btn-primary shrink-0" onClick={() => void add()} disabled={!name.trim()}><PlusIcon width={20} height={20} /> Add</button>
          </div>
        </div>

        {ctx.events.length === 0 && !ctx.loading && <p className="py-8 text-center text-muted">No events yet. Add one to start capturing.</p>}

        <ul className="space-y-3">
          {ctx.events.map((e) => {
            const mine = (leads ?? []).filter((l) => l.eventId === e.id);
            const cost = mine.reduce((s, l) => s + l.costUsd, 0);
            const pending = mine.filter(isPending).length;
            const active = ctx.event?.id === e.id;
            return (
              <li key={e.id} className={`card p-3 ${active ? '!border-accent' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">{e.name}</p>
                    <p className="text-sm text-muted">
                      {mine.length} lead{mine.length === 1 ? '' : 's'} · {new Date(e.createdAt).toLocaleDateString()} · AI {formatUsd(cost)}
                      {pending > 0 && ` · ${pending} pending`}
                    </p>
                  </div>
                  {active && <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-ok"><CheckIcon width={18} height={18} /> Active</span>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {!active && <button type="button" className="btn !min-h-[46px]" onClick={() => ctx.setActive(e.id)}>Make active</button>}
                  <button type="button" className="btn !min-h-[46px]" onClick={() => { const n = window.prompt('Rename event', e.name); if (n !== null) void renameEvent(db(), e.id, n); }}>Rename</button>
                  <button type="button" className="btn !min-h-[46px]" disabled={mine.length === 0} onClick={() => setExporting({ event: e, leads: mine.sort((a, b) => a.createdAt - b.createdAt) })}>
                    <DownloadIcon width={18} height={18} /> Export
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger !min-h-[46px]"
                    onClick={async () => {
                      if (!window.confirm(`Delete "${e.name}" and its ${mine.length} leads? Export first if you need them.`)) return;
                      await deleteEvent(db(), e.id);
                      toast('Event deleted');
                    }}
                  >
                    <TrashIcon width={18} height={18} /> Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {exporting && <ExportSheet event={exporting.event} leads={exporting.leads} onClose={() => setExporting(null)} />}
    </main>
  );
}
