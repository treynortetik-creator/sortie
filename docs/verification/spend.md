# OpenRouter spend for building and verifying v2 (2026-10-02)

Cap: $0.50. Actual: about **$0.06**.

| Source | Calls | USD |
|---|---|---|
| Vision model comparison, 8 models x 5 images (`scripts/bench-models.py`) | about 36 | 0.0194 (incl. 10 speech calls) |
| `verify:real` and `screenshots` runs kept in `cost-log.jsonl` | 40 | 0.0187 |
| Earlier iterations of the end-to-end tour (not retained in the log) | about 25 | about 0.02 (estimate) |

Per-call figures are OpenRouter's reported `usage.cost`; the last row is an estimate from the per-call average.
