import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for player side quests, contracts, encounter-keyword player cards and the victory display (docs/plans/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.
export const RECORDS: readonly Effect[] = [];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
