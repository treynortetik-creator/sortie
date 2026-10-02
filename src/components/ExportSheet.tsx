'use client';

import { useState } from 'react';
import { buildCsv, csvFilename, FORMATS, type CsvFormat, type ExportLead } from '@/lib/csv';
import { isPending, type EventRecord, type LeadRecord } from '@/lib/db';
import { useSettings } from '@/lib/runtime';
import { DownloadIcon, XIcon } from './icons';
import { toast } from './Toast';

export function toExportLeads(leads: LeadRecord[], eventName: string): ExportLead[] {
  return leads.map((l) => ({
    firstName: l.firstName, lastName: l.lastName, title: l.title, company: l.company, email: l.email, phone: l.phone,
    website: l.website, notes: l.notes, rating: l.rating, transcript: l.transcript, eventName, createdAt: l.createdAt,
  }));
}

/** Hand the file to the phone: the share sheet (Files, Mail, AirDrop) where available, else a normal download. */
export async function deliverFile(name: string, text: string): Promise<void> {
  const file = new File([text], name, { type: 'text/csv' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ExportSheet({ event, leads, onClose }: { event: EventRecord; leads: LeadRecord[]; onClose: () => void }) {
  const [settings, update] = useSettings();
  const [busy, setBusy] = useState(false);
  const format = settings.csvFormat;
  const pending = leads.filter(isPending).length;

  async function go() {
    setBusy(true);
    try {
      const csv = buildCsv(toExportLeads(leads, event.name), format, { bom: settings.csvBom, leadSource: settings.leadSource || 'Event' });
      await deliverFile(csvFilename(event.name, format), csv);
      toast(`Exported ${leads.length} lead${leads.length === 1 ? '' : 's'}`);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" role="dialog" aria-modal="true" aria-label="Export CSV">
      <div className="sheet-in safe-bottom max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-bg p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Export {leads.length} lead{leads.length === 1 ? '' : 's'}</h2>
          <button type="button" aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-surface-2" onClick={onClose}><XIcon width={20} height={20} /></button>
        </div>

        <div className="space-y-2" role="radiogroup" aria-label="CSV format">
          {(Object.keys(FORMATS) as CsvFormat[]).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={format === f} onClick={() => update({ csvFormat: f })} className={`card w-full p-3 text-left ${format === f ? '!border-accent ring-2 ring-accent' : ''}`}>
              <span className="block text-[17px] font-bold">{FORMATS[f].label}</span>
              <span className="block text-sm text-muted">{FORMATS[f].blurb}</span>
            </button>
          ))}
        </div>

        {format === 'salesforce' && (
          <div className="mt-3">
            <label className="label" htmlFor="lead-source">Lead Source value</label>
            <input id="lead-source" className="field" value={settings.leadSource} onChange={(e) => update({ leadSource: e.target.value })} placeholder="Event" />
          </div>
        )}

        <label className="mt-3 flex min-h-[48px] items-center gap-3 text-[15px]">
          <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" checked={settings.csvBom} onChange={(e) => update({ csvBom: e.target.checked })} />
          <span>Excel-friendly accents (adds a UTF-8 marker). Leave off for Salesforce Data Loader.</span>
        </label>

        {pending > 0 && <p className="mt-2 rounded-xl bg-warn/15 p-3 text-sm font-semibold text-warn">{pending} lead{pending === 1 ? ' is' : 's are'} still being read. They export with whatever is filled in now.</p>}

        <button type="button" className="btn btn-primary mt-4 w-full !min-h-[58px]" disabled={busy || leads.length === 0} onClick={() => void go()}>
          <DownloadIcon width={22} height={22} /> Download CSV
        </button>
      </div>
    </div>
  );
}
