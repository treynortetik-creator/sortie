import { z } from 'zod';

// --- API Request Schemas ---

export const extractRequestSchema = z.object({
  photoUrl: z.string().url().refine(
    (url) => url.includes('.supabase.co/storage/'),
    { message: 'photoUrl must be a Supabase Storage URL' }
  ),
});

export const transcribeRequestSchema = z.object({
  audioUrl: z.string().url().refine(
    (url) => url.includes('.supabase.co/storage/'),
    { message: 'audioUrl must be a Supabase Storage URL' }
  ),
});

// --- API Response Schemas ---

// Coerce each field to string so that AI models returning numbers (e.g. a
// bare phone number like 4155551234) still pass validation instead of
// causing a 500 error.
const coercedString = z.union([z.string(), z.number()]).transform((v) => String(v));

export const extractedContactSchema = z.object({
  name: coercedString.optional().default(''),
  title: coercedString.optional().default(''),
  company: coercedString.optional().default(''),
  email: coercedString.optional().default(''),
  phone: coercedString.optional().default(''),
  notes: coercedString.optional().default(''),
}).passthrough();

export const transcribeResponseSchema = z.object({
  text: z.string(),
});

// --- Type exports ---

export type ExtractRequest = z.infer<typeof extractRequestSchema>;
export type TranscribeRequest = z.infer<typeof transcribeRequestSchema>;
export type ExtractedContact = z.infer<typeof extractedContactSchema>;
