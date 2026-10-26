import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for the encounter deck: look, move, discard, search, cancel and replace revealed cards, reveal triggers (docs/plans/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.
export const RECORDS: readonly Effect[] = [];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
