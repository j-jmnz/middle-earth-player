import type { Effect } from "../catalog/boundary.ts";

import { AUTHORED_EFFECTS, AUTHORED_REPLACES } from "./generated/authored.ts";
import { GENERATED_EFFECTS as DREAM_CHASER_GENERATED } from "./generated/dream-chaser.ts";
import { GENERATED_EFFECTS as ERED_MITHRIN_GENERATED } from "./generated/ered-mithrin.ts";
import { GENERATED_EFFECTS as BOX_GENERATED } from "./generated/fellowship-of-the-ring.ts";
import { GENERATED_EFFECTS as MIRKWOOD_GENERATED } from "./generated/mirkwood-paths.ts";
import { GENERATED_EFFECTS as TDOM_GENERATED } from "./generated/the-dark-of-mirkwood.ts";
import { POOL_GENERATED_EFFECTS } from "./generated/player-pool.ts";

// Generated records (pnpm data:build) plus authored records. An authored record with the id of a generated
// one replaces it, so a wrong template can be overridden without editing the template.
export function mergeEffects(generated: readonly Effect[], authored: readonly Effect[]): Effect[] {
  const replaced = new Set(authored.map((effect) => effect.id));
  return [...generated.filter((effect) => !replaced.has(effect.id)), ...authored];
}

// The records of each box (scenario cards and both starter lists: the Fellowship's, the Revised Core Set's, The Dark of Mirkwood's and Dream-chaser's and Ered Mithrin's) and the rest of the player pool's, one file per pack or
// per mechanic family.
export const GENERATED_EFFECTS: readonly Effect[] = [...BOX_GENERATED, ...MIRKWOOD_GENERATED, ...TDOM_GENERATED, ...DREAM_CHASER_GENERATED, ...ERED_MITHRIN_GENERATED, ...POOL_GENERATED_EFFECTS];

// The authored files, in the order pnpm data:build writes them (src/effects/generated/authored.ts, scripts/data/effects/barrel.ts):
// a scenario's records are src/effects/authored/<scenario-id>.ts, and a new file there needs only that build.
export { AUTHORED_EFFECTS, AUTHORED_REPLACES };

export const EFFECTS: readonly Effect[] = mergeEffects(GENERATED_EFFECTS, AUTHORED_EFFECTS);
