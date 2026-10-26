import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TDT player cards whose lines no template reads (data/cards/TDT.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 08001 Celeborn
  {"id":"08001:response:1","cardCode":"08001","lines":["08001:A:1"],"timing":"response","trigger":"enteredPlay","subject":{"type":"ally","control":"any","trait":"Silvan"},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfRound","target":"subject"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfRound","target":"subject"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfRound","target":"subject"}]},
  // 08002 Naith Guide
  {"id":"08002:response:1","cardCode":"08002","lines":["08002:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any"}},{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"endOfRound","target":"picked"}]},
  // 08004 Firefoot (A:3, excess damage, is open)
  {"id":"08004:constant:1","cardCode":"08004","lines":["08004:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","spheres":["tactics"]},{"type":"hero","control":"any","trait":"Rohan"}]}]},
  {"id":"08004:constant:2","cardCode":"08004","lines":["08004:A:2"],"timing":"constant","instructions":[
    {"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host","when":{"kind":"not","condition":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","names":["Éomer"]}}}},
    {"verb":"ModifyStat","stat":"attack","amount":2,"until":"whileSourceInPlay","target":"host","when":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","names":["Éomer"]}}}]},
  // 08007 The Fall of Gil-Galad (A:2, a "when destroyed" Response, is open)
  {"id":"08007:constant:1","cardCode":"08007","lines":["08007:A:1"],"timing":"constant","instructions":[{"verb":"DeckLimit","copies":1},{"verb":"AttachesTo","host":{"kind":"hero"}}]},
];

export const REPLACES: readonly string[] = [];
