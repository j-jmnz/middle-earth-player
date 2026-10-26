import type { Effect } from "../../../catalog/boundary.ts";

// Records for the ASitE player cards whose lines no template reads (data/cards/ASitE.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 21003 Merry
  {"id":"21003:response:1","cardCode":"21003","lines":["21003:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfRound","holders":{"type":"ally","control":"you","unique":true}}]},
  // 21004 Pippin
  {"id":"21004:constant:1","cardCode":"21004","lines":["21004:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"whileSourceInPlay","target":"self","when":{"kind":"versusHighEngagement","role":"attacking"}}]},
  {"id":"21004:response:1","cardCode":"21004","lines":["21004:A:2"],"timing":"response","trigger":"engaged","condition":{"kind":"engagedAboveThreat"},"instructions":[{"verb":"Ready"}]},
  // 21005 Faramir
  {"id":"21005:response:1","cardCode":"21005","lines":["21005:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","stagingOnly":true,"nonUnique":true}},"instructions":[
    {"verb":"Pick","pick":{"type":"enemy","control":"any","stagingOnly":true,"nonUnique":true}},
    {"verb":"Engage","target":"picked"},
    {"verb":"DamageCard","amount":2,"target":"picked","when":{"kind":"not","condition":{"kind":"matches","card":"picked","pick":{"type":"enemy","control":"any","hasAttachment":{}}}}},
    {"verb":"DamageCard","amount":4,"target":"picked","when":{"kind":"matches","card":"picked","pick":{"type":"enemy","control":"any","hasAttachment":{}}}}]},
  // 21008 Put Off Pursuit
  {"id":"21008:constant:1","cardCode":"21008","lines":["21008:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"activeLocation"},"limitPerHost":true},{"verb":"ModifyStat","stat":"questPoints","amount":2,"until":"whileSourceInPlay","target":"host"}]},
  // 21072 Sméagol, side A (side B is open: its enemy stats are in no source, src/effects/open-lines.ts)
  {"id":"21072:constant:1","cardCode":"21072","lines":["21072:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"21072:response:1","cardCode":"21072","lines":["21072:A:3"],"timing":"response","trigger":"traveled","subject":{"type":"location","control":"any"},"cost":{"kind":"raiseThreat","amount":1},"instructions":[{"verb":"Draw","amount":1}]},
];

export const REPLACES: readonly string[] = [];
