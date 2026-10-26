import type { Effect } from "../catalog/boundary.ts";

import { AUTHORED_EFFECTS as BOX_AUTHORED, AUTHORED_REPLACES as BOX_REPLACES } from "./authored/fellowship-of-the-ring.ts";
import { POOL_AUTHORED_EFFECTS, POOL_AUTHORED_REPLACES } from "./authored/pool/index.ts";
import { GENERATED_EFFECTS as BOX_GENERATED } from "./generated/fellowship-of-the-ring.ts";
import { POOL_GENERATED_EFFECTS } from "./generated/player-pool.ts";

// Generated records (pnpm data:build) plus authored records. An authored record with the id of a generated
// one replaces it, so a wrong template can be overridden without editing the template.
export function mergeEffects(generated: readonly Effect[], authored: readonly Effect[]): Effect[] {
  const replaced = new Set(authored.map((effect) => effect.id));
  return [...generated.filter((effect) => !replaced.has(effect.id)), ...authored];
}

// The box's records (scenario cards and both starter lists) and the rest of the player pool's, one per pack.
export const GENERATED_EFFECTS: readonly Effect[] = [...BOX_GENERATED, ...POOL_GENERATED_EFFECTS];
export const AUTHORED_EFFECTS: readonly Effect[] = [...BOX_AUTHORED, ...POOL_AUTHORED_EFFECTS];
export const AUTHORED_REPLACES: readonly string[] = [...BOX_REPLACES, ...POOL_AUTHORED_REPLACES];

export const EFFECTS: readonly Effect[] = mergeEffects(GENERATED_EFFECTS, AUTHORED_EFFECTS);
