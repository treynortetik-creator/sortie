# Vision model comparison (2026-10-02)

Run with `scripts/bench-models.py` against the 5 clean synthetic fixtures (30 scored fields), `temperature: 0`, structured JSON output, `provider.data_collection = "deny"`. These were the fixtures as first rendered; `npm run fixtures` re-renders them with new noise, so exact numbers will differ slightly. Costs are OpenRouter's reported `usage.cost`.

| Model | Fields correct | Total for 5 photos | Per photo | Avg latency |
|---|---|---|---|---|
| google/gemini-3.1-flash-lite | 30/30 | $0.00274 | $0.00055 | 1.75 s |
| google/gemini-3.5-flash-lite | 30/30 | $0.00364 | $0.00073 | 1.33 s |
| google/gemini-3-flash-preview | 30/30 | $0.00523 | $0.00105 | 1.68 s |
| qwen/qwen3.7-flash | 29/30 | $0.00038 | $0.00008 | 5.27 s |
| google/gemma-4-26b-a4b-it | 30/30 | $0.00047 | $0.00009 | 2.09 s |
| openai/gpt-6-luna | 30/30 | $0.00167 | $0.00033 | 4.88 s |
| mistralai/mistral-small-2603 | 30/30 | $0.00196 | $0.00039 | 1.94 s |
| qwen/qwen3.8-flash | not scored (upstream 429 on 4 of 5) | | | |

qwen3.7-flash miss: returned "Exhibitor" (the ribbon text) as the job title of a badge that had no title.

## Speech-to-text (10 s synthetic voice note, m4a and webm)

| Model | Cost per note | Notes |
|---|---|---|
| openai/whisper-large-v3-turbo (default) | $0.00003 to $0.00011 | Both containers accepted. |
| openai/whisper-large-v3 | $0.00007 | |
| mistralai/voxtral-mini-transcribe | $0.00045 | |
| openai/gpt-4o-mini-transcribe | $0.00031 | |
| nvidia/parakeet-tdt-0.6b-v3 | $0.00025 | |

All five transcribed the sentence correctly apart from trivial punctuation.
