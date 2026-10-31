import type { Effect } from "../catalog/boundary.ts";

import { AUTHORED_EFFECTS as BREAKING_AUTHORED, AUTHORED_REPLACES as BREAKING_REPLACES } from "./authored/breaking-of-the-fellowship.ts";
import { AUTHORED_EFFECTS as DOL_GULDUR_AUTHORED, AUTHORED_REPLACES as DOL_GULDUR_REPLACES } from "./authored/escape-from-dol-guldur.ts";
import { AUTHORED_EFFECTS as BOX_AUTHORED, AUTHORED_REPLACES as BOX_REPLACES } from "./authored/fellowship-of-the-ring.ts";
import { AUTHORED_EFFECTS as FORD_AUTHORED, AUTHORED_REPLACES as FORD_REPLACES } from "./authored/flight-to-the-ford.ts";
import { AUTHORED_EFFECTS as ANDUIN_AUTHORED, AUTHORED_REPLACES as ANDUIN_REPLACES } from "./authored/journey-along-the-anduin.ts";
import { AUTHORED_EFFECTS as MORIA_AUTHORED, AUTHORED_REPLACES as MORIA_REPLACES } from "./authored/journey-in-the-dark.ts";
import { AUTHORED_EFFECTS as PASSAGE_AUTHORED, AUTHORED_REPLACES as PASSAGE_REPLACES } from "./authored/passage-through-mirkwood.ts";
import { AUTHORED_EFFECTS as CAVES_AUTHORED, AUTHORED_REPLACES as CAVES_REPLACES } from "./authored/the-caves-of-nibin-dum.ts";
import { AUTHORED_EFFECTS as OATH_AUTHORED, AUTHORED_REPLACES as OATH_REPLACES } from "./authored/the-oath.ts";
import { AUTHORED_EFFECTS as SOUTH_AUTHORED, AUTHORED_REPLACES as SOUTH_REPLACES } from "./authored/the-ring-goes-south.ts";
import { AUTHORED_EFFECTS as VOYAGE_AUTHORED, AUTHORED_REPLACES as VOYAGE_REPLACES } from "./authored/voyage-across-belegaer.ts";
import { AUTHORED_EFFECTS as NUMENOR_AUTHORED, AUTHORED_REPLACES as NUMENOR_REPLACES } from "./authored/the-fate-of-numenor.ts";
import { AUTHORED_EFFECTS as RAID_AUTHORED, AUTHORED_REPLACES as RAID_REPLACES } from "./authored/raid-on-the-grey-havens.ts";
import { AUTHORED_EFFECTS as STORMCALLER_AUTHORED, AUTHORED_REPLACES as STORMCALLER_REPLACES } from "./authored/flight-of-the-stormcaller.ts";
import { FAMILY_AUTHORED_EFFECTS, FAMILY_AUTHORED_REPLACES } from "./authored/families/index.ts";
import { NIGHTMARE_AUTHORED_EFFECTS, NIGHTMARE_AUTHORED_REPLACES } from "./authored/nightmare/index.ts";
import { POOL_AUTHORED_EFFECTS, POOL_AUTHORED_REPLACES } from "./authored/pool/index.ts";
import { GENERATED_EFFECTS as DREAM_CHASER_GENERATED } from "./generated/dream-chaser.ts";
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

// The records of each box (scenario cards and both starter lists: the Fellowship's, the Revised Core Set's, The Dark of Mirkwood's and Dream-chaser's) and the rest of the player pool's, one file per pack or
// per mechanic family.
export const GENERATED_EFFECTS: readonly Effect[] = [...BOX_GENERATED, ...MIRKWOOD_GENERATED, ...TDOM_GENERATED, ...DREAM_CHASER_GENERATED, ...POOL_GENERATED_EFFECTS];
export const AUTHORED_EFFECTS: readonly Effect[] = [...BOX_AUTHORED, ...FORD_AUTHORED, ...SOUTH_AUTHORED, ...MORIA_AUTHORED, ...BREAKING_AUTHORED, ...PASSAGE_AUTHORED, ...ANDUIN_AUTHORED, ...DOL_GULDUR_AUTHORED, ...OATH_AUTHORED, ...CAVES_AUTHORED, ...VOYAGE_AUTHORED, ...NUMENOR_AUTHORED, ...RAID_AUTHORED, ...STORMCALLER_AUTHORED, ...NIGHTMARE_AUTHORED_EFFECTS, ...POOL_AUTHORED_EFFECTS, ...FAMILY_AUTHORED_EFFECTS];
export const AUTHORED_REPLACES: readonly string[] = [...BOX_REPLACES, ...FORD_REPLACES, ...SOUTH_REPLACES, ...MORIA_REPLACES, ...BREAKING_REPLACES, ...PASSAGE_REPLACES, ...ANDUIN_REPLACES, ...DOL_GULDUR_REPLACES, ...OATH_REPLACES, ...CAVES_REPLACES, ...VOYAGE_REPLACES, ...NUMENOR_REPLACES, ...RAID_REPLACES, ...STORMCALLER_REPLACES, ...NIGHTMARE_AUTHORED_REPLACES, ...POOL_AUTHORED_REPLACES, ...FAMILY_AUTHORED_REPLACES];

export const EFFECTS: readonly Effect[] = mergeEffects(GENERATED_EFFECTS, AUTHORED_EFFECTS);
