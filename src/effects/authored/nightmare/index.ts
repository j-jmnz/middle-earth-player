import type { Effect } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as RHOSGOBEL_AUTHORED, AUTHORED_REPLACES as RHOSGOBEL_REPLACES } from "./a-journey-to-rhosgobel.ts";
import { AUTHORED_EFFECTS as KNIFE_AUTHORED, AUTHORED_REPLACES as KNIFE_REPLACES } from "./a-knife-in-the-dark.ts";
import { AUTHORED_EFFECTS as DUNGEONS_AUTHORED, AUTHORED_REPLACES as DUNGEONS_REPLACES } from "./escape-from-dol-guldur.ts";
import { AUTHORED_EFFECTS as CARROCK_AUTHORED, AUTHORED_REPLACES as CARROCK_REPLACES } from "./conflict-at-the-carrock.ts";
import { AUTHORED_EFFECTS as FORD_AUTHORED, AUTHORED_REPLACES as FORD_REPLACES } from "./flight-to-the-ford.ts";
import { AUTHORED_EFFECTS as GOLLUM_AUTHORED, AUTHORED_REPLACES as GOLLUM_REPLACES } from "./the-hunt-for-gollum.ts";
import { AUTHORED_EFFECTS as PAST_AUTHORED, AUTHORED_REPLACES as PAST_REPLACES } from "./a-shadow-of-the-past.ts";
import { AUTHORED_EFFECTS as ANDUIN_AUTHORED, AUTHORED_REPLACES as ANDUIN_REPLACES } from "./journey-along-the-anduin.ts";
import { AUTHORED_EFFECTS as MIRKWOOD_AUTHORED, AUTHORED_REPLACES as MIRKWOOD_REPLACES } from "./passage-through-mirkwood.ts";
import { AUTHORED_EFFECTS as SOUTH_AUTHORED, AUTHORED_REPLACES as SOUTH_REPLACES } from "./the-ring-goes-south.ts";

// The Nightmare decks' records, one file per scenario (docs/brief.md, Nightmare).
export const NIGHTMARE_AUTHORED_EFFECTS: readonly Effect[] = [...PAST_AUTHORED, ...KNIFE_AUTHORED, ...FORD_AUTHORED, ...SOUTH_AUTHORED, ...MIRKWOOD_AUTHORED, ...ANDUIN_AUTHORED, ...DUNGEONS_AUTHORED, ...GOLLUM_AUTHORED, ...CARROCK_AUTHORED, ...RHOSGOBEL_AUTHORED];
export const NIGHTMARE_AUTHORED_REPLACES: readonly string[] = [...PAST_REPLACES, ...KNIFE_REPLACES, ...FORD_REPLACES, ...SOUTH_REPLACES, ...MIRKWOOD_REPLACES, ...ANDUIN_REPLACES, ...DUNGEONS_REPLACES, ...GOLLUM_REPLACES, ...CARROCK_REPLACES, ...RHOSGOBEL_REPLACES];
