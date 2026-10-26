import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for costs: discounts, resource matches, who pays for what, icons, optional doomed (docs/plans/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.
export const RECORDS: readonly Effect[] = [];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
