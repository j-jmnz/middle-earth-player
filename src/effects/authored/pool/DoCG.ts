import type { Effect } from "../../../catalog/boundary.ts";

// Records for the DoCG player cards whose lines no template reads (data/cards/DoCG.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
//
// An event with an Action and a Valour Action resolves one of them. The engine runs every Action record of an event whose
// condition holds, so both lines are one record that chooses between them (17113, 17118).
export const RECORDS: readonly Effect[] = [
  // 17109 Folco Boffin
  {"id":"17109:action:1","cardCode":"17109","lines":["17109:A:2"],"timing":"action","limit":"oncePerGame","cost":{"kind":"discardSelf"},"instructions":[{"verb":"LowerThreat","amount":7,"who":"actor"}]},
  // 17110 Knight of Dale
  {"id":"17110:action:1","cardCode":"17110","lines":["17110:A:1"],"timing":"action","limit":"oncePerRound","cost":{"kind":"resources","amount":1,"sphere":"leadership"},"instructions":[{"verb":"Ready"}]},
  {"id":"17110:action:2","cardCode":"17110","lines":["17110:A:2"],"timing":"action","limit":"oncePerRound","condition":{"kind":"threat","min":40,"valour":true},"instructions":[{"verb":"Ready"}]},
  // 17111 Diligent Noble
  {"id":"17111:response:1","cardCode":"17111","lines":["17111:A:3"],"timing":"response","trigger":"played","subject":"self","instructions":[{"verb":"Draw","amount":1}]},
  // 17113 Fierce Defense: the Combat Action deals 3 damage, the Valour Action (any phase) discards the enemy.
  {"id":"17113:action:1","cardCode":"17113","lines":["17113:A:1","17113:A:2"],"timing":"action","condition":{"kind":"any","conditions":[{"kind":"phase","is":"Combat"},{"kind":"threat","min":40,"valour":true}]},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"you","nonUnique":true}},{"verb":"Choose","who":"actor","options":[{"id":"damage","requires":{"kind":"phase","is":"Combat"},"instructions":[{"verb":"DamageCard","amount":3}]},{"id":"valour","requires":{"kind":"threat","min":40,"valour":true},"instructions":[{"verb":"Discard","target":{"kind":"picked"}}]}]}]},
  // 17114 Eregion Survivor
  {"id":"17114:constant:1","cardCode":"17114","lines":["17114:A:1"],"timing":"constant","condition":{"kind":"not","condition":{"kind":"handHasCard"}},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay"}]},
  // 17115 Heirs of Earendil: two different unique characters, one Noldor and one Dúnedain (at least 2 of either trait
  // between them).
  {"id":"17115:constant:1","cardCode":"17115","lines":["17115:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Noldor"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Dúnedain"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"traits":["Noldor","Dúnedain"]},"min":2}]}}]},
  {"id":"17115:action:1","cardCode":"17115","lines":["17115:A:2"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"location","control":"any","stagingOnly":true,"nonUnique":true}},{"verb":"RaiseThreat","amount":{"stat":"questPoints","of":"picked","printed":true},"who":"actor"},{"verb":"Discard","target":{"kind":"picked"}}]},
  // 17116 Leaflock
  {"id":"17116:constant:1","cardCode":"17116","lines":["17116:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"17116:constant:2","cardCode":"17116","lines":["17116:A:2"],"timing":"constant","instructions":[{"verb":"EntersPlayExhausted"}]},
  {"id":"17116:constant:3","cardCode":"17116","lines":["17116:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":{"count":{"type":"character","control":"you","trait":"Ent","damaged":true},"limit":4},"until":"whileSourceInPlay"}]},
  // 17118 Open the Armory: the Action searches 10 cards for the hand, the Valour Action 5 cards to put into play.
  {"id":"17118:action:1","cardCode":"17118","lines":["17118:A:1","17118:A:2"],"timing":"action","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"search","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":10,"cardType":"attachment","traits":["Weapon","Armor"]}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},{"id":"valour","requires":{"kind":"threat","min":40,"valour":true},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"attachment","traits":["Weapon","Armor"],"intoPlay":true}},{"verb":"Pick","pick":{"type":"character","control":"any","hostForPicked":true}},{"verb":"AttachPicked"},{"verb":"ShuffleDeck"}]}]}]},
];

export const REPLACES: readonly string[] = [];
