import type { Effect } from "../../../catalog/boundary.ts";

// Records for the BoCD player cards whose lines no template reads (data/cards/BoCD.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 10115 Amarthiúl. Line 1 (a hero gaining a resource icon itself) is the record 10115:constant:1 in families/costs.ts.
  {"id":"10115:constant:2","cardCode":"10115","lines":["10115:A:2"],"timing":"constant","condition":{"kind":"count","pick":{"type":"enemy","control":"any","engaged":"you"},"min":2},"instructions":[{"verb":"ModifyStat","stat":"extraResource","amount":1,"until":"whileSourceInPlay"}]},
  // 10116 Guardian of Arnor (line 1 is the Sentinel keyword)
  {"id":"10116:constant:1","cardCode":"10116","lines":["10116:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"defense","amount":{"count":{"type":"enemy","control":"any","engaged":"you"}},"until":"whileSourceInPlay"}]},
  // 10118 Beechbone. X is read after the cost's damage is on him.
  {"id":"10118:constant:1","cardCode":"10118","lines":["10118:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"},{"verb":"EntersPlayExhausted"}]},
  {"id":"10118:response:1","cardCode":"10118","lines":["10118:A:2"],"timing":"response","trigger":"declaredAttacker","cost":{"kind":"damageSelf","amount":1},"instructions":[{"verb":"DamageCard","amount":{"stat":"damage","of":"self"},"target":"other"}]},
  // 10119 Hold Your Ground!
  {"id":"10119:action:1","cardCode":"10119","lines":["10119:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","keyword":"sentinel","state":"exhausted"}},{"verb":"Ready","target":"picked"}]},
  {"id":"10119:action:2","cardCode":"10119","lines":["10119:A:2"],"timing":"action","condition":{"kind":"threat","min":40,"valour":true},"instructions":[{"verb":"Each","pick":{"type":"character","control":"any","keyword":"sentinel"},"instructions":[{"verb":"Ready","target":"picked"}]}]},
  // 10120 Lindir: 3 minus the cards in hand.
  {"id":"10120:response:1","cardCode":"10120","lines":["10120:A:1"],"timing":"response","trigger":"enteredPlay","condition":{"kind":"count","pick":{"type":"card","control":"you","from":"hand"},"max":2},"instructions":[{"verb":"Draw","amount":{"hand":true,"times":-1,"plus":3}}]},
  // 10121 Lords of the Eldar. Played from the discard pile, it goes to the bottom of the deck instead of back to the discard pile.
  {"id":"10121:constant:1","cardCode":"10121","lines":["10121:A:1"],"timing":"constant","instructions":[{"verb":"PlayFromDiscard","only":true}]},
  {"id":"10121:action:1","cardCode":"10121","lines":["10121:A:2"],"timing":"action","instructions":[{"verb":"PutOnDeck","position":"bottom","target":"self"},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfRound","holders":{"type":"character","control":"any","trait":"Noldor"}},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfRound","holders":{"type":"character","control":"any","trait":"Noldor"}},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfRound","holders":{"type":"character","control":"any","trait":"Noldor"}}]},
];

export const REPLACES: readonly string[] = [];
