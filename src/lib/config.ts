/**
 * Default models, picked 2026-10-02 from OpenRouter's /models API by running five synthetic badges and
 * cards through eight vision models (see AUDIT.md and docs/verification/). Override per deployment with
 * SORTIE_EXTRACT_MODEL / SORTIE_STT_MODEL, or per device in Settings when using your own key.
 */
export const DEFAULT_EXTRACT_MODEL = 'google/gemini-3.1-flash-lite';
export const DEFAULT_STT_MODEL = 'openai/whisper-large-v3-turbo';

/** Request limits. Photos are resized to ~1600px JPEG on the phone, so these are generous. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_VOICE_SECONDS = 90;
