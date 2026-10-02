import { MAX_AUDIO_BYTES } from '@/lib/config';
import { HttpError, errorResponse } from '@/lib/server/errors';
import { authorize, recordSpend } from '@/lib/server/guard';
import { logCost } from '@/lib/server/log';
import { transcribeAudio } from '@/lib/server/openrouter';
import { audioFormat } from '@/lib/server/sniff';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  try {
    const auth = authorize(req);
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new HttpError(400, 'bad_form', 'Send the audio as multipart form data.');
    }
    const file = form.get('audio');
    if (!(file instanceof File)) throw new HttpError(400, 'no_audio', 'No audio in the request.');
    if (file.size === 0) throw new HttpError(400, 'empty_audio', 'The recording is empty.');
    if (file.size > MAX_AUDIO_BYTES) throw new HttpError(413, 'audio_too_large', 'Recording is too large.');
    const format = audioFormat(file.type, file.name);
    if (!format) throw new HttpError(415, 'unsupported_audio', 'Unsupported audio format.');

    const started = Date.now();
    const result = await transcribeAudio(new Uint8Array(await file.arrayBuffer()), format, { apiKey: auth.apiKey, model: auth.model });
    const ms = Date.now() - started;
    if (!auth.byo) recordSpend(result.usage.costUsd);
    logCost('transcribe', result.usage, ms, auth.byo);
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
