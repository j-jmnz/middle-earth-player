import type { Effect } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as PAST_AUTHORED, AUTHORED_REPLACES as PAST_REPLACES } from "./a-shadow-of-the-past.ts";

// The Nightmare decks' records, one file per scenario (docs/plans/nightmare-mode.md, phase 36).
export const NIGHTMARE_AUTHORED_EFFECTS: readonly Effect[] = [...PAST_AUTHORED];
export const NIGHTMARE_AUTHORED_REPLACES: readonly string[] = [...PAST_REPLACES];
