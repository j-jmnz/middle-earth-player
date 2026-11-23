import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data build from data/cards and data/scenarios (against-the-shadow). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"05038:shadow:1","cardCode":"05038","lines":["05038:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker"}]},
  {"id":"05057:shadow:1","cardCode":"05057","lines":["05057:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker"}]},
  {"id":"06044:whenRevealed:1","cardCode":"06044","lines":["06044:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":"06045"}]},
  {"id":"06048:shadow:1","cardCode":"06048","lines":["06048:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker"}]},
  {"id":"06067:whenRevealed:1","cardCode":"06067","lines":["06067:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":"06071"}]},
  {"id":"06077:travel:1","cardCode":"06077","lines":["06077:A:2"],"timing":"travel","instructions":[{"verb":"RevealEncounter"}]},
  {"id":"06097:travel:1","cardCode":"06097","lines":["06097:A:1"],"timing":"travel","instructions":[{"verb":"RevealEncounter"}]},
  {"id":"06154:shadow:1","cardCode":"06154","lines":["06154:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]},
  {"id":"06158:shadow:1","cardCode":"06158","lines":["06158:A:3"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]},
];
