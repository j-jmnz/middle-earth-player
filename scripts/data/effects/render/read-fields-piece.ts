import { newCtx, type Ctx, type Obj } from "./kit.ts";

// The same check for the conditions, picks and amounts: each renders through `done`, which records the keys a template claims in `ctx.reads`. A sample sets the keys the piece reads; a claimed key no sample sets, or one
// whose removal leaves the English as it was, fails; so does a sample that prints `[also ...]`, a key the template does not claim.
export type Render = (value: Obj, ctx: Ctx) => string;

export function checkPiece(render: Render, samples: readonly Obj[], skip: ReadonlySet<string> = new Set()): { hidden: string[]; unsampled: string[]; unclaimed: string[] } {
  const claimed = new Set<string>();
  const sampled = new Set<string>();
  const shown = new Set<string>();
  const unclaimed: string[] = [];
  for (const sample of samples) {
    const ctx: Ctx = { ...newCtx(), reads: [] };
    const full = render(sample, ctx);
    for (const key of ctx.reads?.at(-1) ?? []) claimed.add(key);
    if (full.includes("[also ")) unclaimed.push(full);
    for (const key of Object.keys(sample)) {
      sampled.add(key);
      const { [key]: _removed, ...rest } = sample;
      let without: string | null = null;
      try {
        without = render(rest, newCtx());
      } catch {
        // A template that cannot run without the key reads it for its text.
      }
      if (without !== full) shown.add(key);
    }
  }
  return {
    hidden: [...claimed].filter((key) => sampled.has(key) && !shown.has(key) && !skip.has(key)),
    unsampled: [...claimed].filter((key) => !sampled.has(key)),
    unclaimed,
  };
}
