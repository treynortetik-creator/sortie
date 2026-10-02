import { describe, expect, it } from 'vitest';
import { ExtractionParseError, extractJsonObject, parseModelOutput, parseUsage } from './extraction';

const good = {
  firstName: 'Priya',
  lastName: 'Raghunathan',
  title: 'Director, Field Marketing',
  company: 'Northwind Analytics',
  email: 'Priya@Northwind.example',
  phone: '+1 415 555 0100',
  website: 'https://northwind.example/',
  notes: 'Badge: Attendee',
  confidence: 0.93,
};

describe('parseModelOutput', () => {
  it('parses clean JSON and normalises email and website', () => {
    const r = parseModelOutput(JSON.stringify(good));
    expect(r.firstName).toBe('Priya');
    expect(r.email).toBe('priya@northwind.example');
    expect(r.website).toBe('northwind.example');
    expect(r.confidence).toBe(0.93);
  });

  it('handles markdown fences and chatter around the JSON', () => {
    const r = parseModelOutput('Sure! Here you go:\n```json\n' + JSON.stringify(good) + '\n```\nHope that helps.');
    expect(r.company).toBe('Northwind Analytics');
  });

  it('handles braces inside string values', () => {
    const r = parseModelOutput(JSON.stringify({ ...good, notes: 'logo {star} on badge' }) + ' trailing');
    expect(r.notes).toBe('logo {star} on badge');
  });

  it('tolerates trailing commas', () => {
    const r = parseModelOutput('{"firstName":"A","lastName":"B",}');
    expect(r.lastName).toBe('B');
  });

  it('coerces numbers, nulls and arrays; blanks placeholder values', () => {
    const r = parseModelOutput(
      JSON.stringify({ firstName: 'Al', lastName: null, phone: 4155550100, notes: ['a', 'b'], title: 'N/A', company: 'unknown', email: 'none' }),
    );
    expect(r.lastName).toBe('');
    expect(r.phone).toBe('4155550100');
    expect(r.notes).toBe('a; b');
    expect(r.title).toBe('');
    expect(r.company).toBe('');
    expect(r.email).toBe('');
  });

  it('splits a single "name" field when the model ignores the schema', () => {
    const r = parseModelOutput('{"name":"Dr. Ludwig van Beethoven","company":"Bonn Quartet"}');
    expect(r.firstName).toBe('Ludwig');
    expect(r.lastName).toBe('van Beethoven');
  });

  it('accepts snake_case keys', () => {
    const r = parseModelOutput('{"first_name":"Zoë","last_name":"Müller-Ålesund"}');
    expect(r.firstName).toBe('Zoë');
    expect(r.lastName).toBe('Müller-Ålesund');
  });

  it('keeps diacritics', () => {
    const r = parseModelOutput('{"firstName":"Søren","lastName":"Ødegård-Lindqvist"}');
    expect(`${r.firstName} ${r.lastName}`).toBe('Søren Ødegård-Lindqvist');
  });

  it('takes the first email when several are listed', () => {
    const r = parseModelOutput('{"email":"a@x.example, b@x.example"}');
    expect(r.email).toBe('a@x.example');
  });

  it('clamps confidence, including percentages and strings', () => {
    expect(parseModelOutput('{"confidence":93}').confidence).toBe(0.93);
    expect(parseModelOutput('{"confidence":"0.5"}').confidence).toBe(0.5);
    expect(parseModelOutput('{"confidence":-3}').confidence).toBe(0);
    expect(parseModelOutput('{}').confidence).toBeNull();
  });

  it('collapses whitespace', () => {
    expect(parseModelOutput('{"title":"  VP,\\n  Sales  "}').title).toBe('VP, Sales');
  });

  it('throws a typed error on garbage', () => {
    expect(() => parseModelOutput('I cannot read this image.')).toThrow(ExtractionParseError);
    expect(() => parseModelOutput('{"firstName": ')).toThrow(ExtractionParseError);
    expect(() => parseModelOutput('')).toThrow(ExtractionParseError);
  });

  it('returns an all-empty extraction for an empty object (blurry photo)', () => {
    const r = parseModelOutput('{}');
    expect(r.firstName + r.lastName + r.company + r.email).toBe('');
  });
});

describe('extractJsonObject', () => {
  it('returns null when there is no object', () => {
    expect(extractJsonObject('no json here')).toBeNull();
  });
  it('finds the first balanced object', () => {
    expect(extractJsonObject('x {"a":{"b":1}} y {"c":2}')).toBe('{"a":{"b":1}}');
  });
});

describe('parseUsage', () => {
  it('reads OpenRouter chat usage including cost', () => {
    const u = parseUsage('m/x', { usage: { prompt_tokens: 1200, completion_tokens: 80, cost: 0.00055 } });
    expect(u).toEqual({ model: 'm/x', promptTokens: 1200, completionTokens: 80, costUsd: 0.00055 });
  });
  it('reads STT usage naming', () => {
    const u = parseUsage('m/stt', { usage: { input_tokens: 83, output_tokens: 30, cost: 0.0005 } });
    expect(u.promptTokens).toBe(83);
    expect(u.costUsd).toBe(0.0005);
  });
  it('returns null cost when the provider does not report one', () => {
    expect(parseUsage('m/x', { usage: { prompt_tokens: 5 } }).costUsd).toBeNull();
    expect(parseUsage('m/x', {}).costUsd).toBeNull();
  });
});
