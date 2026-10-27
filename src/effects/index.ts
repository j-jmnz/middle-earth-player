import type { Effect } from "../catalog/boundary.ts";

import { AUTHORED_EFFECTS as BOX_AUTHORED, AUTHORED_REPLACES as BOX_REPLACES } from "./authored/fellowship-of-the-ring.ts";
import { AUTHORED_EFFECTS as FORD_AUTHORED, AUTHORED_REPLACES as FORD_REPLACES } from "./authored/flight-to-the-ford.ts";
import { AUTHORED_EFFECTS as SOUTH_AUTHORED, AUTHORED_REPLACES as SOUTH_REPLACES } from "./authored/the-ring-goes-south.ts";
import { FAMILY_AUTHORED_EFFECTS, FAMILY_AUTHORED_REPLACES } from "./authored/families/index.ts";
import { POOL_AUTHORED_EFFECTS, POOL_AUTHORED_REPLACES } from "./authored/pool/index.ts";
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

// The records of each box (scenario cards and both starter lists: the Fellowship's, the Revised Core Set's and The Dark of Mirkwood's) and the rest of the player pool's, one file per pack or
// per mechanic family.
export const GENERATED_EFFECTS: readonly Effect[] = [...BOX_GENERATED, ...MIRKWOOD_GENERATED, ...TDOM_GENERATED, ...POOL_GENERATED_EFFECTS];
export const AUTHORED_EFFECTS: readonly Effect[] = [...BOX_AUTHORED, ...FORD_AUTHORED, ...SOUTH_AUTHORED, ...POOL_AUTHORED_EFFECTS, ...FAMILY_AUTHORED_EFFECTS];
export const AUTHORED_REPLACES: readonly string[] = [...BOX_REPLACES, ...FORD_REPLACES, ...SOUTH_REPLACES, ...POOL_AUTHORED_REPLACES, ...FAMILY_AUTHORED_REPLACES];

export const EFFECTS: readonly Effect[] = mergeEffects(GENERATED_EFFECTS, AUTHORED_EFFECTS);
