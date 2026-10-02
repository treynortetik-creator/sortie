// Runs the synthetic fixtures through a RUNNING Sortie server (real OpenRouter calls) and scores the result.
//   npm run build && npm start        (with OPENROUTER_API_KEY in .env.local)
//   BASE=http://localhost:3000 node scripts/verify-real.mjs
// Writes docs/verification/real-extraction.json and appends one line per paid call to cost-log.jsonl.
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fx = join(root, 'test', 'fixtures');
const out = join(root, 'docs', 'verification');
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:3217';
const CAP_USD = Number(process.env.SPEND_CAP_USD || 0.5);
const headers = process.env.SORTIE_ACCESS_CODE ? { 'x-sortie-code': process.env.SORTIE_ACCESS_CODE } : {};

const truth = JSON.parse(readFileSync(join(fx, 'truth.json'), 'utf8'));
const norm = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const same = (field, a, b) => (field === 'phone' ? digits(a) === digits(b) : norm(a) === norm(b));

let spent = 0;
const log = (row) => appendFileSync(join(out, 'cost-log.jsonl'), JSON.stringify(row) + '\n');
const results = [];

for (const [file, want] of Object.entries(truth)) {
  if (spent >= CAP_USD) throw new Error(`Spend cap ${CAP_USD} reached`);
  const fd = new FormData();
  fd.append('image', new File([readFileSync(join(fx, file))], file, { type: 'image/jpeg' }));
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/extract`, { method: 'POST', body: fd, headers });
  const ms = Date.now() - t0;
  const body = await res.json();
  if (!res.ok) {
    console.log(file, 'FAILED', res.status, body);
    results.push({ file, ok: false, status: res.status, error: body.error });
    continue;
  }
  const cost = body.usage.costUsd ?? 0;
  spent += cost;
  log({ at: new Date().toISOString(), kind: 'extract', file, model: body.usage.model, costUsd: body.usage.costUsd, promptTokens: body.usage.promptTokens, completionTokens: body.usage.completionTokens, ms });
  const fields = {};
  let right = 0;
  for (const [k, v] of Object.entries(want)) {
    const got = body.contact[k];
    const ok = same(k, got, v);
    fields[k] = { want: v, got, ok };
    if (ok) right++;
  }
  results.push({ file, ok: true, ms, costUsd: cost, correct: right, total: Object.keys(want).length, confidence: body.contact.confidence, extra: { notes: body.contact.notes, website: body.contact.website }, fields });
  console.log(`${file.padEnd(20)} ${right}/${Object.keys(want).length} fields  ${ms}ms  $${cost.toFixed(6)}  conf=${body.contact.confidence}`);
  for (const [k, f] of Object.entries(fields)) if (!f.ok) console.log(`   MISS ${k}: want ${JSON.stringify(f.want)} got ${JSON.stringify(f.got)}`);
}

// Voice note, both container formats a phone might produce.
const voice = [];
for (const [file, type] of [['voice-note.m4a', 'audio/mp4'], ['voice-note.webm', 'audio/webm']]) {
  if (spent >= CAP_USD) break;
  const fd = new FormData();
  fd.append('audio', new File([readFileSync(join(fx, file))], file, { type }));
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/transcribe`, { method: 'POST', body: fd, headers });
  const ms = Date.now() - t0;
  const body = await res.json();
  if (!res.ok) {
    console.log(file, 'FAILED', res.status, body);
    voice.push({ file, ok: false, error: body.error });
    continue;
  }
  spent += body.usage.costUsd ?? 0;
  log({ at: new Date().toISOString(), kind: 'transcribe', file, model: body.usage.model, costUsd: body.usage.costUsd, ms });
  voice.push({ file, ok: true, ms, costUsd: body.usage.costUsd, text: body.text });
  console.log(`${file.padEnd(20)} ${ms}ms $${(body.usage.costUsd ?? 0).toFixed(6)}  "${body.text}"`);
}

const ok = results.filter((r) => r.ok);
const acc = (rs) => `${rs.reduce((n, r) => n + r.correct, 0)}/${rs.reduce((n, r) => n + r.total, 0)}`;
const summary = {
  ranAt: new Date().toISOString(),
  base: BASE,
  imagesOk: ok.length,
  fieldAccuracy: acc(ok),
  fieldAccuracyClean: acc(ok.filter((r) => !r.file.startsWith('hard-'))),
  fieldAccuracyHard: acc(ok.filter((r) => r.file.startsWith('hard-'))),
  extractCostTotalUsd: ok.reduce((n, r) => n + r.costUsd, 0),
  extractCostAvgUsd: ok.length ? ok.reduce((n, r) => n + r.costUsd, 0) / ok.length : 0,
  extractAvgMs: ok.length ? Math.round(ok.reduce((n, r) => n + r.ms, 0) / ok.length) : 0,
  totalSpendUsd: spent,
};
writeFileSync(join(out, 'real-extraction.json'), JSON.stringify({ summary, results, voice }, null, 2) + '\n');
console.log('\nSUMMARY', summary);
