import type { Effect } from "../../../catalog/boundary.ts";

// Records for the RtM player cards whose lines no template reads (data/cards/RtM.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 02116 Dáin Ironfoot: every Dwarf character in play, Dáin too.
  {"id":"02116:constant:1","cardCode":"02116","lines":["02116:A:1"],"timing":"constant","condition":{"kind":"matches","card":"self","pick":{"type":"hero","control":"any","state":"ready"}},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"any","trait":"Dwarf"}},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"any","trait":"Dwarf"}}]},
  // 02117 Dúnedain Signal
  {"id":"02117:constant:2","cardCode":"02117","lines":["02117:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"sentinel","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 02118 Dawn Take You All: each player in turn may discard the shadow card of an enemy engaged with them.
  {"id":"02118:action:1","cardCode":"02118","lines":["02118:A:2"],"timing":"action","condition":{"kind":"phase","is":"Combat"},"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"discard","requires":{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"you","hasShadow":true}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"you","hasShadow":true}},{"verb":"DiscardShadow"}]},{"id":"pass","instructions":[]}]}]}]},
  // 02120 Support of the Eagles: the ally's stat is read when the effect resolves.
  {"id":"02120:action:1","cardCode":"02120","lines":["02120:A:2"],"timing":"action","cost":{"kind":"exhaustSelf"},"condition":{"kind":"canPick","pick":{"type":"ally","control":"any","trait":"Eagle"}},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"any","trait":"Eagle"}},{"verb":"Choose","who":"actor","options":[{"id":"attack","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"stat":"attack","of":"picked"},"until":"endOfPhase","target":"host"}]},{"id":"defense","instructions":[{"verb":"ModifyStat","stat":"defense","amount":{"stat":"defense","of":"picked"},"until":"endOfPhase","target":"host"}]}]}]},
  // 02122 Astonishing Speed
  {"id":"02122:action:1","cardCode":"02122","lines":["02122:A:1"],"timing":"action","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"endOfPhase","holders":{"type":"character","control":"any","trait":"Rohan"}}]},
];

export const REPLACES: readonly string[] = [];
