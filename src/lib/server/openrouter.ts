import { DEFAULT_EXTRACT_MODEL, DEFAULT_STT_MODEL } from '../config';
import {
  EXTRACT_JSON_SCHEMA,
  EXTRACT_SYSTEM_PROMPT,
  EXTRACT_USER_PROMPT,
  ExtractionParseError,
  parseModelOutput,
  parseUsage,
  type Extraction,
  type Usage,
} from '../extraction';
import { HttpError } from './errors';

const BASE = 'https://openrouter.ai/api/v1';
const TIMEOUT_MS = 45_000;

type FetchLike = typeof fetch;

export interface CallOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: FetchLike;
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Title': 'Sortie',
    ...(process.env.SORTIE_APP_URL ? { 'HTTP-Referer': process.env.SORTIE_APP_URL } : {}),
  };
}

/** Ask OpenRouter to route only to providers that do not retain or train on prompts. Opt out with SORTIE_ALLOW_DATA_COLLECTION=1. */
function providerPrefs(): { data_collection: 'deny' } | undefined {
  return process.env.SORTIE_ALLOW_DATA_COLLECTION === '1' ? undefined : { data_collection: 'deny' };
}

async function send(url: string, body: unknown, o: CallOptions): Promise<Response> {
  const f = o.fetchImpl ?? fetch;
  try {
    return await f(url, {
      method: 'POST',
      headers: headers(o.apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new HttpError(504, timeout ? 'upstream_timeout' : 'upstream_unreachable', 'The AI service did not respond in time.', true);
  }
}

async function failFrom(res: Response): Promise<never> {
  // Read the body for diagnostics, but only surface a short generic message.
  const text = await res.text().catch(() => '');
  console.error('[sortie] upstream', res.status, text.slice(0, 300).replace(/sk-or-[\w-]+/g, 'sk-or-***'));
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(401, 'bad_key', 'OpenRouter rejected the API key. Check it in Settings.', false);
  }
  if (res.status === 402) {
    throw new HttpError(402, 'no_credits', 'OpenRouter account is out of credits.', false);
  }
  if (res.status === 429) throw new HttpError(429, 'upstream_rate_limited', 'The AI service is busy. Retrying shortly.', true);
  if (res.status === 400 || res.status === 404) {
    throw new HttpError(502, 'bad_request_upstream', 'The AI service could not process this request (check the model name).', false);
  }
  throw new HttpError(502, 'upstream_error', 'The AI service returned an error.', true);
}

export interface ExtractResult {
  contact: Extraction;
  usage: Usage;
}

export async function extractFromImage(image: Uint8Array, mime: string, o: CallOptions): Promise<ExtractResult> {
  const model = o.model || process.env.SORTIE_EXTRACT_MODEL || DEFAULT_EXTRACT_MODEL;
  const dataUrl = `data:${mime};base64,${Buffer.from(image).toString('base64')}`;
  const base = {
    model,
    temperature: 0,
    max_tokens: 600,
    usage: { include: true },
    provider: providerPrefs(),
    messages: [
      { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: EXTRACT_USER_PROMPT },
        ],
      },
    ],
  };

  // Structured output first; a few models reject it, so fall back to prompt-only JSON once.
  let res = await send(`${BASE}/chat/completions`, { ...base, response_format: { type: 'json_schema', json_schema: EXTRACT_JSON_SCHEMA } }, o);
  if (res.status === 400 || res.status === 404) {
    await res.text().catch(() => '');
    res = await send(`${BASE}/chat/completions`, base, o);
  }
  if (!res.ok) await failFrom(res);

  const body: unknown = await res.json();
  const text = (body as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
  try {
    const contact = parseModelOutput(typeof text === 'string' ? text : '');
    return { contact, usage: parseUsage(model, body) };
  } catch (e) {
    if (e instanceof ExtractionParseError) {
      // Cost was still incurred; the model just fumbled the format. Worth another try later.
      throw new HttpError(502, 'parse_failed', 'Could not read the details from that photo. Retrying.', true);
    }
    throw e;
  }
}

export interface TranscribeResult {
  text: string;
  usage: Usage;
}

export async function transcribeAudio(audio: Uint8Array, format: string, o: CallOptions): Promise<TranscribeResult> {
  const model = o.model || process.env.SORTIE_STT_MODEL || DEFAULT_STT_MODEL;
  const res = await send(
    `${BASE}/audio/transcriptions`,
    {
      model,
      input_audio: { data: Buffer.from(audio).toString('base64'), format },
    },
    o,
  );
  if (!res.ok) await failFrom(res);
  const body = (await res.json()) as { text?: unknown; usage?: Record<string, unknown> };
  if (typeof body.text !== 'string') throw new HttpError(502, 'bad_response', 'Unexpected response from the speech service.', true);
  return { text: body.text.trim(), usage: parseUsage(model, body) };
}
