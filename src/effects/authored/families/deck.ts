import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for the player's deck, hand and discard pile: look, arrange, search, return, play from the discard pile (docs/plans/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.
export const RECORDS: readonly Effect[] = [];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
