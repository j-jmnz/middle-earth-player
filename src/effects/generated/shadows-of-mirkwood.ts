import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data build from data/cards and data/scenarios (shadows-of-mirkwood). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"900507:constant:1","cardCode":"900507","lines":["900507:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noPlayerAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"900509:shadow:1","cardCode":"900509","lines":["900509:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker"}]},
];
