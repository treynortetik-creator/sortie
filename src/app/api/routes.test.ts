import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGuardState, spentTodayUsd } from '@/lib/server/guard';
import { POST as extractPOST } from './extract/route';
import { POST as transcribePOST } from './transcribe/route';
import { GET as statusGET } from './status/route';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const modelReply = {
  choices: [{ message: { content: '{"firstName":"Priya","lastName":"Raghunathan","title":"","company":"Northwind Analytics","email":"","phone":"","website":"","notes":"","confidence":0.9}' } }],
  usage: { prompt_tokens: 1100, completion_tokens: 60, cost: 0.0005 },
};

function req(path: string, field: string, file: File | null, headers: Record<string, string> = {}): Request {
  const fd = new FormData();
  if (file) fd.append(field, file);
  return new Request(`http://localhost${path}`, { method: 'POST', body: fd, headers });
}
const img = (bytes: Uint8Array = JPEG, type = 'image/jpeg') => new File([bytes as BlobPart], 'c.jpg', { type });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetGuardState();
  vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-server-key-aaaaaaaaaaaaaaaa');
  vi.stubEnv('SORTIE_ACCESS_CODE', '');
  vi.stubEnv('SORTIE_ALLOW_MODEL_OVERRIDE', '');
  fetchMock = vi.fn(async () => Response.json(modelReply));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/extract', () => {
  it('returns the parsed contact and usage, sending the server key upstream', async () => {
    const res = await extractPOST(req('/api/extract', 'image', img()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contact.firstName).toBe('Priya');
    expect(body.usage.costUsd).toBe(0.0005);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-or-server-key-aaaaaaaaaaaaaaaa');
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe('google/gemini-3.1-flash-lite');
    expect(sent.provider).toEqual({ data_collection: 'deny' });
    expect(sent.messages[1].content[0].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('never echoes the API key in a response', async () => {
    const res = await extractPOST(req('/api/extract', 'image', img()));
    expect(JSON.stringify(await res.json())).not.toContain('sk-or-server');
  });

  it('503 not_configured when the server has no key and the client brings none', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const res = await extractPOST(req('/api/extract', 'image', img()));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a bring-your-own key works without a server key and is used upstream', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const res = await extractPOST(req('/api/extract', 'image', img(), { 'x-openrouter-key': 'sk-or-user-key-bbbbbbbbbbbbbbbbbb' }));
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-or-user-key-bbbbbbbbbbbbbbbbbb');
  });

  it('enforces the access code when configured', async () => {
    vi.stubEnv('SORTIE_ACCESS_CODE', 'booth-2026');
    const denied = await extractPOST(req('/api/extract', 'image', img()));
    expect(denied.status).toBe(401);
    expect((await denied.json()).code).toBe('bad_code');
    const wrong = await extractPOST(req('/api/extract', 'image', img(), { 'x-sortie-code': 'nope' }));
    expect(wrong.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    const ok = await extractPOST(req('/api/extract', 'image', img(), { 'x-sortie-code': 'booth-2026' }));
    expect(ok.status).toBe(200);
  });

  it('rejects non-images by magic bytes before spending money', async () => {
    const html = new TextEncoder().encode('<html>not an image</html>');
    const res = await extractPOST(req('/api/extract', 'image', img(html)));
    expect(res.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects missing and empty files', async () => {
    expect((await extractPOST(req('/api/extract', 'image', null))).status).toBe(400);
    expect((await extractPOST(req('/api/extract', 'image', img(new Uint8Array())))).status).toBe(400);
  });

  it('rejects non-multipart bodies', async () => {
    const res = await extractPOST(new Request('http://localhost/api/extract', { method: 'POST', body: '{"photoUrl":"http://169.254.169.254/"}', headers: { 'content-type': 'application/json' } }));
    expect(res.status).toBe(400);
  });

  it('flags upstream parse failures as retryable', async () => {
    fetchMock.mockResolvedValue(Response.json({ choices: [{ message: { content: 'sorry, cannot read' } }] }));
    const res = await extractPOST(req('/api/extract', 'image', img()));
    expect(res.status).toBe(502);
    const b = await res.json();
    expect(b.code).toBe('parse_failed');
    expect(b.retryable).toBe(true);
  });

  it('maps upstream 401 to bad_key (not retryable) and 429 to retryable', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"nope"}', { status: 401 }));
    const a = await extractPOST(req('/api/extract', 'image', img(), { 'x-forwarded-for': '1.1.1.1' }));
    expect(a.status).toBe(401);
    expect((await a.json()).retryable).toBe(false);
    fetchMock.mockResolvedValueOnce(new Response('busy', { status: 429 }));
    const b = await extractPOST(req('/api/extract', 'image', img(), { 'x-forwarded-for': '1.1.1.2' }));
    expect(b.status).toBe(429);
    expect((await b.json()).retryable).toBe(true);
  });

  it('falls back to prompt-only JSON when the model rejects structured output', async () => {
    fetchMock.mockResolvedValueOnce(new Response('response_format unsupported', { status: 400 })).mockResolvedValueOnce(Response.json(modelReply));
    const res = await extractPOST(req('/api/extract', 'image', img()));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).response_format).toBeUndefined();
  });

  it('ignores a model override unless BYO key or explicitly allowed', async () => {
    await extractPOST(req('/api/extract', 'image', img(), { 'x-sortie-model': 'evil/expensive-model', 'x-forwarded-for': '2.2.2.1' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('google/gemini-3.1-flash-lite');
    await extractPOST(req('/api/extract', 'image', img(), { 'x-sortie-model': 'qwen/qwen3.7-flash', 'x-openrouter-key': 'sk-or-user-key-bbbbbbbbbbbbbbbbbb', 'x-forwarded-for': '2.2.2.2' }));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe('qwen/qwen3.7-flash');
    const bad = await extractPOST(req('/api/extract', 'image', img(), { 'x-sortie-model': 'not a model!', 'x-forwarded-for': '2.2.2.3' }));
    expect(bad.status).toBe(400);
  });

  it('stops spending when the daily budget is reached, and tracks spend', async () => {
    vi.stubEnv('SORTIE_DAILY_BUDGET_USD', '0.001');
    expect((await extractPOST(req('/api/extract', 'image', img()))).status).toBe(200);
    expect(spentTodayUsd()).toBeCloseTo(0.0005, 8);
    expect((await extractPOST(req('/api/extract', 'image', img()))).status).toBe(200);
    const res = await extractPOST(req('/api/extract', 'image', img()));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('budget_reached');
  });

  it('rate-limits per IP', async () => {
    vi.stubEnv('SORTIE_RATE_LIMIT_PER_MIN', '60');
    let last = 200;
    for (let i = 0; i < 61; i++) last = (await extractPOST(req('/api/extract', 'image', img(), { 'x-forwarded-for': '9.9.9.9' }))).status;
    expect(last).toBe(429);
    const other = await extractPOST(req('/api/extract', 'image', img(), { 'x-forwarded-for': '8.8.8.8' }));
    expect(other.status).toBe(200);
  });

  it('logs a cost line without keys or content', async () => {
    const log = vi.spyOn(console, 'log');
    await extractPOST(req('/api/extract', 'image', img()));
    const line = String(log.mock.calls[0][0]);
    expect(line).toContain('sortie.cost');
    expect(line).not.toContain('sk-or');
    expect(line).not.toContain('Priya');
  });
});

describe('POST /api/transcribe', () => {
  const audio = (name = 'note.m4a', type = 'audio/mp4') => new File([new Uint8Array([1, 2, 3, 4])], name, { type });

  it('transcribes and returns usage', async () => {
    fetchMock.mockResolvedValue(Response.json({ text: ' Hot lead. ', usage: { seconds: 9.9, cost: 0.00003 } }));
    const res = await transcribePOST(req('/api/transcribe', 'audio', audio()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe('Hot lead.');
    expect(body.usage.costUsd).toBe(0.00003);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/audio/transcriptions');
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe('openai/whisper-large-v3-turbo');
    expect(sent.input_audio.format).toBe('m4a');
    expect(sent.input_audio.data).toBe(Buffer.from([1, 2, 3, 4]).toString('base64'));
  });

  it.each([
    ['audio/webm;codecs=opus', 'n.webm', 'webm'],
    ['audio/mp4', 'n.m4a', 'm4a'],
    ['audio/ogg', 'n.ogg', 'ogg'],
  ])('maps %s to %s', async (type, name, fmt) => {
    fetchMock.mockResolvedValue(Response.json({ text: 'x' }));
    await transcribePOST(req('/api/transcribe', 'audio', audio(name, type)));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input_audio.format).toBe(fmt);
  });

  it('rejects unsupported formats, empty and missing audio', async () => {
    expect((await transcribePOST(req('/api/transcribe', 'audio', audio('x.bin', 'application/octet-stream')))).status).toBe(415);
    expect((await transcribePOST(req('/api/transcribe', 'audio', new File([], 'a.m4a', { type: 'audio/mp4' })))).status).toBe(400);
    expect((await transcribePOST(req('/api/transcribe', 'audio', null))).status).toBe(400);
  });

  it('requires the access code like extract does', async () => {
    vi.stubEnv('SORTIE_ACCESS_CODE', 'secret');
    expect((await transcribePOST(req('/api/transcribe', 'audio', audio()))).status).toBe(401);
  });
});

describe('GET /api/status', () => {
  it('reveals configuration flags but never the key', async () => {
    vi.stubEnv('SORTIE_ACCESS_CODE', 'x');
    const body = await statusGET().json();
    expect(body.serverKey).toBe(true);
    expect(body.needsCode).toBe(true);
    expect(JSON.stringify(body)).not.toContain('sk-or');
  });
});
