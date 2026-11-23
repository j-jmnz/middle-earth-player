import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data build from data/cards and data/scenarios (the-hobbit). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"131059:shadow:1","cardCode":"131059","lines":["131059:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker"}]},
  {"id":"132020:constant:1","cardCode":"132020","lines":["132020:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}}]},
  {"id":"132022:constant:1","cardCode":"132022","lines":["132022:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}}]},
  {"id":"132022:constant:2","cardCode":"132022","lines":["132022:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"132023:constant:1","cardCode":"132023","lines":["132023:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}}]},
  {"id":"132024:constant:1","cardCode":"132024","lines":["132024:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}}]},
  {"id":"132025:travel:1","cardCode":"132025","lines":["132025:A:2"],"timing":"travel","instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":"142006"}}]},
  {"id":"132070:whenRevealed:1","cardCode":"132070","lines":["132070:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":"132025"}]},
  {"id":"905504:shadow:1","cardCode":"905504","lines":["905504:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker","when":{"kind":"not","condition":{"kind":"matches","card":"attacker","pick":{"type":"enemy","control":"any","trait":"Troll"}}}},{"verb":"ModifyStat","stat":"attack","amount":3,"until":"endOfAttack","target":"attacker","when":{"kind":"matches","card":"attacker","pick":{"type":"enemy","control":"any","trait":"Troll"}}}]},
  {"id":"905703:shadow:1","cardCode":"905703","lines":["905703:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]},
  {"id":"906007:shadow:1","cardCode":"906007","lines":["906007:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker"}]},
];
