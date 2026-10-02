import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FORMATS, SF_PLACEHOLDER, buildCsv, csvFilename, escapeCell, neutralize, type ExportLead } from './csv';

const lead = (over: Partial<ExportLead> = {}): ExportLead => ({
  firstName: 'Marcus',
  lastName: 'Delacroix-Bell',
  title: 'VP, Partnerships',
  company: 'Halcyon Freight Systems',
  email: 'marcus.bell@halcyonfreight.example',
  phone: '+1 (415) 555-0142',
  website: 'halcyonfreight.example',
  notes: 'Wants a demo',
  rating: 'Hot',
  transcript: 'Send the case study.',
  eventName: 'FieldCon 2026',
  createdAt: Date.UTC(2026, 9, 2, 17, 45, 12),
  ...over,
});

/** Minimal RFC 4180 parser so tests prove the output round-trips. */
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (q) {
      if (c === '"' && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r' && csv[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  return rows;
}

describe('buildCsv: Salesforce', () => {
  it('writes the Lead import headers in order', () => {
    const [header] = parse(buildCsv([lead()], 'salesforce'));
    expect(header).toEqual(['First Name', 'Last Name', 'Company', 'Title', 'Email', 'Phone', 'Website', 'Lead Source', 'Rating', 'Description']);
  });

  it('maps fields and builds Description from notes, transcript and event', () => {
    const [, row] = parse(buildCsv([lead()], 'salesforce', { leadSource: 'Trade Show' }));
    expect(row[0]).toBe('Marcus');
    expect(row[3]).toBe('VP, Partnerships');
    expect(row[7]).toBe('Trade Show');
    expect(row[8]).toBe('Hot');
    expect(row[9]).toBe('Wants a demo\nVoice note: Send the case study.\nCaptured at FieldCon 2026 on 2026-10-02');
  });

  it('fills the two required Salesforce fields when missing', () => {
    const [, row] = parse(buildCsv([lead({ lastName: '', company: '' })], 'salesforce'));
    expect(row[1]).toBe(SF_PLACEHOLDER);
    expect(row[2]).toBe(SF_PLACEHOLDER);
  });
});

describe('buildCsv: HubSpot', () => {
  it('uses default property labels so columns auto-map', () => {
    const [header, row] = parse(buildCsv([lead()], 'hubspot'));
    expect(header.slice(0, 8)).toEqual(['First Name', 'Last Name', 'Email', 'Phone Number', 'Job Title', 'Company Name', 'Website URL', 'Lead Status']);
    expect(row[3]).toBe('+1 (415) 555-0142');
    expect(row[7]).toBe('New');
    expect(row[12]).toBe('2026-10-02T17:45:12Z');
  });

  it('does not invent placeholders (HubSpot only needs an email or name)', () => {
    const [, row] = parse(buildCsv([lead({ company: '' })], 'hubspot'));
    expect(row[5]).toBe('');
  });
});

describe('buildCsv: generic and format details', () => {
  it('has a header row and one row per lead, CRLF terminated', () => {
    const csv = buildCsv([lead(), lead({ firstName: 'Ana' })], 'generic');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(parse(csv)).toHaveLength(3);
    expect(csv.split('\r\n')).toHaveLength(4);
  });

  it('emits only a header for an empty list', () => {
    expect(parse(buildCsv([], 'generic'))).toHaveLength(1);
  });

  it('adds a BOM only when asked', () => {
    expect(buildCsv([], 'generic').charCodeAt(0)).not.toBe(0xfeff);
    expect(buildCsv([], 'generic', { bom: true }).charCodeAt(0)).toBe(0xfeff);
  });

  it('round-trips commas, quotes, newlines and unicode', () => {
    const tricky = lead({ company: 'Birchwood & "Finch", Ltd', notes: 'line1\nline2, "quoted"', firstName: 'Zoë', lastName: 'Müller-Ålesund' });
    const [, row] = parse(buildCsv([tricky], 'generic'));
    expect(row[3]).toBe('Birchwood & "Finch", Ltd');
    expect(row[9]).toBe('line1\nline2, "quoted"');
    expect(row[0]).toBe('Zoë');
    expect(row[1]).toBe('Müller-Ålesund');
  });

  it('every format has unique headers', () => {
    for (const f of Object.values(FORMATS)) {
      const h = f.columns.map((c) => c.header);
      expect(new Set(h).size).toBe(h.length);
    }
  });
});

describe('formula injection guard', () => {
  it.each([
    ['=HYPERLINK("http://evil.example","x")', true],
    ['@SUM(A1:A9)', true],
    ['+cmd|calc', true],
    ['-2+3', true],
    ['\tTAB', true],
    ['+1 (415) 555-0142', false],
    ['+46 8 555 01 77', false],
    ['415-555-0142', false],
    ['Normal Name', false],
    ['', false],
  ])('%j neutralised=%s', (input, changed) => {
    expect(neutralize(input) !== input).toBe(changed);
  });

  it('applies to exported cells', () => {
    const [, row] = parse(buildCsv([lead({ firstName: '=2+5' })], 'generic'));
    expect(row[0]).toBe("'=2+5");
  });

  it('escapeCell quotes leading and trailing spaces', () => {
    expect(escapeCell(' x')).toBe('" x"');
  });
});

describe('csvFilename', () => {
  it('slugifies the event and includes format and date', () => {
    expect(csvFilename('FieldCon 2026 — Las Vegas!', 'hubspot', new Date('2026-10-02T12:00:00Z'))).toBe('sortie-fieldcon-2026-las-vegas-hubspot-2026-10-02.csv');
    expect(csvFilename('日本', 'generic', new Date('2026-10-02T12:00:00Z'))).toBe('sortie-event-generic-2026-10-02.csv');
  });
});

describe('docs', () => {
  it('README documents every exported column header', () => {
    const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
    for (const f of Object.values(FORMATS)) {
      for (const c of f.columns) expect(readme, `README is missing "${c.header}"`).toContain(c.header);
    }
  });
});
