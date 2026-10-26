import type { Effect } from "../../../catalog/boundary.ts";

// Records for the AoO player cards whose lines no template reads (data/cards/AoO.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 06081 Faramir
  {"id":"06081:constant:1","cardCode":"06081","lines":["06081:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"count":{"type":"enemy","control":"any","stagingOnly":true}},"until":"whileSourceInPlay"}]},
  // 06082 Sword of Morthond
  {"id":"06082:constant:1","cardCode":"06082","lines":["06082:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"ally","control":"any","trait":"Gondor"}]}]},
  {"id":"06082:constant:2","cardCode":"06082","lines":["06082:A:2"],"timing":"constant","instructions":[{"verb":"GrantTrait","trait":"Outlands"}]},
  // 06083 Men of the West: X is what the player paid.
  {"id":"06083:action:1","cardCode":"06083","lines":["06083:A:1"],"timing":"action","instructions":[{"verb":"Repeat","times":{"x":true},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","from":"discard","trait":"Outlands"}},{"verb":"MovePicked","to":"hand"}]}]},
  // 06085 Gondorian Fire: the resources are counted after the one spent.
  {"id":"06085:constant:1","cardCode":"06085","lines":["06085:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","traits":["Gondor","Dúnedain"]}]}]},
  {"id":"06085:action:1","cardCode":"06085","lines":["06085:A:2"],"timing":"action","limit":"oncePerPhase","cost":{"kind":"resources","amount":1,"from":"host"},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"stat":"resources","of":"host"},"until":"endOfPhase","target":"host"}]},
  // 06086 Pelargir Shipwright
  {"id":"06086:constant:1","cardCode":"06086","lines":["06086:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":{"count":{"type":"hero","control":"you","printedIcon":"spirit"}},"until":"whileSourceInPlay"}]},
  // 06087 Map of Earnil
  {"id":"06087:constant:2","cardCode":"06087","lines":["06087:A:2"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":{"count":{"type":"hero","control":"you","printedIcon":"spirit"}}}]},
  // 06088 Ranger Bow
  {"id":"06088:action:1","cardCode":"06088","lines":["06088:A:3"],"timing":"action","cost":[{"kind":"exhaustSelf"},{"kind":"exhaustHost"}],"condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","stagingOnly":true}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","stagingOnly":true}},{"verb":"DamageCard","amount":1}]},
  // 06089 Forest Patrol
  {"id":"06089:constant:1","cardCode":"06089","lines":["06089:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"count","pick":{"type":"character","control":"you","trait":"Ranger"},"min":1}}]},
  {"id":"06089:action:1","cardCode":"06089","lines":["06089:A:2"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"hasAttachment":{"trait":"Trap"}}},{"verb":"DamageCard","amount":3}]},
];

export const REPLACES: readonly string[] = [];
