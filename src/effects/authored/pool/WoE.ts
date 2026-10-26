import type { Effect } from "../../../catalog/boundary.ts";

// Records for the WoE player cards whose lines no template reads (data/cards/WoE.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 10001 Merry: "revealed from the top of the encounter deck" is the encounterRevealed window, as for Frodo (141001).
  {"id":"10001:response:1","cardCode":"10001","lines":["10001:A:1"],"timing":"response","trigger":"encounterRevealed","subject":{"type":"enemy","control":"any"},"cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"LowerThreat","amount":{"stat":"threat","of":"subject"},"who":"actor"}]},
  // 10002 Ingold
  {"id":"10002:constant:1","cardCode":"10002","lines":["10002:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":{"count":{"type":"hero","control":"you","hasResources":true}},"until":"whileSourceInPlay"}]},
  // 10005 Raven-winged Helm
  {"id":"10005:constant:1","cardCode":"10005","lines":["10005:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","keyword":"sentinel"}],"limitPerHost":true}]},
  // 10009 Scout Ahead
  {"id":"10009:constant:1","cardCode":"10009","lines":["10009:A:1"],"timing":"constant","instructions":[{"verb":"DeckLimit","copies":1}]},
];

export const REPLACES: readonly string[] = [];
