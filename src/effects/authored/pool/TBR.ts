import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TBR player cards whose lines no template reads (data/cards/TBR.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 141005 Fatty Bolger
  {"id":"141005:action:1","cardCode":"141005","lines":["141005:A:1"],"timing":"action","limit":"oncePerRound","cost":{"kind":"exhaustSelf"},"condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","stagingOnly":true}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","stagingOnly":true}},{"verb":"RaiseThreat","amount":{"stat":"threat","of":"picked"},"who":"actor"},{"verb":"ModifyStat","stat":"noThreatContribution","amount":1,"until":"endOfPhase","target":"picked"}]},
  // 141008 Farmer Maggot
  {"id":"141008:response:1","cardCode":"141008","lines":["141008:A:1"],"timing":"response","trigger":"enteredPlay","condition":{"kind":"hasEngaged"},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"you"}},{"verb":"DamageCard","amount":1,"target":"picked","when":{"kind":"not","condition":{"kind":"matches","card":"picked","pick":{"type":"enemy","control":"any","aboveThreat":true}}}},{"verb":"DamageCard","amount":2,"target":"picked","when":{"kind":"matches","card":"picked","pick":{"type":"enemy","control":"any","aboveThreat":true}}}]},
  // 141010 Smoke Rings
  {"id":"141010:action:1","cardCode":"141010","lines":["141010:A:1"],"timing":"action","instructions":[{"verb":"LowerThreat","amount":{"count":{"type":"attachment","control":"you","trait":"Pipe"}},"who":"actor"},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","holders":{"type":"hero","control":"any","hasAttachment":{"trait":"Pipe"}}}]},
  // 141011 Take No Notice
  {"id":"141011:constant:1","cardCode":"141011","lines":["141011:A:1"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":{"count":{"type":"hero","control":"you","traits":["Hobbit","Ranger"]}}}]},
  {"id":"141011:action:1","cardCode":"141011","lines":["141011:A:2"],"timing":"action","instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":5,"until":"endOfRound","holders":{"type":"enemy","control":"any","staging":true}}]},
];

export const REPLACES: readonly string[] = [];
