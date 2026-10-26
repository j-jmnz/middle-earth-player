import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TotD player cards whose lines no template reads (data/cards/TotD.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 12057 Elfhelm
  {"id":"12057:constant:1","cardCode":"12057","lines":["12057:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","holders":{"type":"hero","control":"any","spheres":["spirit"],"hasAttachment":{"trait":"Mount"}}}]},
  {"id":"12057:constant:2","cardCode":"12057","lines":["12057:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","holders":{"type":"hero","control":"any","spheres":["tactics"],"hasAttachment":{"trait":"Mount"}}}]},
  {"id":"12057:constant:3","cardCode":"12057","lines":["12057:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","holders":{"type":"hero","control":"any","spheres":["leadership"],"hasAttachment":{"trait":"Mount"}}}]},
  // 12059 Armored Destrier (line 2 open: "after attached hero defends" has no trigger about the defender)
  {"id":"12059:constant:1","cardCode":"12059","lines":["12059:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","spheres":["leadership"]},{"type":"hero","control":"any","keyword":"sentinel"}]}]},
  // 12060 Déorwine (line 1 is the Sentinel keyword). The Response he gains is his while he is the declared defender.
  {"id":"12060:response:1","cardCode":"12060","lines":["12060:A:2"],"timing":"response","trigger":"shadowPending","anyPlayer":true,"condition":{"kind":"matches","card":"self","pick":{"type":"character","control":"any","defending":true}},"cost":{"kind":"resources","amount":1,"sphere":"leadership"},"instructions":[{"verb":"CancelEffect"}]},
  // 12061 Revealed in Wrath (line 2, a blank text box, stays open)
  {"id":"12061:constant:1","cardCode":"12061","lines":["12061:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"count","pick":{"type":"hero","control":"you","trait":"Noldor"},"min":1}}]},
  // 12062 Rhovanion Outrider: a location explored by the progress has left play.
  {"id":"12062:response:1","cardCode":"12062","lines":["12062:A:1"],"timing":"response","trigger":"committed","condition":{"kind":"canPick","pick":{"type":"location","control":"any","stagingOnly":true}},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any","stagingOnly":true}},{"verb":"PlaceProgressOn","amount":1,"target":"picked"},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","when":{"kind":"matches","card":"picked","inPlay":true}}]},
  // 12063 Scouting Party: heard on any of the player's commitments; every commitment is made before the first is announced.
  {"id":"12063:response:1","cardCode":"12063","lines":["12063:A:1"],"timing":"response","trigger":"committed","subject":{"type":"character","control":"you"},"cost":{"kind":"playEvent"},"condition":{"kind":"allMatch","of":{"type":"character","control":"you","committed":true},"match":{"type":"character","control":"you","trait":"Scout"}},"instructions":[{"verb":"Each","pick":{"type":"character","control":"you","committed":true},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"endOfPhase","target":"picked"}]}]},
];

export const REPLACES: readonly string[] = [];
