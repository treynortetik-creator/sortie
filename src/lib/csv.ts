import type { Contact, Rating } from './contact';

export type CsvFormat = 'salesforce' | 'hubspot' | 'generic';

/** What the CSV builder needs from a lead. Kept separate from the DB record so it is easy to test. */
export interface ExportLead extends Contact {
  rating: Rating;
  transcript: string;
  eventName: string;
  createdAt: number;
}

export interface CsvOptions {
  /** Prepend a UTF-8 byte order mark so Excel opens accented names correctly. Off by default (Salesforce Data Loader dislikes it). */
  bom?: boolean;
  /** Value for Salesforce "Lead Source". */
  leadSource?: string;
}

interface Column {
  header: string;
  /** Where the value comes from, shown in the docs and the export sheet. */
  from: string;
  value: (l: ExportLead, o: CsvOptions) => string;
}

/** Salesforce requires Last Name and Company on Leads. This is the usual placeholder people use. */
export const SF_PLACEHOLDER = '[not provided]';

function isoUtc(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function description(l: ExportLead): string {
  const parts = [l.notes.trim()];
  if (l.transcript.trim()) parts.push(`Voice note: ${l.transcript.trim()}`);
  parts.push(`Captured at ${l.eventName} on ${isoUtc(l.createdAt).slice(0, 10)}`);
  return parts.filter(Boolean).join('\n');
}

export const FORMATS: Record<CsvFormat, { label: string; blurb: string; columns: Column[] }> = {
  salesforce: {
    label: 'Salesforce Leads',
    blurb: 'Data Import Wizard, Leads. Last Name and Company are required by Salesforce, so blanks become "[not provided]".',
    columns: [
      { header: 'First Name', from: 'First name', value: (l) => l.firstName },
      { header: 'Last Name', from: 'Last name', value: (l) => l.lastName || SF_PLACEHOLDER },
      { header: 'Company', from: 'Company', value: (l) => l.company || SF_PLACEHOLDER },
      { header: 'Title', from: 'Title', value: (l) => l.title },
      { header: 'Email', from: 'Email', value: (l) => l.email },
      { header: 'Phone', from: 'Phone', value: (l) => l.phone },
      { header: 'Website', from: 'Website', value: (l) => l.website },
      { header: 'Lead Source', from: 'Set at export (default "Event")', value: (_l, o) => o.leadSource ?? 'Event' },
      { header: 'Rating', from: 'Hot / Warm / Cold tap', value: (l) => l.rating },
      { header: 'Description', from: 'Notes + voice note + event and date', value: description },
    ],
  },
  hubspot: {
    label: 'HubSpot Contacts',
    blurb: 'Import, Contacts. Header names match HubSpot default property labels, so columns auto-map. The Sortie columns need mapping to a custom property or skipping.',
    columns: [
      { header: 'First Name', from: 'First name', value: (l) => l.firstName },
      { header: 'Last Name', from: 'Last name', value: (l) => l.lastName },
      { header: 'Email', from: 'Email', value: (l) => l.email },
      { header: 'Phone Number', from: 'Phone', value: (l) => l.phone },
      { header: 'Job Title', from: 'Title', value: (l) => l.title },
      { header: 'Company Name', from: 'Company', value: (l) => l.company },
      { header: 'Website URL', from: 'Website', value: (l) => l.website },
      { header: 'Lead Status', from: 'Always "New"', value: () => 'New' },
      { header: 'Sortie Event', from: 'Event name', value: (l) => l.eventName },
      { header: 'Sortie Rating', from: 'Hot / Warm / Cold tap', value: (l) => l.rating },
      { header: 'Sortie Notes', from: 'Notes', value: (l) => l.notes },
      { header: 'Sortie Voice Note', from: 'Voice note transcript', value: (l) => l.transcript },
      { header: 'Sortie Captured At', from: 'Capture time (UTC)', value: (l) => isoUtc(l.createdAt) },
    ],
  },
  generic: {
    label: 'Plain CSV',
    blurb: 'Every field, friendly headers. Good for Sheets, Excel, Mailchimp and anything else.',
    columns: [
      { header: 'First Name', from: 'First name', value: (l) => l.firstName },
      { header: 'Last Name', from: 'Last name', value: (l) => l.lastName },
      { header: 'Title', from: 'Title', value: (l) => l.title },
      { header: 'Company', from: 'Company', value: (l) => l.company },
      { header: 'Email', from: 'Email', value: (l) => l.email },
      { header: 'Phone', from: 'Phone', value: (l) => l.phone },
      { header: 'Website', from: 'Website', value: (l) => l.website },
      { header: 'Event', from: 'Event name', value: (l) => l.eventName },
      { header: 'Rating', from: 'Hot / Warm / Cold tap', value: (l) => l.rating },
      { header: 'Notes', from: 'Notes', value: (l) => l.notes },
      { header: 'Voice Note', from: 'Voice note transcript', value: (l) => l.transcript },
      { header: 'Captured At', from: 'Capture time (UTC)', value: (l) => isoUtc(l.createdAt) },
    ],
  },
};

const PHONE_LIKE = /^\+?[\d\s().-]{5,}$/;

/**
 * Spreadsheet formula injection guard. A badge is attacker-controlled text: a name like
 * `=HYPERLINK(...)` would run when a rep opens the export in Excel or Sheets. Cells that start
 * with = @ tab or CR get a leading apostrophe; so do leading + or - unless the cell is a phone number.
 */
export function neutralize(cell: string): string {
  if (!cell) return cell;
  const c = cell[0];
  if (c === '=' || c === '@' || c === '\t' || c === '\r') return `'${cell}`;
  if ((c === '+' || c === '-') && !PHONE_LIKE.test(cell)) return `'${cell}`;
  return cell;
}

export function escapeCell(cell: string): string {
  const v = neutralize(cell);
  return /[",\r\n]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function buildCsv(leads: ExportLead[], format: CsvFormat, options: CsvOptions = {}): string {
  const { columns } = FORMATS[format];
  const lines = [columns.map((c) => escapeCell(c.header)).join(',')];
  for (const lead of leads) {
    lines.push(columns.map((c) => escapeCell(c.value(lead, options))).join(','));
  }
  // CRLF per RFC 4180; trailing newline so appending tools behave.
  return (options.bom ? '﻿' : '') + lines.join('\r\n') + '\r\n';
}

export function csvFilename(eventName: string, format: CsvFormat, now: Date = new Date()): string {
  const slug =
    eventName
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'event';
  return `sortie-${slug}-${format}-${now.toISOString().slice(0, 10)}.csv`;
}
