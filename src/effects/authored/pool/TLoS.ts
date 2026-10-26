import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TLoS player cards whose lines no template reads (data/cards/TLoS.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 22108 Gwaihir (line 1 is keywords)
  {"id":"22108:constant:1","cardCode":"22108","lines":["22108:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"doesNotReady","amount":1,"until":"whileSourceInPlay"}]},
  // 22109 Hobbit Archer (line 1 is the ranged keyword)
  {"id":"22109:constant:1","cardCode":"22109","lines":["22109:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","when":{"kind":"versusHighEngagement","role":"attacking"}}]},
  // 22110 Red Book of Westmarch (line 1 is the generated 22110:constant:1)
  {"id":"22110:constant:2","cardCode":"22110","lines":["22110:A:2"],"timing":"constant","condition":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","committed":true}},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"any","trait":"Hobbit"}}]},
  {"id":"22110:response:1","cardCode":"22110","lines":["22110:A:3"],"timing":"response","trigger":"questSucceeded","eventSeat":"you","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"AddResources","amount":1,"to":"host"}]},
  // 22112 Song of Healing (line 1 is the generated 22112:constant:1). The player who triggers it discards from their own hand.
  {"id":"22112:action:1","cardCode":"22112","lines":["22112:A:2"],"timing":"action","anyPlayer":true,"condition":{"kind":"handHasCard"},"instructions":[{"verb":"DiscardFromHand","amount":1},{"verb":"Heal","amount":1,"target":"host"}]},
  // 22113 Eagle Emissary
  {"id":"22113:constant:1","cardCode":"22113","lines":["22113:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  // 22115 Spare Pipe (line 1 is the generated 22115:constant:1)
  {"id":"22115:constant:2","cardCode":"22115","lines":["22115:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hitPoints","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"22115:response:1","cardCode":"22115","lines":["22115:A:3"],"timing":"response","trigger":"played","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"event"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
  // 22117 Wilyador (line 1 is keywords)
  {"id":"22117:constant:1","cardCode":"22117","lines":["22117:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
];

export const REPLACES: readonly string[] = [];
