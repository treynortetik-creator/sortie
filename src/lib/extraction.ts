import { z } from 'zod';
import { emptyContact, normalizeEmail, normalizeWebsite, splitName, type Contact } from './contact';

/** Result of reading a badge or card. `confidence` is the model's own 0..1 estimate (null if absent). */
export interface Extraction extends Contact {
  confidence: number | null;
}

export class ExtractionParseError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message);
    this.name = 'ExtractionParseError';
  }
}

export const EXTRACT_SYSTEM_PROMPT = `You read photos of event badges, name tags and business cards and return the contact details printed on them.

Return ONLY a JSON object with exactly these keys:
firstName, lastName, title, company, email, phone, website, notes, confidence

Rules:
- Copy only text that is actually visible. Never guess or invent. If a field is not printed, use "".
- Keep the original spelling, accents and diacritics (Zoë, Søren, Müller). Do not transliterate.
- If text is printed in ALL CAPS, return names, title and company in normal capitalisation (Priya Raghunathan, Halcyon Freight Systems), but keep real acronyms (IBM, VP, CEO).
- Split the person's name into firstName and lastName. Drop honorifics (Dr., Mr., Ms.) entirely. Put credentials (PhD, MD) in notes.
- title is the job title or role only (e.g. "Director, Field Marketing"). Ignore badge types such as ATTENDEE, SPEAKER, EXHIBITOR, VIP, STAFF; put them in notes as "Badge: Speaker".
- company is the person's employer or organisation, not the event or conference name.
- email: lowercase. phone: as printed, including country code if shown.
- website: domain as printed, without "https://".
- notes: anything else useful and printed (address, social handle, department, badge type), separated by "; ". Do not repeat the event or conference name. Never describe the photo itself. Ignore QR codes and barcodes.
- If several people appear, use the one whose name is most prominent.
- confidence: your overall certainty 0 to 1 that the fields are correct and complete.
- Output raw JSON only. No markdown, no commentary.`;

export const EXTRACT_USER_PROMPT = 'Extract the contact details from this photo.';

/** JSON schema for OpenRouter structured outputs. */
export const EXTRACT_JSON_SCHEMA = {
  name: 'contact',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['firstName', 'lastName', 'title', 'company', 'email', 'phone', 'website', 'notes', 'confidence'],
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      title: { type: 'string' },
      company: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      website: { type: 'string' },
      notes: { type: 'string' },
      confidence: { type: 'number' },
    },
  },
} as const;

// Models sometimes return numbers, null, arrays or nested objects. Coerce everything to a clean string.
const loose = z
  .union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown())])
  .optional()
  .transform((v): string => {
    if (v === null || v === undefined || typeof v === 'boolean') return '';
    if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean).join('; ');
    return String(v);
  });

const rawSchema = z
  .object({
    firstName: loose,
    lastName: loose,
    first_name: loose,
    last_name: loose,
    name: loose,
    fullName: loose,
    title: loose,
    jobTitle: loose,
    company: loose,
    organization: loose,
    email: loose,
    phone: loose,
    website: loose,
    notes: loose,
    confidence: z.union([z.number(), z.string(), z.null()]).optional(),
  })
  .loose();

/** Pull the first balanced JSON object out of model text (handles fences, prose, trailing commas). */
export function extractJsonObject(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const start = body.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return body.slice(start, i + 1);
    }
  }
  return null;
}

function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

const NULLISH = /^(n\/a|na|none|null|unknown|not (visible|provided|available|printed)|-+)$/i;

function clean(s: string): string {
  const t = tidy(s);
  return NULLISH.test(t) ? '' : t;
}

/** Turn raw model text into a validated, normalised Extraction. Throws ExtractionParseError. */
export function parseModelOutput(text: string): Extraction {
  const json = extractJsonObject(text ?? '');
  if (!json) throw new ExtractionParseError('No JSON object in model output', text);
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    try {
      // Tolerate trailing commas, the most common near-miss.
      data = JSON.parse(json.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      throw new ExtractionParseError('Model output is not valid JSON', text);
    }
  }
  const parsed = rawSchema.safeParse(data);
  if (!parsed.success) throw new ExtractionParseError('Model output has the wrong shape', text);
  return normalizeExtraction(parsed.data);
}

type Raw = z.infer<typeof rawSchema>;

export function normalizeExtraction(raw: Raw): Extraction {
  const out = emptyContact();
  out.firstName = clean(raw.firstName || raw.first_name);
  out.lastName = clean(raw.lastName || raw.last_name);
  const single = clean(raw.name || raw.fullName);
  if (!out.firstName && !out.lastName && single) {
    const s = splitName(single);
    out.firstName = s.firstName;
    out.lastName = s.lastName;
  }
  out.title = clean(raw.title || raw.jobTitle);
  out.company = clean(raw.company || raw.organization);
  const emailRaw = clean(raw.email);
  out.email = emailRaw ? normalizeEmail(emailRaw.split(/[;,\s]+/)[0] ?? '') : '';
  out.phone = clean(raw.phone);
  out.website = normalizeWebsite(clean(raw.website));
  out.notes = clean(raw.notes);
  let confidence: number | null = null;
  if (raw.confidence !== undefined && raw.confidence !== null) {
    const n = typeof raw.confidence === 'number' ? raw.confidence : parseFloat(raw.confidence);
    if (Number.isFinite(n)) confidence = Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
  }
  return { ...out, confidence };
}

export interface Usage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  /** USD actually charged, as reported by OpenRouter. null if the response did not say. */
  costUsd: number | null;
}

/** Read the `usage` block from an OpenRouter chat or transcription response. */
export function parseUsage(model: string, body: unknown): Usage {
  const u = (body as { usage?: Record<string, unknown> } | null)?.usage ?? {};
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    model,
    promptTokens: num(u.prompt_tokens ?? u.input_tokens),
    completionTokens: num(u.completion_tokens ?? u.output_tokens),
    costUsd: typeof u.cost === 'number' && Number.isFinite(u.cost) ? u.cost : null,
  };
}
