import type { Effect } from "../../../catalog/boundary.ts";

// Records for the NiE player cards whose lines no template reads (data/cards/NiE.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 08084 Mablung
  {"id":"08084:response:1","cardCode":"08084","lines":["08084:A:1"],"timing":"response","trigger":"engaged","eventSeat":"you","limit":"oncePerPhase","instructions":[{"verb":"AddResources","amount":1,"to":"self"}]},
  // 08087 Galadhon Archer: an enemy not engaged with you is in the staging area or engaged with another player, two filters.
  {"id":"08087:response:1","cardCode":"08087","lines":["08087:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"any","conditions":[{"kind":"canPick","pick":{"type":"enemy","control":"any","stagingOnly":true}},{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"other"}}]},"instructions":[{"verb":"Choose","who":"actor","options":[{"id":"staging","requires":{"kind":"canPick","pick":{"type":"enemy","control":"any","stagingOnly":true}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","stagingOnly":true}},{"verb":"DamageCard","amount":1}]},{"id":"engagedOther","requires":{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"other"}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"other"}},{"verb":"DamageCard","amount":1}]}]}]},
  // 08088 Bow of the Galadhrim.
  {"id":"08088:constant:1","cardCode":"08088","lines":["08088:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","trait":"Silvan","keyword":"ranged"}]}]},
  // 08090 Island Amid Perils: the ally is returned as the cost, and X is its printed cost.
  {"id":"08090:action:1","cardCode":"08090","lines":["08090:A:1"],"timing":"action","condition":{"kind":"canPick","pick":{"type":"ally","control":"you","trait":"Silvan"}},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","trait":"Silvan"}},{"verb":"ReturnToHand"},{"verb":"LowerThreat","amount":{"stat":"cost","of":"picked"},"who":"actor"}]},
  // 08093 Defender of the West. An objective
  // ally is not of the ally card type.
  {"id":"08093:constant:1","cardCode":"08093","lines":["08093:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"ally","control":"any","unique":true}]}]},
];

export const REPLACES: readonly string[] = [];
