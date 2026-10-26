import type { Effect } from "../../../catalog/boundary.ts";

// Records for the CS player cards whose lines no template reads (data/cards/CS.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 08112 Galadriel. Line 1 holds two rules: she cannot quest, attack or defend; and an ally you control does not exhaust to
  // commit to the quest during the round it enters play, which is given to the ally as it enters play, until the end of that round.
  {"id":"08112:constant:1","cardCode":"08112","lines":["08112:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotQuest","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"cannotAttack","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"cannotDefend","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"08112:triggered:1","cardCode":"08112","lines":["08112:A:1"],"timing":"triggered","trigger":"enteredPlay","subject":{"type":"ally","control":"you"},"instructions":[{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"endOfRound","target":"subject"}]},
  {"id":"08112:action:1","cardCode":"08112","lines":["08112:A:2"],"timing":"action","limit":"oncePerRound","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"LowerThreat","amount":1,"who":"picked"},{"verb":"Draw","amount":1,"who":"picked"}]},
  // 08113 Heir of Mardil
  {"id":"08113:response:1","cardCode":"08113","lines":["08113:A:2"],"timing":"response","trigger":"resourcesAdded","subject":"host","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Ready","target":"host"}]},
  // 08114 Orophin (line 1 is Ranged)
  {"id":"08114:response:1","cardCode":"08114","lines":["08114:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","cardType":"ally","trait":"Silvan"}},{"verb":"MovePicked","to":"hand"}]},
  // 08116 Charge of the Rohirrim
  {"id":"08116:action:1","cardCode":"08116","lines":["08116:A:1"],"timing":"action","instructions":[{"verb":"ModifyStat","stat":"attack","amount":3,"until":"endOfPhase","holders":{"type":"character","control":"any","trait":"Rohan","hasAttachment":{"trait":"Mount"}}}]},
  // 08117 Galadriel's Handmaiden
  {"id":"08117:response:1","cardCode":"08117","lines":["08117:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"LowerThreat","amount":1,"who":"picked"}]},
  // 08118 Mirror of Galadriel
  {"id":"08118:action:1","cardCode":"08118","lines":["08118:A:2"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":10}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"},{"verb":"DiscardRandomFromHand"}]},
  // 08119 Wandering Ent
  {"id":"08119:constant:1","cardCode":"08119","lines":["08119:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"08119:constant:2","cardCode":"08119","lines":["08119:A:2"],"timing":"constant","instructions":[{"verb":"EntersPlayExhausted"}]},
  // 08120 Cloak of Lórien: lines 1 and 2 are the one attachment rule.
  {"id":"08120:constant:1","cardCode":"08120","lines":["08120:A:1","08120:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character"},"hosts":[{"type":"character","control":"any","traits":["Noldor","Silvan"]}],"limitPerHost":true}]},
  {"id":"08120:constant:2","cardCode":"08120","lines":["08120:A:3"],"timing":"constant","instructions":[
    {"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host","when":{"kind":"not","condition":{"kind":"matches","card":"activeLocation","pick":{"type":"location","control":"any","trait":"Forest"}}}},
    {"verb":"ModifyStat","stat":"defense","amount":2,"until":"whileSourceInPlay","target":"host","when":{"kind":"matches","card":"activeLocation","pick":{"type":"location","control":"any","trait":"Forest"}}}]},
  // 08121 Nenya
  {"id":"08121:constant:1","cardCode":"08121","lines":["08121:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character","name":"Galadriel"}},{"verb":"GrantIcon","sphere":"lore"}]},
  // Galadriel is picked first (she is unique: one candidate, taken without asking) so that "another character" leaves her out.
  {"id":"08121:action:1","cardCode":"08121","lines":["08121:A:2"],"timing":"action","condition":{"kind":"phase","is":"Quest"},"cost":[{"kind":"exhaustSelf"},{"kind":"exhaustHost"}],"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","names":["Galadriel"]}},{"verb":"Pick","pick":{"type":"character","control":"any","different":true}},{"verb":"ModifyStat","stat":"willpower","amount":{"stat":"willpower","of":"host"},"until":"endOfPhase","target":"picked"}]},
];

export const REPLACES: readonly string[] = [];
