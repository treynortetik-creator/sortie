import { describe, it, expect } from 'vitest';
import {
  extractRequestSchema,
  transcribeRequestSchema,
  extractedContactSchema,
  transcribeResponseSchema,
} from './schemas';

describe('extractRequestSchema', () => {
  it('accepts valid Supabase Storage URL', () => {
    const result = extractRequestSchema.safeParse({
      photoUrl: 'https://abc.supabase.co/storage/v1/object/public/captures/photo.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-Supabase URL', () => {
    const result = extractRequestSchema.safeParse({
      photoUrl: 'https://evil.com/photo.jpg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing photoUrl', () => {
    const result = extractRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL format', () => {
    const result = extractRequestSchema.safeParse({
      photoUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

describe('transcribeRequestSchema', () => {
  it('accepts valid Supabase audio URL', () => {
    const result = transcribeRequestSchema.safeParse({
      audioUrl: 'https://xyz.supabase.co/storage/v1/object/public/captures/audio.webm',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-Supabase URL', () => {
    const result = transcribeRequestSchema.safeParse({
      audioUrl: 'https://evil.com/audio.webm',
    });
    expect(result.success).toBe(false);
  });
});

describe('extractedContactSchema', () => {
  it('accepts complete contact data', () => {
    const result = extractedContactSchema.safeParse({
      name: 'John Doe',
      company: 'Acme',
      email: 'john@acme.com',
      phone: '+1 555 1234',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty/missing fields with defaults', () => {
    const result = extractedContactSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('');
      expect(result.data.company).toBe('');
      expect(result.data.email).toBe('');
      expect(result.data.phone).toBe('');
    }
  });

  it('passes through extra fields', () => {
    const result = extractedContactSchema.safeParse({
      name: 'John',
      title: 'VP Sales',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).title).toBe('VP Sales');
    }
  });
});

describe('transcribeResponseSchema', () => {
  it('accepts valid response', () => {
    const result = transcribeResponseSchema.safeParse({
      text: 'This is a transcription.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing text field', () => {
    const result = transcribeResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
