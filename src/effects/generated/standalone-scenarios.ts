import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data build from data/cards and data/scenarios (standalone-scenarios). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"147021:shadow:1","cardCode":"147021","lines":["147021:A:3"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]},
  {"id":"50304:triggered:1","cardCode":"50304","lines":["50304:A:4"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"50305:constant:1","cardCode":"50305","lines":["50305:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"50602:whenRevealed:1","cardCode":"50602","lines":["50602:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":"50616"}]},
  {"id":"50609:constant:1","cardCode":"50609","lines":["50609:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":4,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"50612:action:1","cardCode":"50612","lines":["50612:A:3"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"Draw","amount":1,"who":"picked"}]},
  {"id":"50616:constant:1","cardCode":"50616","lines":["50616:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"50617:constant:1","cardCode":"50617","lines":["50617:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noPlayerAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"50618:constant:1","cardCode":"50618","lines":["50618:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noPlayerAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"50709:constant:1","cardCode":"50709","lines":["50709:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"50710:constant:1","cardCode":"50710","lines":["50710:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"50711:constant:1","cardCode":"50711","lines":["50711:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"50712:constant:1","cardCode":"50712","lines":["50712:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"50713:constant:1","cardCode":"50713","lines":["50713:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"50719:travel:1","cardCode":"50719","lines":["50719:A:3"],"timing":"travel","instructions":[{"verb":"RevealEncounter"}]},
];
