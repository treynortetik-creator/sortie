'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fullName, RATINGS, type ContactField, type Rating } from '@/lib/contact';
import { matchReason } from '@/lib/dedupe';
import type { LeadRecord } from '@/lib/db';
import { editField, markNotDuplicate, mergeLeadGroup, setRating } from '@/lib/leads';
import { db, getQueue, kickQueue, useBlobUrl, useOnline, useServerStatus, useSettings } from '@/lib/runtime';
import { AlertIcon, CloudOffIcon, MergeIcon, RefreshIcon } from './icons';
import { VoiceRecorder } from './VoiceRecorder';

type Draft = Record<ContactField, string>;
const toDraft = (l: LeadRecord): Draft => ({
  firstName: l.firstName, lastName: l.lastName, title: l.title, company: l.company, email: l.email, phone: l.phone, website: l.website, notes: l.notes,
});

/** What the rep should know about the photo-reading step right now. */
function Banner({ lead }: { lead: LeadRecord }) {
  const online = useOnline();
  const [settings] = useSettings();
  const server = useServerStatus();
  const s = lead.extract;
  const noKey = server && !server.serverKey && !settings.byoKey;
  if (!lead.image || s.status === 'none') return null;
  if (s.status === 'done') {
    const c = lead.confidence;
    return c !== null && c < 0.6 ? (
      <p className="flex items-center gap-2 rounded-xl bg-warn/15 px-3 py-2 text-sm font-semibold text-warn"><AlertIcon width={18} height={18} /> Hard to read. Please double-check.</p>
    ) : null;
  }
  if (s.status === 'blocked' || (noKey && s.status === 'queued'))
    return (
      <p className="flex items-center gap-2 rounded-xl bg-warn/15 px-3 py-2 text-sm font-semibold text-warn">
        <AlertIcon width={18} height={18} /> {s.error ?? 'No API key configured.'} Saved on this phone. <a className="underline" href="/settings">Fix in Settings</a>
      </p>
    );
  if (s.status === 'error')
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl bg-bad/15 px-3 py-2 text-sm font-semibold text-bad">
        <AlertIcon width={18} height={18} /> Couldn&apos;t read the photo. {s.error}
        <button type="button" className="ml-auto underline" onClick={() => void getQueue().retry(lead.id).then(kickQueue)}>Retry</button>
      </p>
    );
  if (!online)
    return (
      <p className="flex items-center gap-2 rounded-xl bg-warn/15 px-3 py-2 text-sm font-semibold text-warn">
        <CloudOffIcon width={18} height={18} /> Offline. Photo saved, I&apos;ll read it when you&apos;re back online. You can type details now.
      </p>
    );
  if (s.attempts > 0)
    return (
      <p className="flex items-center gap-2 rounded-xl bg-warn/15 px-3 py-2 text-sm font-semibold text-warn">
        <CloudOffIcon width={18} height={18} /> Can&apos;t reach the server. Saved on this phone, retrying automatically.
      </p>
    );
  return (
    <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold">
      <RefreshIcon width={18} height={18} className="spin" /> Reading the card…
    </p>
  );
}

export function LeadForm({ lead, siblings, onMerged }: { lead: LeadRecord; siblings: LeadRecord[]; onMerged?: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(lead));
  const dirty = useRef<Set<ContactField>>(new Set());
  const timers = useRef<Map<ContactField, number>>(new Map());
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const photo = useBlobUrl(lead.image);
  const [more, setMore] = useState(Boolean(lead.website));

  // Accept values arriving from extraction, but never clobber a field being typed in right now.
  useEffect(() => {
    setDraft((d) => {
      const next = { ...d };
      for (const [k, v] of Object.entries(toDraft(lead)) as [ContactField, string][]) if (!dirty.current.has(k)) next[k] = v;
      return next;
    });
  }, [lead]);

  // Flush pending edits when leaving.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const [f, t] of pending) {
        window.clearTimeout(t);
        void editField(db(), lead.id, f, draftRef.current[f]);
      }
    };
  }, [lead.id]);

  function change(field: ContactField, value: string) {
    dirty.current.add(field);
    setDraft((d) => ({ ...d, [field]: value }));
    window.clearTimeout(timers.current.get(field));
    timers.current.set(
      field,
      window.setTimeout(() => {
        timers.current.delete(field);
        void editField(db(), lead.id, field, value);
      }, 350),
    );
  }
  function flush(field: ContactField) {
    const t = timers.current.get(field);
    if (t === undefined) return;
    window.clearTimeout(t);
    timers.current.delete(field);
    void editField(db(), lead.id, field, draftRef.current[field]);
  }

  const online = useOnline();
  // Shimmer means "a request is actually in flight", not "waiting for signal".
  const reading = lead.extract.status === 'running' || (lead.extract.status === 'queued' && lead.extract.attempts === 0 && online);
  const shimmer = (f: ContactField) => (reading && !draft[f] && !lead.touched.includes(f) && lead.image ? 'shimmer' : '');
  const input = (f: ContactField, label: string, attrs: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="min-w-0 flex-1">
      <label className="label" htmlFor={`f-${f}`}>{label}</label>
      <input id={`f-${f}`} className={`field ${shimmer(f)}`} value={draft[f]} onChange={(e) => change(f, e.target.value)} onBlur={() => flush(f)} autoComplete="off" {...attrs} />
    </div>
  );

  const dupe = useMemo(() => {
    const other = siblings.find((o) => o.id !== lead.id && matchReason(o, lead));
    return other ? { other, reason: matchReason(other, lead) } : null;
  }, [siblings, lead]);

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Captured badge or card" className="h-20 w-28 shrink-0 rounded-xl border border-line object-cover" />
        )}
        <div className="min-w-0 flex-1 self-center">
          <Banner lead={lead} />
        </div>
      </div>

      {dupe && (
        <div className="card grid gap-2 border-warn p-3 text-sm">
          <p className="flex items-start gap-2 font-semibold">
            <MergeIcon width={20} height={20} className="mt-0.5 shrink-0 text-warn" />
            Looks like {fullName(dupe.other) || dupe.other.email || 'a lead'} you already captured ({dupe.reason}).
          </p>
          <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn !min-h-[44px] !px-3 !text-[15px]" onClick={() => void markNotDuplicate(db(), [lead.id, dupe.other.id])}>Keep both</button>
          <button
            type="button"
            className="btn btn-primary !min-h-[44px] !px-3 !text-[15px]"
            onClick={async () => {
              await mergeLeadGroup(db(), [dupe.other.id, lead.id]);
              onMerged?.();
            }}
          >
            Merge
          </button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {input('firstName', 'First name', { autoCapitalize: 'words', autoCorrect: 'off', enterKeyHint: 'next' })}
        {input('lastName', 'Last name', { autoCapitalize: 'words', autoCorrect: 'off', enterKeyHint: 'next' })}
      </div>
      {input('company', 'Company', { autoCapitalize: 'words', enterKeyHint: 'next' })}
      {input('title', 'Title', { autoCapitalize: 'words', enterKeyHint: 'next' })}
      {input('email', 'Email', { type: 'email', inputMode: 'email', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false })}
      {input('phone', 'Phone', { type: 'tel', inputMode: 'tel' })}
      {more ? (
        input('website', 'Website', { inputMode: 'url', autoCapitalize: 'none', autoCorrect: 'off' })
      ) : (
        <button type="button" className="text-sm font-semibold text-muted underline" onClick={() => setMore(true)}>+ Website</button>
      )}

      <VoiceRecorder lead={lead} />

      <div>
        <span className="label">Interest</span>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Interest level">
          {RATINGS.map((r) => {
            const on = lead.rating === r;
            const tone = r === 'Hot' ? 'bg-bad text-white' : r === 'Warm' ? 'bg-warn text-white' : 'bg-sky-600 text-white';
            return (
              <button key={r} type="button" role="radio" aria-checked={on} onClick={() => void setRating(db(), lead.id, (on ? '' : r) as Rating)} className={`btn !min-h-[52px] ${on ? tone : ''}`}>
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="f-notes">Notes</label>
        <textarea id="f-notes" className="field" rows={3} value={draft.notes} onChange={(e) => change('notes', e.target.value)} onBlur={() => flush('notes')} />
      </div>
    </div>
  );
}
