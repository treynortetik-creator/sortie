import { describe, expect, it } from 'vitest';
import { emptyContact } from './contact';
import { findDuplicateGroups, matchReason, mergeContacts, type DedupeLead } from './dedupe';

let n = 0;
const L = (over: Partial<DedupeLead>): DedupeLead => ({ ...emptyContact(), id: `id${++n}`, createdAt: n, transcript: '', ...over });

describe('matchReason', () => {
  it('matches on email, case-insensitive', () => {
    expect(matchReason(L({ email: 'A@x.example' }), L({ email: 'a@X.example' }))).toBe('email');
  });
  it('matches on phone regardless of formatting', () => {
    expect(matchReason(L({ phone: '+1 (415) 555-0142' }), L({ phone: '415.555.0142' }))).toBe('phone');
  });
  it('matches on full name + company, ignoring accents and legal suffixes', () => {
    expect(matchReason(L({ firstName: 'Zoë', lastName: 'Müller', company: 'Birchwood & Finch Inc.' }), L({ firstName: 'Zoe', lastName: 'Muller', company: 'Birchwood and Finch' }))).toBe('name+company');
  });
  it('flags same full name when one company is blank', () => {
    expect(matchReason(L({ firstName: 'Ana', lastName: 'Lee', company: 'Acme' }), L({ firstName: 'Ana', lastName: 'Lee' }))).toBe('name');
  });
  it('does not match two people who share a first name, or the same name at different companies', () => {
    expect(matchReason(L({ firstName: 'Ana' }), L({ firstName: 'Ana' }))).toBeNull();
    expect(matchReason(L({ firstName: 'Ana', lastName: 'Lee', company: 'Acme' }), L({ firstName: 'Ana', lastName: 'Lee', company: 'Globex' }))).toBeNull();
  });
  it('does not match two blank leads', () => {
    expect(matchReason(L({}), L({}))).toBeNull();
  });
  it('respects "not a duplicate"', () => {
    const a = L({ email: 'a@x.example' });
    const b = L({ email: 'a@x.example', notDuplicateOf: [a.id] });
    expect(matchReason(a, b)).toBeNull();
  });
});

describe('findDuplicateGroups', () => {
  it('groups transitively and orders oldest first', () => {
    const a = L({ email: 'a@x.example' });
    const b = L({ email: 'a@x.example', phone: '415 555 0142' });
    const c = L({ phone: '+1 415 555 0142' });
    const other = L({ email: 'z@y.example' });
    const groups = findDuplicateGroups([c, other, b, a]);
    expect(groups).toHaveLength(1);
    expect(groups[0].ids).toEqual([a.id, b.id, c.id]);
    expect(groups[0].reason).toBe('email');
  });
  it('returns nothing when everyone is distinct', () => {
    expect(findDuplicateGroups([L({ email: 'a@x.example' }), L({ email: 'b@x.example' })])).toEqual([]);
  });
});

describe('mergeContacts', () => {
  it('keeps the oldest, fills blanks from the rest, joins unique notes and transcripts', () => {
    const a = L({ firstName: 'Ana', lastName: 'Lee', notes: 'met at booth', transcript: 'call her' });
    const b = L({ firstName: 'Ana', lastName: 'Lee', email: 'ana@x.example', company: 'Acme', notes: 'met at booth', transcript: 'send deck' });
    const m = mergeContacts([b, a]);
    expect(m.primary.id).toBe(a.id);
    expect(m.merged.email).toBe('ana@x.example');
    expect(m.merged.company).toBe('Acme');
    expect(m.merged.notes).toBe('met at booth');
    expect(m.transcript).toBe('call her\nsend deck');
    expect(m.absorbed).toEqual([b.id]);
  });
  it('never overwrites a filled field', () => {
    const a = L({ title: 'CEO' });
    const b = L({ title: 'Intern' });
    expect(mergeContacts([a, b]).merged.title).toBe('CEO');
  });
});
