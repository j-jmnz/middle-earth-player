import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TWH player cards whose lines no template reads (data/cards/TWH.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 19003 Squire's Helm. "Limit 1 per ally" is its own printed line, and the engine reads one AttachesTo per card.
  {"id":"19003:constant:1","cardCode":"19003","lines":["19003:A:1","19003:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"ally","control":"any"}],"limitPerHost":true}]},
  {"id":"19003:constant:2","cardCode":"19003","lines":["19003:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hitPoints","amount":2,"until":"whileSourceInPlay","target":"host"}]},
  // 19004 Beorning Skin-changer: the ally comes from the hand or the discard pile, one record for each.
  {"id":"19004:action:1","cardCode":"19004","lines":["19004:A:1"],"timing":"action","cost":{"kind":"discardSelf"},"condition":{"kind":"all","conditions":[{"kind":"phase","is":"Combat"},{"kind":"canPick","pick":{"type":"ally","control":"you","from":"hand","trait":"Beorning","minCost":3,"intoPlay":true}}]},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","from":"hand","trait":"Beorning","minCost":3,"intoPlay":true}},{"verb":"MovePicked","to":"play"}]},
  {"id":"19004:action:2","cardCode":"19004","lines":["19004:A:1"],"timing":"action","cost":{"kind":"discardSelf"},"condition":{"kind":"all","conditions":[{"kind":"phase","is":"Combat"},{"kind":"canPick","pick":{"type":"ally","control":"you","from":"discard","trait":"Beorning","minCost":3,"intoPlay":true}}]},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","from":"discard","trait":"Beorning","minCost":3,"intoPlay":true}},{"verb":"MovePicked","to":"play"}]},
  // 19006 Woodmen's Clearing
  {"id":"19006:constant:1","cardCode":"19006","lines":["19006:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"location","control":"any"}],"limitPerHost":true}]},
  {"id":"19006:response:1","cardCode":"19006","lines":["19006:A:2"],"timing":"response","trigger":"hostLeftPlay","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"Pick","pick":{"type":"player","control":"you","who":"firstPlayer"}},{"verb":"LowerThreat","amount":3,"who":"picked"}]},
  // 19009 Grey Cloak
  {"id":"19009:constant:1","cardCode":"19009","lines":["19009:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","spheres":["spirit"]},{"type":"character","control":"any","trait":"Scout"}],"limitPerHost":true}]},
  // 19010 The Arkenstone (line 2 is the generated 19010:constant:1)
  {"id":"19010:constant:2","cardCode":"19010","lines":["19010:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"you","unique":true}}]},
];

export const REPLACES: readonly string[] = [];
