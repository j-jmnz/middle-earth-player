import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TFoW player cards whose lines no template reads (data/cards/TFoW.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 19145 Radagast
  {"id":"19145:response:1","cardCode":"19145","lines":["19145:A:2"],"timing":"response","trigger":"played","eventSeat":"you","subject":{"type":"card","control":"you","trait":"Creature"},"instructions":[{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"endOfRound"}]},
  // 19146 Messenger Raven
  {"id":"19146:constant:1","cardCode":"19146","lines":["19146:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotAttack","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"cannotDefend","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  // 19148 Loyal Hound
  // 19149 The Great Hunt
  {"id":"19149:action:1","cardCode":"19149","lines":["19149:A:2"],"timing":"action","condition":{"kind":"phase","is":"Combat"},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","stagingOnly":true,"nonUnique":true}},{"verb":"Discard","target":{"kind":"picked"}}]},
  // 19150 Bywater Shirriff
  {"id":"19150:constant:1","cardCode":"19150","lines":["19150:A:1"],"timing":"constant","condition":{"kind":"count","pick":{"type":"enemy","control":"any","engaged":"you","aboveThreat":true},"min":1},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay"}]},
  // 19151 Gwaihir's Debt
  {"id":"19151:constant:1","cardCode":"19151","lines":["19151:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Istari"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Eagle"},"min":1}]}}]},
  {"id":"19151:action:1","cardCode":"19151","lines":["19151:A:2"],"timing":"action","instructions":[
    {"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"ally","traits":["Eagle","Istari"],"intoPlay":true}},
    {"verb":"MovePicked","to":"play"},
    {"verb":"ShuffleDeck"},
    {"verb":"Delay","until":"endOfRound","subject":"picked","instructions":[{"verb":"ReturnToHand","when":{"kind":"matches","card":"picked","inPlay":true}}]}]},
];

export const REPLACES: readonly string[] = [];
