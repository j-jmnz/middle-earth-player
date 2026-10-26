import type { Effect } from "../../../catalog/boundary.ts";

// Records for the WaR player cards whose lines no template reads (data/cards/WaR.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 22001 Thorin Stonehelm
  {"id":"22001:response:1","cardCode":"22001","lines":["22001:A:1"],"timing":"response","trigger":"declaredAttacker","subject":"self","cost":{"kind":"discardDeckTop","amount":1},"condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"you"}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"you"}},{"verb":"DamageCard","amount":1}]},
  // 22003 Pillars of the Kings: the draws read the threat before it is set. From 31 to 39 setting it to 40 raises it by less
  // than 10; at 30 or less, by 10 or more; at 40 or more it does not raise it.
  {"id":"22003:constant:1","cardCode":"22003","lines":["22003:A:1"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":4,"when":{"kind":"threat","max":39}}]},
  {"id":"22003:action:1","cardCode":"22003","lines":["22003:A:2"],"timing":"action","instructions":[{"verb":"Draw","amount":4,"when":{"kind":"threat","max":30}},{"verb":"Draw","amount":1,"when":{"kind":"threat","min":31,"max":39}},{"verb":"SetThreat","value":40}]},
  // 22005 Tom Bombadillo! (line 2 shuffles in a copy of Tom Bombadil set aside by the Encounter keyword: open).
  {"id":"22005:constant:1","cardCode":"22005","lines":["22005:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"hero","control":"you","trait":"Hobbit"},"min":1},{"kind":"inVictory","code":"22005","is":false}]}}]},
  // 22006 Durin's Axe.
  {"id":"22006:response:1","cardCode":"22006","lines":["22006:A:3"],"timing":"response","trigger":"attackDestroyed","subject":"host","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"you"}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"you"}},{"verb":"DamageCard","amount":1}]},
  // 22008 Silver Circlet
  {"id":"22008:constant:1","cardCode":"22008","lines":["22008:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero","sphere":"spirit"},"limitPerHost":true},{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"whileSourceInPlay","target":"host"}]},
  // 22009 Inner Strength: a Master card, so its One Ring is the player card (21001). Line 1 ("the hero with The One Ring")
  // needs a host filter by attachment title: open.
  {"id":"22009:response:1","cardCode":"22009","lines":["22009:A:2"],"timing":"response","trigger":"shadowPending","cost":[{"kind":"exhaustCode","code":"21001"},{"kind":"raiseThreat","amount":1}],"condition":{"kind":"matches","card":"host","pick":{"type":"character","control":"any","defending":true}},"instructions":[{"verb":"CancelEffect"}]},
];

export const REPLACES: readonly string[] = [];
