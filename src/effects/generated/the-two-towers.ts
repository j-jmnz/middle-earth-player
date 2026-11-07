import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data:build from data/cards and data/scenarios (the-two-towers). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"143019:setup:1","cardCode":"143019","lines":["143019:A:2"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"143023:constant:1","cardCode":"143023","lines":["143023:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"143045:shadow:1","cardCode":"143045","lines":["143045:A:3"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]},
  {"id":"144021:travel:1","cardCode":"144021","lines":["144021:A:2"],"timing":"travel","instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":"144076"}}]},
  {"id":"144022:travel:1","cardCode":"144022","lines":["144022:A:3"],"timing":"travel","instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":"144076"}}]},
  {"id":"144040:constant:1","cardCode":"144040","lines":["144040:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"144048:travel:1","cardCode":"144048","lines":["144048:A:2"],"timing":"travel","instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":"144076"}}]},
  {"id":"144052:setup:1","cardCode":"144052","lines":["144052:A:2"],"timing":"setup","instructions":[{"verb":"AttachToRingBearer","code":"144052"}]},
  {"id":"144053:constant:1","cardCode":"144053","lines":["144053:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"Restrict","what":"attach","exceptTrait":"Morgul"}]},
  {"id":"144056:shadow:1","cardCode":"144056","lines":["144056:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":3,"until":"endOfAttack","target":"attacker"}]},
  {"id":"144063:setup:1","cardCode":"144063","lines":["144063:A:1"],"timing":"setup","instructions":[{"verb":"AttachToRingBearer","code":"144063"}]},
  {"id":"144063:constant:1","cardCode":"144063","lines":["144063:A:2"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"Restrict","what":"heroLimit"}]},
  {"id":"144063:forced:1","cardCode":"144063","lines":["144063:A:2"],"timing":"forced","trigger":"firstPlayerTokenPassed","instructions":[{"verb":"TransferHost","who":"firstPlayer"}]},
  {"id":"144063:triggered:1","cardCode":"144063","lines":["144063:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
];
