import type { Effect } from "../../../catalog/boundary.ts";

// Records for the CoC player cards whose lines no template reads (data/cards/CoC.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 12142 Súlien. The resource is the cost; exhausting Súlien is the effect, so a ready Súlien is needed for it to change the
  // game (rr.triggered-ability), and the Threat change follows it ("Then").
  {"id":"12142:action:1","cardCode":"12142","lines":["12142:A:1"],"timing":"action","anyPlayer":true,"cost":{"kind":"resources","amount":1,"sphere":"lore"},"condition":{"kind":"matches","card":"self","pick":{"type":"ally","control":"any","state":"ready"}},"instructions":[{"verb":"Exhaust"},{"verb":"ModifyStat","stat":"threat","amount":-1,"until":"endOfPhase","holders":{"type":"location","control":"any","stagingOnly":true}}]},
  // 12144 Guardian of Ithilien
  {"id":"12144:response:1","cardCode":"12144","lines":["12144:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"hasEngaged"},"instructions":[{"verb":"ReturnToStaging","target":{"kind":"engagedEnemies","who":"actor","pick":"choose"}}]},
  // 12146 Prince of Dol Amroth. Outlands allies belong to the four spheres of influence (a neutral card belongs to none), so
  // "4 different spheres" is one of each. The extra resource only counts for a hero (interpret.ts, the resource phase).
  {"id":"12146:constant:1","cardCode":"12146","lines":["12146:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character","name":"Prince Imrahil"}}]},
  {"id":"12146:constant:2","cardCode":"12146","lines":["12146:A:2"],"timing":"constant","instructions":[{"verb":"GrantTrait","trait":"Outlands"}]},
  {"id":"12146:constant:3","cardCode":"12146","lines":["12146:A:3"],"timing":"constant","condition":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"ally","control":"you","trait":"Outlands","sphere":"leadership"},"min":1},{"kind":"count","pick":{"type":"ally","control":"you","trait":"Outlands","sphere":"tactics"},"min":1},{"kind":"count","pick":{"type":"ally","control":"you","trait":"Outlands","sphere":"spirit"},"min":1},{"kind":"count","pick":{"type":"ally","control":"you","trait":"Outlands","sphere":"lore"},"min":1}]},"instructions":[{"verb":"ModifyStat","stat":"extraResource","amount":1,"until":"whileSourceInPlay","target":"host","when":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any"}}}]},
];

export const REPLACES: readonly string[] = [];
