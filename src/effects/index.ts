import type { Effect } from "../catalog/boundary.ts";

import { AUTHORED_EFFECTS, AUTHORED_REPLACES } from "./generated/authored.ts";
import { GENERATED_EFFECTS as ANGMAR_AWAKENED_GENERATED } from "./generated/angmar-awakened.ts";
import { GENERATED_EFFECTS as DREAM_CHASER_GENERATED } from "./generated/dream-chaser.ts";
import { GENERATED_EFFECTS as DWARROWDELF_GENERATED } from "./generated/dwarrowdelf.ts";
import { GENERATED_EFFECTS as ERED_MITHRIN_GENERATED } from "./generated/ered-mithrin.ts";
import { GENERATED_EFFECTS as BOX_GENERATED } from "./generated/fellowship-of-the-ring.ts";
import { GENERATED_EFFECTS as MIRKWOOD_GENERATED } from "./generated/mirkwood-paths.ts";
import { GENERATED_EFFECTS as SHADOWS_OF_MIRKWOOD_GENERATED } from "./generated/shadows-of-mirkwood.ts";
import { GENERATED_EFFECTS as STANDALONE_SCENARIOS_GENERATED } from "./generated/standalone-scenarios.ts";
import { GENERATED_EFFECTS as TDOM_GENERATED } from "./generated/the-dark-of-mirkwood.ts";
import { GENERATED_EFFECTS as RETURN_OF_THE_KING_GENERATED } from "./generated/the-return-of-the-king.ts";
import { GENERATED_EFFECTS as TWO_TOWERS_GENERATED } from "./generated/the-two-towers.ts";
import { POOL_GENERATED_EFFECTS } from "./generated/player-pool.ts";

// Generated records (pnpm data build) plus authored records. An authored record with the id of a generated
// one replaces it, so a wrong template can be overridden without editing the template.
export function mergeEffects(generated: readonly Effect[], authored: readonly Effect[]): Effect[] {
  const replaced = new Set(authored.map((effect) => effect.id));
  return [...generated.filter((effect) => !replaced.has(effect.id)), ...authored];
}

// The records of each box (scenario cards and the starter lists: the Fellowship's, the Revised Core Set's, Shadows of Mirkwood's, The Dark of Mirkwood's, Dream-chaser's, Ered Mithrin's, Angmar Awakened's, The Two Towers', The Return of the King's, Dwarrowdelf's and the standalone scenarios')
// and the rest of the player pool's, one file per pack or per mechanic family.
export const GENERATED_EFFECTS: readonly Effect[] = [...BOX_GENERATED, ...MIRKWOOD_GENERATED, ...TDOM_GENERATED, ...DREAM_CHASER_GENERATED, ...ERED_MITHRIN_GENERATED, ...ANGMAR_AWAKENED_GENERATED, ...TWO_TOWERS_GENERATED, ...RETURN_OF_THE_KING_GENERATED, ...SHADOWS_OF_MIRKWOOD_GENERATED, ...DWARROWDELF_GENERATED, ...STANDALONE_SCENARIOS_GENERATED, ...POOL_GENERATED_EFFECTS];

// The authored files, in the order pnpm data build writes them (src/effects/generated/authored.ts, scripts/data/effects/barrel.ts):
// a scenario's records are src/effects/authored/<scenario-id>.ts, and a new file there needs only that build.
export { AUTHORED_EFFECTS, AUTHORED_REPLACES };

export const EFFECTS: readonly Effect[] = mergeEffects(GENERATED_EFFECTS, AUTHORED_EFFECTS);
