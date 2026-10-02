import type { Usage } from '../extraction';

/** One JSON line per paid call, to stdout. Grep for "sortie.cost" to total your spend. Never includes keys, images or text. */
export function logCost(kind: 'extract' | 'transcribe', usage: Usage, ms: number, byo: boolean): void {
  console.log(
    JSON.stringify({
      evt: 'sortie.cost',
      kind,
      model: usage.model,
      costUsd: usage.costUsd,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      ms,
      byo,
      at: new Date().toISOString(),
    }),
  );
}
