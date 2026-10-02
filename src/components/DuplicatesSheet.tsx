'use client';

import { useMemo } from 'react';
import { fullName } from '@/lib/contact';
import { findDuplicateGroups } from '@/lib/dedupe';
import type { LeadRecord } from '@/lib/db';
import { markNotDuplicate, mergeLeadGroup } from '@/lib/leads';
import { db } from '@/lib/runtime';
import { MergeIcon, XIcon } from './icons';
import { toast } from './Toast';

const WHY = { email: 'Same email', phone: 'Same phone', 'name+company': 'Same name and company', name: 'Same name' } as const;

export function DuplicatesSheet({ leads, onClose }: { leads: LeadRecord[]; onClose: () => void }) {
  const groups = useMemo(() => findDuplicateGroups(leads), [leads]);
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" role="dialog" aria-modal="true" aria-label="Possible duplicates">
      <div className="sheet-in safe-bottom max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-bg p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Possible duplicates</h2>
          <button type="button" aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-surface-2" onClick={onClose}><XIcon width={20} height={20} /></button>
        </div>
        {groups.length === 0 && <p className="py-8 text-center text-muted">No duplicates. Clean list.</p>}
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.ids.join()} className="card p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-warn">{WHY[g.reason]}</p>
              <ul className="space-y-1">
                {g.ids.map((id) => {
                  const l = byId.get(id);
                  if (!l) return null;
                  return (
                    <li key={id} className="text-[15px]">
                      <span className="font-semibold">{fullName(l) || 'Unnamed'}</span>
                      <span className="text-muted"> · {[l.title, l.company].filter(Boolean).join(', ') || l.email || l.phone || 'no details'}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="btn !min-h-[46px]" onClick={() => void markNotDuplicate(db(), g.ids)}>Keep separate</button>
                <button
                  type="button"
                  className="btn btn-primary !min-h-[46px]"
                  onClick={async () => {
                    await mergeLeadGroup(db(), g.ids);
                    toast('Merged');
                  }}
                >
                  <MergeIcon width={18} height={18} /> Merge {g.ids.length}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
