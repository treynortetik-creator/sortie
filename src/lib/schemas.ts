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

export const draftEmailRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  company: z.string().max(200).optional().default(''),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(5000).optional().default(''),
  eventName: z.string().max(200).optional().default(''),
});

// --- API Response Schemas ---

export const extractedContactSchema = z.object({
  name: z.string().optional().default(''),
  company: z.string().optional().default(''),
  email: z.string().optional().default(''),
  phone: z.string().optional().default(''),
}).passthrough();

export const transcribeResponseSchema = z.object({
  text: z.string(),
});

// --- Type exports ---

export type ExtractRequest = z.infer<typeof extractRequestSchema>;
export type TranscribeRequest = z.infer<typeof transcribeRequestSchema>;
export type DraftEmailRequest = z.infer<typeof draftEmailRequestSchema>;
export type ExtractedContact = z.infer<typeof extractedContactSchema>;
