import type { Effect } from "../../../catalog/boundary.ts";

// Records for the HoN player cards whose lines no template reads (data/cards/HoN.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 05002 Boromir
  {"id":"05002:constant:1","cardCode":"05002","lines":["05002:A:1"],"timing":"constant","condition":{"kind":"matches","card":"self","pick":{"type":"hero","control":"any","hasResources":true}},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","holders":{"type":"ally","control":"any","trait":"Gondor"}}]},
  // 05003 Errand-rider. MoveResources moves from the card picked before the last (the hero you control) to the last.
  {"id":"05003:action:1","cardCode":"05003","lines":["05003:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"condition":{"kind":"canPick","pick":{"type":"hero","control":"you","hasResources":true}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you","hasResources":true}},{"verb":"Pick","pick":{"type":"hero","control":"any","different":true}},{"verb":"MoveResources","amount":1}]},
  // 05004 Citadel Custodian
  {"id":"05004:constant:1","cardCode":"05004","lines":["05004:A:1"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":{"count":{"type":"ally","control":"any","trait":"Gondor"}}}]},
  // 05006 Wealth of Gondor
  {"id":"05006:action:1","cardCode":"05006","lines":["05006:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any","trait":"Gondor"}},{"verb":"AddResources","amount":1,"to":"picked"}]},
  // 05008 Behind Strong Walls
  {"id":"05008:action:1","cardCode":"05008","lines":["05008:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","trait":"Gondor","defending":true}},{"verb":"Ready","target":"picked"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfPhase","target":"picked"}]},
  // 05009 Spear of the Citadel (lines 1 and 2 are Restricted and the generated 05009:constant:1). The attacking enemy is the
  // event's other card.
  {"id":"05009:response:1","cardCode":"05009","lines":["05009:A:3"],"timing":"response","trigger":"declaredDefender","subject":"host","instructions":[{"verb":"DamageCard","amount":1,"target":"other"}]},
  // 05010 Damrod. Lowering threat by 0 would change nothing (rr.triggered-ability).
  {"id":"05010:action:1","cardCode":"05010","lines":["05010:A:1"],"timing":"action","cost":{"kind":"discardSelf"},"condition":{"kind":"count","pick":{"type":"enemy","control":"any","stagingOnly":true},"min":1},"instructions":[{"verb":"LowerThreat","amount":{"count":{"type":"enemy","control":"any","stagingOnly":true}},"who":"actor"}]},
  // 05011 Light the Beacons. An event's lasting effect holds for the characters in play when it resolves (rr.event-cards).
  {"id":"05011:action:1","cardCode":"05011","lines":["05011:A:1"],"timing":"action","instructions":[{"verb":"ModifyStat","stat":"defense","amount":2,"until":"endOfRound","holders":{"type":"character","control":"any"}},{"verb":"ModifyStat","stat":"noExhaustDefend","amount":1,"until":"endOfRound","holders":{"type":"character","control":"any"}}]},
  // 05013 Blood of Númenor. The cost is paid before the resources left in the pool are counted.
  {"id":"05013:constant:1","cardCode":"05013","lines":["05013:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","traits":["Gondor","Dúnedain"]}]}]},
  {"id":"05013:action:1","cardCode":"05013","lines":["05013:A:2"],"timing":"action","limit":"oncePerPhase","cost":{"kind":"resources","amount":1,"from":"host"},"instructions":[{"verb":"ModifyStat","stat":"defense","amount":{"stat":"resources","of":"host"},"until":"endOfPhase","target":"host"}]},
  // 05014 Hunter of Lamedon. The top card is looked at as the one card a Pick of the top 1 offers.
  {"id":"05014:response:1","cardCode":"05014","lines":["05014:A:1"],"timing":"response","trigger":"played","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":1}},{"verb":"MovePicked","to":"hand","when":{"kind":"matches","card":"picked","pick":{"type":"card","control":"any","trait":"Outlands"}}},{"verb":"DiscardPicked","when":{"kind":"not","condition":{"kind":"matches","card":"picked","pick":{"type":"card","control":"any","trait":"Outlands"}}}}]},
  // 05017 Ranger Spikes (its Trap lines, 05017:A:1 and A:2, are open)
  {"id":"05017:constant:1","cardCode":"05017","lines":["05017:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noEngagementChecks","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"threat","amount":-2,"until":"whileSourceInPlay","target":"host"}]},
  // 05018 Envoy of Pelargir
  {"id":"05018:response:1","cardCode":"05018","lines":["05018:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"canPick","pick":{"type":"hero","control":"any","traits":["Gondor","Noble"]}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any","traits":["Gondor","Noble"]}},{"verb":"AddResources","amount":1,"to":"picked"}]},
];

export const REPLACES: readonly string[] = [];
