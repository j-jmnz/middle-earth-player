import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data build from data/cards and data/scenarios (the-return-of-the-king). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"145013:constant:1","cardCode":"145013","lines":["145013:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character","name":"Aragorn"}}]},
  {"id":"145014:setup:1","cardCode":"145014","lines":["145014:A:3"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"145014:constant:1","cardCode":"145014","lines":["145014:A:4"],"timing":"constant","instructions":[{"verb":"GrantTrait","trait":"Rohan"}]},
  {"id":"145015:setup:1","cardCode":"145015","lines":["145015:A:2"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"145015:constant:1","cardCode":"145015","lines":["145015:A:3"],"timing":"constant","instructions":[{"verb":"GrantTrait","trait":"Gondor"}]},
  {"id":"145022:shadow:1","cardCode":"145022","lines":["145022:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker"}]},
  {"id":"145036:shadow:1","cardCode":"145036","lines":["145036:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker","when":{"kind":"matches","card":"activeLocation","pick":{"type":"location","control":"any","trait":"Ship"}}}]},
  {"id":"145037:constant:1","cardCode":"145037","lines":["145037:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"145062:setup:1","cardCode":"145062","lines":["145062:A:1"],"timing":"setup","instructions":[{"verb":"AddToStaging","code":"145062"}]},
  {"id":"145062:constant:1","cardCode":"145062","lines":["145062:A:2"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"Restrict","what":"attach","exceptTrait":"Morgul"}]},
  {"id":"146002:triggered:1","cardCode":"146002","lines":["146002:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"146021:constant:1","cardCode":"146021","lines":["146021:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"146032:constant:1","cardCode":"146032","lines":["146032:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"Restrict","what":"attach","exceptTrait":"Morgul"}]},
  {"id":"146033:constant:1","cardCode":"146033","lines":["146033:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"146050:constant:1","cardCode":"146050","lines":["146050:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"Restrict","what":"attach","exceptTrait":"Morgul"}]},
  {"id":"146062:shadow:1","cardCode":"146062","lines":["146062:A:3"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ImmediateAttack"}]}]},
  {"id":"146065:setup:1","cardCode":"146065","lines":["146065:A:1"],"timing":"setup","instructions":[{"verb":"AttachToRingBearer","code":"146065"}]},
  {"id":"146065:constant:1","cardCode":"146065","lines":["146065:A:2"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"Restrict","what":"heroLimit"}]},
  {"id":"146065:forced:1","cardCode":"146065","lines":["146065:A:2"],"timing":"forced","trigger":"firstPlayerTokenPassed","instructions":[{"verb":"TransferHost","who":"firstPlayer"}]},
  {"id":"146065:triggered:1","cardCode":"146065","lines":["146065:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
];
