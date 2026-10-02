/** Contact field helpers shared by extraction, CSV export and dedupe. */

export const FIELDS = ['firstName', 'lastName', 'title', 'company', 'email', 'phone', 'website', 'notes'] as const;
export type ContactField = (typeof FIELDS)[number];
export type Contact = Record<ContactField, string>;

export const RATINGS = ['Hot', 'Warm', 'Cold'] as const;
export type Rating = (typeof RATINGS)[number] | '';

export function emptyContact(): Contact {
  return { firstName: '', lastName: '', title: '', company: '', email: '', phone: '', website: '', notes: '' };
}

export function fullName(c: Pick<Contact, 'firstName' | 'lastName'>): string {
  return [c.firstName, c.lastName].map((s) => s.trim()).filter(Boolean).join(' ');
}

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'mx', 'dr', 'prof', 'sir', 'madam']);
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md', 'mba', 'esq', 'cpa']);
const PARTICLES = new Set(['van', 'von', 'der', 'den', 'de', 'del', 'della', 'di', 'da', 'dos', 'das', 'du', 'la', 'le', 'bin', 'ibn', 'al', 'el', 'st', 'ten', 'ter']);

/** Split a single "full name" string into first and last. Used when a model or a user gives one blob. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const cleaned = full.replace(/\s+/g, ' ').trim();
  if (!cleaned) return { firstName: '', lastName: '' };
  // "Last, First" form
  if (cleaned.includes(',')) {
    const [last, first] = cleaned.split(',', 2).map((s) => s.trim());
    if (first && !SUFFIXES.has(first.toLowerCase().replace(/\./g, ''))) return { firstName: first, lastName: last };
  }
  let tokens = cleaned.split(' ');
  while (tokens.length > 1 && HONORIFICS.has(tokens[0].toLowerCase().replace(/\./g, ''))) tokens = tokens.slice(1);
  const suffixes: string[] = [];
  while (tokens.length > 1 && SUFFIXES.has(tokens[tokens.length - 1].toLowerCase().replace(/[.,]/g, ''))) {
    suffixes.unshift(tokens.pop() as string);
  }
  if (tokens.length === 1) return { firstName: tokens[0], lastName: suffixes.join(' ') };
  // Walk back over particles so "Ludwig van Beethoven" -> last "van Beethoven"
  let lastStart = tokens.length - 1;
  while (lastStart > 1 && PARTICLES.has(tokens[lastStart - 1].toLowerCase())) lastStart--;
  const firstName = tokens.slice(0, lastStart).join(' ');
  const lastName = [tokens.slice(lastStart).join(' '), ...suffixes].join(' ').trim();
  return { firstName, lastName };
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

export function normalizeEmail(raw: string): string {
  const e = raw.trim().replace(/^mailto:/i, '').replace(/[\s<>]/g, '').toLowerCase();
  return e;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/** Digits only, last 10 digits kept so "+1 (415) 555-0142" and "415-555-0142" compare equal. */
export function phoneKey(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeWebsite(raw: string): string {
  const w = raw.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return w;
}

const COMPANY_NOISE = /\b(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|ag|plc|sa|bv|the)\b\.?/g;

/** Lowercase, strip accents and legal suffixes, collapse punctuation, for fuzzy comparison. */
export function normalizeKey(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(COMPANY_NOISE, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
