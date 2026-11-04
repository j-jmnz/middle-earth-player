import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data:build from data/cards and data/scenarios (mirkwood-paths). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"01078:travel:1","cardCode":"01078","lines":["01078:A:1"],"timing":"travel","instructions":[{"verb":"RevealEncounter"}]},
  {"id":"01085:shadow:1","cardCode":"01085","lines":["01085:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker","when":{"kind":"not","condition":{"kind":"undefended"}}},{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker","when":{"kind":"undefended"}}]},
  {"id":"01089:shadow:1","cardCode":"01089","lines":["01089:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker","when":{"kind":"not","condition":{"kind":"undefended"}}},{"verb":"ModifyStat","stat":"attack","amount":3,"until":"endOfAttack","target":"attacker","when":{"kind":"undefended"}}]},
  {"id":"01129:triggered:1","cardCode":"01129","lines":["01129:A:3"],"timing":"triggered","trigger":"leftPlay","subject":{"type":"card","control":"any","names":["Mendor"]},"instructions":[{"verb":"LoseGame"}]},
  {"id":"01130:triggered:1","cardCode":"01130","lines":["01130:A:5"],"timing":"triggered","trigger":"leftPlay","subject":{"type":"card","control":"any","names":["Mendor"]},"instructions":[{"verb":"LoseGame"}]},
];
