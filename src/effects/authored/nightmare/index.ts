import type { Effect } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as KNIFE_AUTHORED, AUTHORED_REPLACES as KNIFE_REPLACES } from "./a-knife-in-the-dark.ts";
import { AUTHORED_EFFECTS as FORD_AUTHORED, AUTHORED_REPLACES as FORD_REPLACES } from "./flight-to-the-ford.ts";
import { AUTHORED_EFFECTS as PAST_AUTHORED, AUTHORED_REPLACES as PAST_REPLACES } from "./a-shadow-of-the-past.ts";
import { AUTHORED_EFFECTS as SOUTH_AUTHORED, AUTHORED_REPLACES as SOUTH_REPLACES } from "./the-ring-goes-south.ts";

// The Nightmare decks' records, one file per scenario (docs/plans/nightmare-mode.md, phase 36).
export const NIGHTMARE_AUTHORED_EFFECTS: readonly Effect[] = [...PAST_AUTHORED, ...KNIFE_AUTHORED, ...FORD_AUTHORED, ...SOUTH_AUTHORED];
export const NIGHTMARE_AUTHORED_REPLACES: readonly string[] = [...PAST_REPLACES, ...KNIFE_REPLACES, ...FORD_REPLACES, ...SOUTH_REPLACES];
