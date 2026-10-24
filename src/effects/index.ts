import type { Effect } from "../catalog/boundary.ts";

import { AUTHORED_EFFECTS, AUTHORED_REPLACES } from "./authored/fellowship-of-the-ring.ts";
import { GENERATED_EFFECTS } from "./generated/fellowship-of-the-ring.ts";

// Generated records (pnpm data:build) plus authored records. An authored record with the id of a generated
// one replaces it, so a wrong template can be overridden without editing the template.
export function mergeEffects(generated: readonly Effect[], authored: readonly Effect[]): Effect[] {
  const replaced = new Set(authored.map((effect) => effect.id));
  return [...generated.filter((effect) => !replaced.has(effect.id)), ...authored];
}

export const EFFECTS: readonly Effect[] = mergeEffects(GENERATED_EFFECTS, AUTHORED_EFFECTS);

export { AUTHORED_REPLACES, AUTHORED_EFFECTS, GENERATED_EFFECTS };
