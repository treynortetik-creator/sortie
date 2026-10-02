'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ChevronIcon, TrashIcon } from '@/components/icons';
import { LeadForm } from '@/components/LeadForm';
import { SyncPill } from '@/components/SyncPill';
import { toast } from '@/components/Toast';
import { formatUsd, db, useLive } from '@/lib/runtime';
import { deleteLeads } from '@/lib/leads';

function Detail() {
  const router = useRouter();
  const id = useSearchParams().get('id') ?? '';
  const lead = useLive(() => db().leads.get(id), [id]);
  const siblings = useLive(async () => (lead ? db().leads.where('eventId').equals(lead.eventId).toArray() : []), [lead?.eventId]) ?? [];

  if (lead === undefined) return <main className="page grid place-items-center text-muted">Loading…</main>;
  if (!lead) {
    return (
      <main className="page grid place-items-center p-8 text-center">
        <div>
          <p className="mb-4 text-lg font-bold">That lead is gone.</p>
          <button type="button" className="btn btn-primary" onClick={() => router.replace('/leads')}>Back to leads</button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="safe-top sticky top-0 z-30 flex items-center justify-between gap-2 bg-bg/95 px-4 pb-3 backdrop-blur">
        <button type="button" className="flex min-h-[44px] items-center gap-1 text-[17px] font-bold" onClick={() => router.back()}>
          <ChevronIcon width={22} height={22} className="rotate-180" /> Leads
        </button>
        <SyncPill />
      </header>
      <div className="px-4 pb-6">
        <LeadForm lead={lead} siblings={siblings} onMerged={() => router.replace('/leads')} />
        <p className="mt-4 text-center text-xs text-muted">
          Captured {new Date(lead.createdAt).toLocaleString()} · AI cost {formatUsd(lead.costUsd)}
          {lead.confidence !== null && ` · confidence ${Math.round(lead.confidence * 100)}%`}
        </p>
        <button
          type="button"
          className="btn btn-danger mt-4 w-full"
          onClick={async () => {
            if (!window.confirm('Delete this lead? This cannot be undone.')) return;
            await deleteLeads(db(), [lead.id]);
            toast('Deleted');
            router.replace('/leads');
          }}
        >
          <TrashIcon width={20} height={20} /> Delete lead
        </button>
      </div>
    </main>
  );
}

export default function LeadPage() {
  return (
    <Suspense fallback={<main className="page grid place-items-center text-muted">Loading…</main>}>
      <Detail />
    </Suspense>
  );
}
