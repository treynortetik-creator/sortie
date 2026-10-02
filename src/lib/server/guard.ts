import { timingSafeEqual } from 'node:crypto';
import { HttpError } from './errors';

/**
 * Who may spend money through this deployment?
 *  - A request carrying its own OpenRouter key (x-openrouter-key) spends its own money: always allowed.
 *  - Otherwise the server key is used. If SORTIE_ACCESS_CODE is set, requests must send it.
 *  - A rolling daily spend cap (SORTIE_DAILY_BUDGET_USD, default 5) and a per-IP rate limit cap the damage
 *    if the URL leaks. Both are in-memory, per instance: a speed bump, not a billing system.
 */

export interface Authorized {
  apiKey: string;
  byo: boolean;
  /** Per-request model override, only honoured with a BYO key or SORTIE_ALLOW_MODEL_OVERRIDE=1. */
  model?: string;
}

const RATE_LIMIT = Number(process.env.SORTIE_RATE_LIMIT_PER_MIN ?? 60);
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim();
}

export function rateLimit(key: string, now = Date.now(), limit = RATE_LIMIT): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return true;
}

let spendDay = '';
let spentToday = 0;

function today(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}
export function dailyBudget(): number {
  const n = Number(process.env.SORTIE_DAILY_BUDGET_USD ?? 5);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}
export function recordSpend(usd: number | null, now = Date.now()): void {
  if (today(now) !== spendDay) {
    spendDay = today(now);
    spentToday = 0;
  }
  spentToday += usd ?? 0;
}
export function spentTodayUsd(now = Date.now()): number {
  return today(now) === spendDay ? spentToday : 0;
}
export function resetGuardState(): void {
  hits.clear();
  spendDay = '';
  spentToday = 0;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function authorize(req: Request, now = Date.now()): Authorized {
  if (!rateLimit(clientIp(req), now)) {
    throw new HttpError(429, 'rate_limited', 'Too many requests. Slow down for a moment.', true);
  }
  const byoKey = req.headers.get('x-openrouter-key')?.trim();
  const requestedModel = req.headers.get('x-sortie-model')?.trim() || undefined;
  if (requestedModel && !/^[\w.\-:~]+\/[\w.\-:~]+$/.test(requestedModel)) {
    throw new HttpError(400, 'bad_model', 'Model name looks invalid.', false);
  }

  if (byoKey) {
    if (byoKey.length < 20) throw new HttpError(401, 'bad_key', 'That API key looks too short.', false);
    return { apiKey: byoKey, byo: true, model: requestedModel };
  }

  const serverKey = process.env.OPENROUTER_API_KEY;
  if (!serverKey) {
    throw new HttpError(
      503,
      'not_configured',
      'This server has no OpenRouter key. Add your own key in Settings, or set OPENROUTER_API_KEY.',
      false,
    );
  }
  const code = process.env.SORTIE_ACCESS_CODE;
  if (code && !safeEqual(req.headers.get('x-sortie-code') ?? '', code)) {
    throw new HttpError(401, 'bad_code', 'Wrong or missing access code. Enter it in Settings.', false);
  }
  if (spentTodayUsd(now) >= dailyBudget()) {
    throw new HttpError(429, 'budget_reached', 'Daily spending cap reached on this server. Try again tomorrow.', false);
  }
  const model = process.env.SORTIE_ALLOW_MODEL_OVERRIDE === '1' ? requestedModel : undefined;
  return { apiKey: serverKey, byo: false, model };
}
