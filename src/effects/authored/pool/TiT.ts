import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TiT player cards whose lines no template reads (data/cards/TiT.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 08059 Gwaihir
  {"id":"08059:constant:1","cardCode":"08059","lines":["08059:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"08059:response:1","cardCode":"08059","lines":["08059:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[
    {"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","cardType":"ally","trait":"Eagle","intoPlay":true}},
    {"verb":"MovePicked","to":"play"},
    {"verb":"Delay","until":"endOfRound","subject":"picked","instructions":[{"verb":"ReturnToHand","when":{"kind":"matches","card":"picked","inPlay":true}}]}]},
  // 08063 Galadhrim Minstrel
  {"id":"08063:response:1","cardCode":"08063","lines":["08063:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"event"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
  // 08064 Lembas (line 2 is the generated 08064:constant:1, so line 1 takes constant:2). The discard is the last instruction,
  // not a discardSelf cost: a cost is paid before the effect resolves, and a discarded Lembas no longer has an attached hero
  // for `host` to name.
  {"id":"08064:constant:2","cardCode":"08064","lines":["08064:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"count","pick":{"type":"hero","control":"you","traits":["Noldor","Silvan"]},"min":1}}]},
  {"id":"08064:action:1","cardCode":"08064","lines":["08064:A:3"],"timing":"action","instructions":[{"verb":"Ready","target":"host"},{"verb":"Heal","amount":3,"target":"host"},{"verb":"Discard","target":{"kind":"self"}}]},
  // 08065 Defender of the Naith (line 1 is the sentinel keyword)
  {"id":"08065:response:1","cardCode":"08065","lines":["08065:A:2"],"timing":"response","trigger":"leftPlay","subject":{"type":"ally","control":"you","trait":"Silvan"},"instructions":[{"verb":"Ready"}]},
];

export const REPLACES: readonly string[] = [];
