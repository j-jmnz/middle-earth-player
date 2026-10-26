import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TRG player cards whose lines no template reads (data/cards/TRG.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 04001 Elrohir
  {"id":"04001:constant:1","cardCode":"04001","lines":["04001:A:1"],"timing":"constant","condition":{"kind":"count","pick":{"type":"character","control":"any","names":["Elladan"]},"min":1},"instructions":[{"verb":"ModifyStat","stat":"defense","amount":2,"until":"whileSourceInPlay"}]},
  {"id":"04001:response:1","cardCode":"04001","lines":["04001:A:2"],"timing":"response","trigger":"declaredDefender","subject":"self","cost":{"kind":"resources","amount":1,"from":"self"},"instructions":[{"verb":"Ready"}]},
  // 04003 Timely Aid (line 1 is Secrecy). The revealed cards that are not put into play go back with the shuffle.
  {"id":"04003:action:1","cardCode":"04003","lines":["04003:A:2"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"ally","intoPlay":true}},{"verb":"MovePicked","to":"play"},{"verb":"ShuffleDeck"}]},
  // 04005 Keeping Count (line 1 is the generated 04005:constant:1)
  {"id":"04005:forced:1","cardCode":"04005","lines":["04005:A:3"],"timing":"forced","trigger":"attackDestroyed","subject":"host","instructions":[{"verb":"AddResources","amount":1,"to":"self"}]},
];

export const REPLACES: readonly string[] = [];
