import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for player attacks: attack modifiers and targets, immediate attacks, attacks into the staging area (docs/plans/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.
export const RECORDS: readonly Effect[] = [];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
