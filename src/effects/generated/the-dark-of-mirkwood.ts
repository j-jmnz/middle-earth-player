import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data:build from data/cards and data/scenarios (the-dark-of-mirkwood). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"41007:whenRevealed:1","cardCode":"41007","lines":["41007:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":"41027"}]},
  {"id":"41014:travel:1","cardCode":"41014","lines":["41014:A:1"],"timing":"travel","instructions":[{"verb":"RevealEncounter"}]},
  {"id":"41017:shadow:1","cardCode":"41017","lines":["41017:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker"},{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]},
  {"id":"41019:constant:1","cardCode":"41019","lines":["41019:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"41019:shadow:1","cardCode":"41019","lines":["41019:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker"}]},
  {"id":"41029:constant:1","cardCode":"41029","lines":["41029:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}}]},
  {"id":"41030:constant:1","cardCode":"41030","lines":["41030:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"41032:shadow:1","cardCode":"41032","lines":["41032:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker","when":{"kind":"not","condition":{"kind":"matches","card":"attacker","pick":{"type":"enemy","control":"any","trait":"Goblin"}}}},{"verb":"ModifyStat","stat":"attack","amount":3,"until":"endOfAttack","target":"attacker","when":{"kind":"matches","card":"attacker","pick":{"type":"enemy","control":"any","trait":"Goblin"}}}]},
  {"id":"41033:travel:1","cardCode":"41033","lines":["41033:A:1"],"timing":"travel","instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":"41029"}}]},
  {"id":"41036:travel:1","cardCode":"41036","lines":["41036:A:1"],"timing":"travel","instructions":[{"verb":"RevealEncounter"}]},
  {"id":"41044:setup:1","cardCode":"41044","lines":["41044:A:1"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"41045:setup:1","cardCode":"41045","lines":["41045:A:1"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"41046:setup:1","cardCode":"41046","lines":["41046:A:1"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"41047:setup:1","cardCode":"41047","lines":["41047:A:1"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
];
