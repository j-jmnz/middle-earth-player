import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for enemy attacks: defenders, the damage window (cancel, prevent, reduce, redirect), shadow cards (docs/plans/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.
export const RECORDS: readonly Effect[] = [];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
