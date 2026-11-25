import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data build from data/cards and data/scenarios (haradrim). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"16018:travel:1","cardCode":"16018","lines":["16018:A:2"],"timing":"travel","instructions":[{"verb":"RevealEncounter"}]},
  {"id":"16056:travel:1","cardCode":"16056","lines":["16056:A:2"],"timing":"travel","instructions":[{"verb":"RevealEncounter"}]},
  {"id":"16063:shadow:1","cardCode":"16063","lines":["16063:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]},
  {"id":"17069:travel:1","cardCode":"17069","lines":["17069:A:3"],"timing":"travel","instructions":[{"verb":"RevealEncounter"}]},
  {"id":"17120:triggered:1","cardCode":"17120","lines":["17120:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"17123:shadow:1","cardCode":"17123","lines":["17123:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker"}]},
  {"id":"17145:triggered:1","cardCode":"17145","lines":["17145:A:4"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"17151:shadow:1","cardCode":"17151","lines":["17151:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]},
  {"id":"17155:shadow:1","cardCode":"17155","lines":["17155:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker"},{"verb":"AfterAttack","instructions":[{"verb":"RaiseThreat","amount":2,"when":{"kind":"x","min":1}}]}]},
];
