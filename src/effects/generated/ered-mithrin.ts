import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data:build from data/cards and data/scenarios (ered-mithrin). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"12176:setup:1","cardCode":"12176","lines":["12176:A:2"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"12177:setup:1","cardCode":"12177","lines":["12177:A:2"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"12177:constant:1","cardCode":"12177","lines":["12177:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"12178:setup:1","cardCode":"12178","lines":["12178:A:2"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"12178:constant:1","cardCode":"12178","lines":["12178:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"12179:setup:1","cardCode":"12179","lines":["12179:A:2"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"12179:constant:1","cardCode":"12179","lines":["12179:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"18020:constant:1","cardCode":"18020","lines":["18020:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noPlayerAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"18020:shadow:1","cardCode":"18020","lines":["18020:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker"}]},
  {"id":"18022:shadow:1","cardCode":"18022","lines":["18022:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]},
  {"id":"18042:constant:1","cardCode":"18042","lines":["18042:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"Restrict","what":"attach","exceptTrait":"Dragon"}]},
  {"id":"18049:constant:1","cardCode":"18049","lines":["18049:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noPlayerAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"18056:shadow:1","cardCode":"18056","lines":["18056:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker"}]},
  {"id":"18070:triggered:1","cardCode":"18070","lines":["18070:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"19013:constant:1","cardCode":"19013","lines":["19013:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noPlayerAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"19038:constant:1","cardCode":"19038","lines":["19038:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"Restrict","what":"attach","exceptTrait":"objective"}]},
  {"id":"19041:shadow:1","cardCode":"19041","lines":["19041:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]},
  {"id":"19098:constant:1","cardCode":"19098","lines":["19098:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"Restrict","what":"attach","exceptTrait":"objective"}]},
  {"id":"19143:constant:1","cardCode":"19143","lines":["19143:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}}]},
  {"id":"19143:constant:2","cardCode":"19143","lines":["19143:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"19143:constant:3","cardCode":"19143","lines":["19143:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"lossOnLeavingPlay","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"19144:constant:1","cardCode":"19144","lines":["19144:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}}]},
];
