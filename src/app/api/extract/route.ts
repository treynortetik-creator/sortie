import { MAX_IMAGE_BYTES } from '@/lib/config';
import { HttpError, errorResponse } from '@/lib/server/errors';
import { authorize, recordSpend } from '@/lib/server/guard';
import { logCost } from '@/lib/server/log';
import { extractFromImage } from '@/lib/server/openrouter';
import { sniffImage } from '@/lib/server/sniff';

export const runtime = 'nodejs';
export const maxDuration = 60;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: Request): Promise<Response> {
  try {
    const auth = authorize(req);
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new HttpError(400, 'bad_form', 'Send the photo as multipart form data.');
    }
    const file = form.get('image');
    if (!(file instanceof File)) throw new HttpError(400, 'no_image', 'No photo in the request.');
    if (file.size === 0) throw new HttpError(400, 'empty_image', 'The photo is empty.');
    if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, 'image_too_large', 'Photo is too large.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime || !IMAGE_TYPES.has(mime)) throw new HttpError(415, 'not_an_image', 'That file is not a JPEG, PNG or WebP image.');

    const started = Date.now();
    // The photo lives in memory for this request only: it is forwarded to OpenRouter and then dropped.
    const result = await extractFromImage(bytes, mime, { apiKey: auth.apiKey, model: auth.model });
    const ms = Date.now() - started;
    if (!auth.byo) recordSpend(result.usage.costUsd);
    logCost('extract', result.usage, ms, auth.byo);
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
