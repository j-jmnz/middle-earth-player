import type { Effect } from "../../../catalog/boundary.ts";

// Records for the CatC player cards whose lines no template reads (data/cards/CatC.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 02026 Dúnedain Warning. The new host is chosen among the heroes the card may be attached to; its current host is among
  // them (no filter leaves out the source's host), and choosing it moves nothing.
  {"id":"02026:constant:2","cardCode":"02026","lines":["02026:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"02026:action:1","cardCode":"02026","lines":["02026:A:3"],"timing":"action","cost":{"kind":"resources","amount":1,"from":"host"},"instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"you","attachedTo":"host","names":["Dúnedain Warning"]}},{"verb":"Pick","pick":{"type":"card","control":"any","hostForPicked":true}},{"verb":"AttachPicked"}]},
  // 02027 Second Breakfast
  {"id":"02027:action:1","cardCode":"02027","lines":["02027:A:1"],"timing":"action","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","cardType":"attachment","topmost":true}},{"verb":"MovePicked","to":"hand"}]}]},
  // 02028 Beorning Beekeeper
  {"id":"02028:action:1","cardCode":"02028","lines":["02028:A:1"],"timing":"action","cost":{"kind":"discardSelf"},"instructions":[{"verb":"Each","pick":{"type":"enemy","control":"any","stagingOnly":true},"instructions":[{"verb":"DamageCard","amount":1}]}]},
  // 02029 Born Aloft. Discarding it first would clear its host, so the ally goes back first and Born Aloft is discarded after;
  // nothing happens between the two.
  {"id":"02029:constant:1","cardCode":"02029","lines":["02029:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"ally","control":"any"}]}]},
  {"id":"02029:action:1","cardCode":"02029","lines":["02029:A:2"],"timing":"action","instructions":[{"verb":"ReturnToHand","target":"host"},{"verb":"Discard","target":{"kind":"self"},"when":{"kind":"matches","card":"self","inPlay":true}}]},
  // 02030 Éomund
  {"id":"02030:response:1","cardCode":"02030","lines":["02030:A:1"],"timing":"response","trigger":"leftPlay","subject":"self","instructions":[{"verb":"Each","pick":{"type":"character","control":"any","trait":"Rohan"},"instructions":[{"verb":"Ready","target":"picked"}]}]},
  // 02031 Nor am I a Stranger
  {"id":"02031:constant:2","cardCode":"02031","lines":["02031:A:2"],"timing":"constant","instructions":[{"verb":"GrantTrait","trait":"Rohan"}]},
  // 02032 Longbeard Map-Maker
  {"id":"02032:action:1","cardCode":"02032","lines":["02032:A:1"],"timing":"action","cost":{"kind":"resources","amount":1,"sphere":"lore"},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase"}]},
  // 02033 A Burning Brand
  {"id":"02033:response:1","cardCode":"02033","lines":["02033:A:2"],"timing":"response","trigger":"shadowPending","cost":{"kind":"exhaustSelf"},"condition":{"kind":"matches","card":"host","pick":{"type":"character","control":"any","defending":true}},"instructions":[{"verb":"CancelEffect"}]},
  // 02034 Song of Wisdom
  {"id":"02034:constant:2","cardCode":"02034","lines":["02034:A:2"],"timing":"constant","instructions":[{"verb":"GrantIcon","sphere":"lore"}]},
];

export const REPLACES: readonly string[] = [];
