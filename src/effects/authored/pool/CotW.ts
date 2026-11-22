import type { Effect } from "../../../catalog/boundary.ts";

// Records for the CotW player cards whose lines no template reads (data/cards/CotW.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 22054 Saruman
  {"id":"22054:response:1","cardCode":"22054","lines":["22054:A:3"],"timing":"response","trigger":"played","eventSeat":"you","subject":{"type":"card","control":"you","keyword":"doomed"},"instructions":[{"verb":"Ready"}]},
  // 22055 Power of Command. The One Ring (21001) is unique and every Master attachment goes on the hero that has it, so "the
  // hero with The One Ring" is the hero with a Master attachment (The One Ring is a Master card itself). The Response's cost
  // can be paid only by the player who controls The One Ring, so attached hero is a unique character that player controls:
  // the -1 on it cancels the +1 every unique character of theirs gets, which leaves each other one +1.
  {"id":"22055:constant:1","cardCode":"22055","lines":["22055:A:1","22055:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","hasAttachment":{"trait":"Master"}}],"limitPerHost":true}]},
  {"id":"22055:constant:2","cardCode":"22055","lines":["22055:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"22055:response:1","cardCode":"22055","lines":["22055:A:3"],"timing":"response","trigger":"committed","subject":"host","cost":[{"kind":"exhaustNamed","name":"The One Ring"},{"kind":"raiseThreat","amount":1}],"instructions":[
    {"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","holders":{"type":"character","control":"you","unique":true}},
    {"verb":"ModifyStat","stat":"willpower","amount":-1,"until":"endOfPhase","target":"host"}]},
  // 22059 Nori
  {"id":"22059:response:1","cardCode":"22059","lines":["22059:A:1"],"timing":"response","trigger":"attackDestroyed","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","topmost":true}},{"verb":"PutOnDeck","position":"bottom"}]},
  // 22060 Golden Belt (line 1 is the generated 22060:constant:1)
  {"id":"22060:constant:2","cardCode":"22060","lines":["22060:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"extraRestricted","amount":1,"until":"whileSourceInPlay","target":"host"}]},
];

export const REPLACES: readonly string[] = [];
