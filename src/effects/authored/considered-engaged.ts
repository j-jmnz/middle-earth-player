import type { Instruction, PickSpec } from "../../catalog/boundary.ts";

// The four flags of an enemy "considered engaged with each player" while it stays in the staging area (rr.engaged): it attacks each player, any character may attack it, it adds no Threat there and no player can engage it. The Watcher in the Water (142024:A:2), The Two Watchers' enemies
// (146066:B:2, 146068:B:2) and Old Man Willow (147006:B:1) share it. This file exports no AUTHORED_EFFECTS, so the authored barrel (scripts/data/effects/barrel.ts) does not list it.

/** The four ModifyStat flags, held by the source itself or, with `holders`, by the cards it picks out. */
export function consideredEngaged(holders?: PickSpec): Instruction[] {
  return (["engagedWithAll", "cannotBeEngaged", "noThreatContribution", "attackableByAny"] as const).map((stat) => ({ verb: "ModifyStat" as const, stat, amount: 1, until: "whileSourceInPlay" as const, ...(holders ? { holders } : {}) }));
}
