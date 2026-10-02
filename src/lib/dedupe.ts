import { FIELDS, fullName, normalizeKey, phoneKey, type Contact } from './contact';

export interface DedupeLead extends Contact {
  id: string;
  createdAt: number;
  transcript: string;
  /** Lead ids the user marked "not a duplicate of". */
  notDuplicateOf?: string[];
}

export type DupeReason = 'email' | 'phone' | 'name+company' | 'name';

export interface DupeGroup {
  ids: string[];
  /** Strongest reason that linked the group. */
  reason: DupeReason;
}

const STRENGTH: Record<DupeReason, number> = { email: 4, phone: 3, 'name+company': 2, name: 1 };

function keys(l: DedupeLead): { email: string; phone: string; name: string; company: string } {
  return {
    email: l.email.trim().toLowerCase(),
    phone: phoneKey(l.phone),
    name: normalizeKey(fullName(l)),
    company: normalizeKey(l.company),
  };
}

/** Why two leads look like the same person, or null. */
export function matchReason(a: DedupeLead, b: DedupeLead): DupeReason | null {
  if (a.notDuplicateOf?.includes(b.id) || b.notDuplicateOf?.includes(a.id)) return null;
  const x = keys(a);
  const y = keys(b);
  if (x.email && x.email === y.email) return 'email';
  if (x.phone && x.phone === y.phone) return 'phone';
  const twoWords = (n: string) => n.split(' ').length >= 2;
  if (x.name && x.name === y.name && twoWords(x.name)) {
    if (x.company && x.company === y.company) return 'name+company';
    // Same full name with one company blank: likely the same person scanned twice.
    if (!x.company || !y.company) return 'name';
  }
  return null;
}

/** Group leads that look like the same person (transitively). Groups of one are dropped. */
export function findDuplicateGroups(leads: DedupeLead[]): DupeGroup[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r) as string;
    parent.set(id, r);
    return r;
  };
  for (const l of leads) parent.set(l.id, l.id);
  for (let i = 0; i < leads.length; i++) {
    for (let j = i + 1; j < leads.length; j++) {
      if (matchReason(leads[i], leads[j])) parent.set(find(leads[j].id), find(leads[i].id));
    }
  }
  const members = new Map<string, DedupeLead[]>();
  for (const l of leads) {
    const r = find(l.id);
    members.set(r, [...(members.get(r) ?? []), l]);
  }
  const out: DupeGroup[] = [];
  for (const group of members.values()) {
    if (group.length < 2) continue;
    let best: DupeReason = 'name';
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const r = matchReason(group[i], group[j]);
        if (r && STRENGTH[r] > STRENGTH[best]) best = r;
      }
    }
    const sorted = [...group].sort((p, q) => p.createdAt - q.createdAt);
    out.push({ ids: sorted.map((l) => l.id), reason: best });
  }
  return out.sort((a, b) => STRENGTH[b.reason] - STRENGTH[a.reason]);
}

/** Merge several leads into one: the oldest wins, blanks are filled from the rest, notes are joined. */
export function mergeContacts<T extends DedupeLead>(leads: T[]): { primary: T; merged: Contact; transcript: string; absorbed: string[] } {
  const sorted = [...leads].sort((a, b) => a.createdAt - b.createdAt);
  const [primary, ...rest] = sorted;
  const merged: Contact = { ...primary };
  for (const f of FIELDS) {
    if (f === 'notes') continue;
    if (!merged[f].trim()) {
      const donor = rest.find((r) => r[f].trim());
      if (donor) merged[f] = donor[f];
    }
  }
  const uniq = (xs: string[]) => [...new Set(xs.map((s) => s.trim()).filter(Boolean))];
  merged.notes = uniq(sorted.map((l) => l.notes)).join('\n');
  const transcript = uniq(sorted.map((l) => l.transcript)).join('\n');
  return { primary, merged, transcript, absorbed: rest.map((r) => r.id) };
}
