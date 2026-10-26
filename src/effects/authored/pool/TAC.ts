import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TAC player cards whose lines no template reads (data/cards/TAC.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 08137 Erkenbrand (line 1 is the Sentinel keyword). The Response he gains is his while he is the declared defender.
  {"id":"08137:response:1","cardCode":"08137","lines":["08137:A:2"],"timing":"response","trigger":"shadowPending","condition":{"kind":"matches","card":"self","pick":{"type":"character","control":"any","defending":true}},"cost":{"kind":"damageSelf","amount":1},"instructions":[{"verb":"CancelEffect"}]},
  // 08139 The Day's Rising (line 2 open: nothing tracks that the defender took no damage in that attack)
  {"id":"08139:constant:1","cardCode":"08139","lines":["08139:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","keyword":"sentinel"}]}]},
  // 08141 Booming Ent
  {"id":"08141:constant:1","cardCode":"08141","lines":["08141:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"},{"verb":"EntersPlayExhausted"}]},
  {"id":"08141:constant:2","cardCode":"08141","lines":["08141:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"count":{"type":"character","control":"you","trait":"Ent","damaged":true}},"until":"whileSourceInPlay"}]},
  // 08143 Shadows Give Way
  {"id":"08143:action:1","cardCode":"08143","lines":["08143:A:2"],"timing":"action","instructions":[{"verb":"Each","pick":{"type":"enemy","control":"any","hasShadow":true},"instructions":[{"verb":"DiscardShadow"}]}]},
  // 08144 Don't Be Hasty!
  {"id":"08144:response:1","cardCode":"08144","lines":["08144:A:1"],"timing":"response","trigger":"encounterRevealed","cost":{"kind":"playEvent"},"condition":{"kind":"canPick","pick":{"type":"character","control":"any","committed":true}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","committed":true}},{"verb":"Ready","target":"picked"},{"verb":"RemoveFromQuest"}]},
  // 08145 Waters of Nimrodel (line 1 is the Doomed keyword)
  {"id":"08145:action:1","cardCode":"08145","lines":["08145:A:2"],"timing":"action","instructions":[{"verb":"Each","pick":{"type":"character","control":"any"},"instructions":[{"verb":"Heal","all":true,"target":"picked"}]}]},
  // 08146 Treebeard (line 1 open: his own resource collection and its Ent-only spending)
  {"id":"08146:action:1","cardCode":"08146","lines":["08146:A:2"],"timing":"action","cost":{"kind":"resources","amount":2,"from":"self"},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","trait":"Ent","state":"exhausted"}},{"verb":"Ready","target":"picked"}]},
];

export const REPLACES: readonly string[] = [];
