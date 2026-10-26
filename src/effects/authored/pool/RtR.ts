import type { Effect } from "../../../catalog/boundary.ts";

// Records for the RtR player cards whose lines no template reads (data/cards/RtR.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 04028 Elladan
  {"id":"04028:constant:1","cardCode":"04028","lines":["04028:A:1"],"timing":"constant","condition":{"kind":"count","pick":{"type":"character","control":"any","names":["Elrohir"]},"min":1},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"whileSourceInPlay"}]},
  {"id":"04028:response:1","cardCode":"04028","lines":["04028:A:2"],"timing":"response","trigger":"declaredAttacker","cost":{"kind":"resources","amount":1,"from":"self"},"instructions":[{"verb":"Ready"}]},
  // 04030 Lure of Moria
  {"id":"04030:action:1","cardCode":"04030","lines":["04030:A:1"],"timing":"action","instructions":[{"verb":"Each","pick":{"type":"character","control":"any","trait":"Dwarf"},"instructions":[{"verb":"Ready","target":"picked"}]}]},
  // 04031 Rivendell Blade (line 2 open: ModifyStat cannot name the enemy the host attacks)
  {"id":"04031:constant:1","cardCode":"04031","lines":["04031:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","traits":["Noldor","Silvan"]}]}]},
  // 04034 Song of Eärendil (line 1 is the generated 04034:constant:1)
  {"id":"04034:response:1","cardCode":"04034","lines":["04034:A:2"],"timing":"response","trigger":"enteredPlay","instructions":[{"verb":"Draw","amount":1}]},
  {"id":"04034:response:2","cardCode":"04034","lines":["04034:A:3"],"timing":"response","trigger":"threatRaised","eventSeat":"other","cost":{"kind":"raiseThreat","amount":1},"instructions":[{"verb":"LowerThreat","amount":1,"who":"eventSeat"}]},
  // 04035 Bombur
  {"id":"04035:action:1","cardCode":"04035","lines":["04035:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"ModifyStat","stat":"threat","amount":-1,"until":"endOfPhase","target":"picked","when":{"kind":"not","condition":{"kind":"matches","card":"picked","pick":{"type":"location","control":"any","trait":"Underground"}}}},{"verb":"ModifyStat","stat":"noThreatContribution","amount":1,"until":"endOfPhase","target":"picked","when":{"kind":"matches","card":"picked","pick":{"type":"location","control":"any","trait":"Underground"}}}]},
];

export const REPLACES: readonly string[] = [];
