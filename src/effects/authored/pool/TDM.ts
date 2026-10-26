import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TDM player cards whose lines no template reads (data/cards/TDM.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 02095 Boromir (line 2, damage to each enemy engaged with one chosen player, is no longer open)
  {"id":"02095:action:1","cardCode":"02095","lines":["02095:A:1"],"timing":"action","limit":"oncePerPhase","cost":{"kind":"raiseThreat","amount":1},"instructions":[{"verb":"Ready"}]},
  // 02096 Dúnedain Watcher
  {"id":"02096:response:1","cardCode":"02096","lines":["02096:A:1"],"timing":"response","trigger":"shadowPending","cost":{"kind":"discardSelf"},"instructions":[{"verb":"CancelEffect"}]},
  // 02097 Dúnedain Cache (line 3, moving the Cache to another hero, is no longer open)
  {"id":"02097:constant:2","cardCode":"02097","lines":["02097:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"ranged","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 02098 Vassal of the Windlord: Ranged is read from the card's keywords (line 2, the Forced after its attack, is no longer open).
  {"id":"02098:constant:1","cardCode":"02098","lines":["02098:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  // 02101 We Do Not Sleep
  {"id":"02101:action:1","cardCode":"02101","lines":["02101:A:1"],"timing":"action","instructions":[{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"endOfPhase","holders":{"type":"character","control":"any","trait":"Rohan"}}]},
  // 02103 Fast Hitch
  {"id":"02103:action:1","cardCode":"02103","lines":["02103:A:2"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Ready","target":"host"}]},
  // 02104 Song of Battle
  {"id":"02104:constant:2","cardCode":"02104","lines":["02104:A:2"],"timing":"constant","instructions":[{"verb":"GrantIcon","sphere":"tactics"}]},
];

export const REPLACES: readonly string[] = [];
