import { describe, expect, it } from 'vitest';
import { isValidEmail, normalizeKey, phoneKey, splitName } from './contact';

describe('splitName', () => {
  it.each([
    ['Marcus Delacroix-Bell', 'Marcus', 'Delacroix-Bell'],
    ['Dr. Søren Ødegård-Lindqvist', 'Søren', 'Ødegård-Lindqvist'],
    ['Ludwig van Beethoven', 'Ludwig', 'van Beethoven'],
    ['Maria de la Cruz', 'Maria', 'de la Cruz'],
    ['Smith, Jane', 'Jane', 'Smith'],
    ['Cher', 'Cher', ''],
    ['Martin Luther King Jr.', 'Martin Luther', 'King Jr.'],
    ['  Jo   Ann  Park ', 'Jo Ann', 'Park'],
    ['', '', ''],
  ])('%s', (full, first, last) => {
    expect(splitName(full)).toEqual({ firstName: first, lastName: last });
  });
});

describe('keys', () => {
  it('phoneKey ignores formatting and country code', () => {
    expect(phoneKey('+1 (415) 555-0142')).toBe(phoneKey('415.555.0142'));
    expect(phoneKey('12')).toBe('');
  });
  it('normalizeKey strips accents, legal suffixes and punctuation', () => {
    expect(normalizeKey('Zoë Müller-Ålesund')).toBe('zoe muller alesund');
    expect(normalizeKey('Birchwood & Finch, Inc.')).toBe('birchwood and finch');
  });
  it('isValidEmail', () => {
    expect(isValidEmail('a@b.example')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.example')).toBe(false);
  });
});
