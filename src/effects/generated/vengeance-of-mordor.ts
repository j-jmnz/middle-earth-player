import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data build from data/cards and data/scenarios (vengeance-of-mordor). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"21040:shadow:1","cardCode":"21040","lines":["21040:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker"}]},
  {"id":"22039:constant:1","cardCode":"22039","lines":["22039:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noPlayerAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"22044:shadow:1","cardCode":"22044","lines":["22044:A:3"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]},
  {"id":"22096:constant:1","cardCode":"22096","lines":["22096:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"22124:triggered:1","cardCode":"22124","lines":["22124:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"22125:triggered:1","cardCode":"22125","lines":["22125:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"22126:triggered:1","cardCode":"22126","lines":["22126:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"22151:constant:1","cardCode":"22151","lines":["22151:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"22151:shadow:1","cardCode":"22151","lines":["22151:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker"}]},
];
