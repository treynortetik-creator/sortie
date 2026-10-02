import { DEFAULT_EXTRACT_MODEL, DEFAULT_STT_MODEL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tells the app what this deployment offers, without revealing any secret. */
export function GET(): Response {
  return Response.json({
    serverKey: Boolean(process.env.OPENROUTER_API_KEY),
    needsCode: Boolean(process.env.SORTIE_ACCESS_CODE),
    extractModel: process.env.SORTIE_EXTRACT_MODEL || DEFAULT_EXTRACT_MODEL,
    sttModel: process.env.SORTIE_STT_MODEL || DEFAULT_STT_MODEL,
    version: '2.0.0',
  });
}
