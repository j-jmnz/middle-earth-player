import type { Effect } from "../../../catalog/boundary.ts";

// Records for the Dream-chaser Campaign Expansion's own cards (data/cards/DCCE.json), added as each scenario phase uses them. Read from the scan
// ledger (data/printed/dream-chaser.json). Rules: dcce.hard-expert, dcce.gaining-xp (data/rules/entries.json).
export const RECORDS: readonly Effect[] = [
  // 11217 Hard/Expert Mode card: "If you win the game, resolve this card's resolution." Hard (side A) gains 1 XP, Expert (side B) gains 2 XP. The other
  // lines (threat cannot be reduced, the Forced draws) are not applied yet.
  {"id":"11217:resolution:1","cardCode":"11217","lines":["11217:A:3"],"timing":"resolution","instructions":[{"verb":"GainXp","amount":1}]},
  {"id":"11217:resolution:2","cardCode":"11217","lines":["11217:B:4"],"timing":"resolution","instructions":[{"verb":"GainXp","amount":2}]},
];

export const REPLACES: readonly string[] = [];
