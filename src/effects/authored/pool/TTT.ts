import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TTT player cards whose lines no template reads (data/cards/TTT.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 08025 Idraen: a location leaves play this way only when it is explored.
  {"id":"08025:response:1","cardCode":"08025","lines":["08025:A:1"],"timing":"response","trigger":"leftPlay","subject":{"type":"location","control":"any"},"instructions":[{"verb":"Ready"}]},
  // 08027 Feigned Voices: returning the Silvan ally is the cost.
  {"id":"08027:action:1","cardCode":"08027","lines":["08027:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Combat"},{"kind":"canPick","pick":{"type":"ally","control":"you","trait":"Silvan"}}]},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","trait":"Silvan"}},{"verb":"ReturnToHand","target":"picked"},{"verb":"BarAttack","scope":"any","until":"endOfPhase"}]},
  // 08028 Rúmil
  {"id":"08028:response:1","cardCode":"08028","lines":["08028:A:2"],"timing":"response","trigger":"played","subject":"self","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any"}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any"}},{"verb":"DamageCard","amount":{"count":{"type":"character","control":"you","keyword":"ranged"}}}]},
  // 08029 Elven Mail
  {"id":"08029:constant:1","cardCode":"08029","lines":["08029:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","traits":["Noldor","Silvan"]}]}]},
  {"id":"08029:constant:2","cardCode":"08029","lines":["08029:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hitPoints","amount":2,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"sentinel","amount":1,"until":"whileSourceInPlay","target":"host"}]},
];

export const REPLACES: readonly string[] = [];
