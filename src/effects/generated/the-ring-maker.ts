import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data build from data/cards and data/scenarios (the-ring-maker). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"07024:constant:1","cardCode":"07024","lines":["07024:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"07036:shadow:1","cardCode":"07036","lines":["07036:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ImmediateAttack"}]}]},
  {"id":"07038:shadow:1","cardCode":"07038","lines":["07038:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker"}]},
  {"id":"07039:shadow:1","cardCode":"07039","lines":["07039:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ImmediateAttack"}]}]},
  {"id":"07046:shadow:1","cardCode":"07046","lines":["07046:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker"}]},
  {"id":"07048:shadow:1","cardCode":"07048","lines":["07048:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ImmediateAttack"}]}]},
  {"id":"08040:constant:1","cardCode":"08040","lines":["08040:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"Restrict","what":"attach","exceptTrait":"Key"}]},
  {"id":"08041:constant:1","cardCode":"08041","lines":["08041:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"Restrict","what":"attach","exceptTrait":"Key"}]},
  {"id":"08042:constant:1","cardCode":"08042","lines":["08042:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"Restrict","what":"attach","exceptTrait":"Key"}]},
  {"id":"08050:constant:1","cardCode":"08050","lines":["08050:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"08068:triggered:1","cardCode":"08068","lines":["08068:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"08077:travel:1","cardCode":"08077","lines":["08077:A:1"],"timing":"travel","instructions":[{"verb":"SearchMove","trait":"Spy","type":"enemy","to":"staging"},{"verb":"ShuffleEncounterDeck"}]},
  {"id":"08102:triggered:1","cardCode":"08102","lines":["08102:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"08103:constant:1","cardCode":"08103","lines":["08103:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"08104:constant:1","cardCode":"08104","lines":["08104:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"08110:shadow:1","cardCode":"08110","lines":["08110:A:3"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ImmediateAttack"}]}]},
  {"id":"08127:constant:1","cardCode":"08127","lines":["08127:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"lossOnLeavingPlay","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"08150:triggered:1","cardCode":"08150","lines":["08150:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
];
