import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data build from data/cards and data/scenarios (the-hobbit). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"131001:triggered:1","cardCode":"131001","lines":["131001:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"131059:shadow:1","cardCode":"131059","lines":["131059:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker"}]},
  {"id":"132020:constant:1","cardCode":"132020","lines":["132020:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}}]},
  {"id":"132022:constant:1","cardCode":"132022","lines":["132022:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}}]},
  {"id":"132022:constant:2","cardCode":"132022","lines":["132022:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"132023:constant:1","cardCode":"132023","lines":["132023:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}}]},
  {"id":"132024:constant:1","cardCode":"132024","lines":["132024:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}}]},
  {"id":"132025:travel:1","cardCode":"132025","lines":["132025:A:2"],"timing":"travel","instructions":[{"verb":"Exhaust","target":{"kind":"byName","name":"Bilbo Baggins"}}]},
  {"id":"132070:whenRevealed:1","cardCode":"132070","lines":["132070:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":"132025"}]},
];
