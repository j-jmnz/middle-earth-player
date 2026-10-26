import type { Effect } from "../../../catalog/boundary.ts";

// Records for the DR player cards whose lines no template reads (data/cards/DR.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 12084 Dúnedain Remedy (line 1 is the generated 12084:constant:1). It is attached to a hero when it is played from the
  // hand (planning.ts announces `played`, not `enteredPlay`, for an attachment) and when an effect puts it into play
  // attached (AttachPicked announces `enteredPlay`): one record for each.
  {"id":"12084:response:1","cardCode":"12084","lines":["12084:A:2"],"timing":"response","trigger":"played","subject":"self","instructions":[{"verb":"Heal","amount":1,"target":"host"}]},
  {"id":"12084:response:2","cardCode":"12084","lines":["12084:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Heal","amount":1,"target":"host"}]},
  // 12085 Marksman of Lórien (line 1 is the ranged keyword)
  {"id":"12085:response:1","cardCode":"12085","lines":["12085:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true}},{"verb":"ModifyStat","stat":"defense","amount":-2,"until":"endOfRound","target":"picked"}]},
  // 12087 Woodland Courier
  {"id":"12087:response:1","cardCode":"12087","lines":["12087:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[
    {"verb":"Pick","pick":{"type":"location","control":"any"}},
    {"verb":"PlaceProgressOn","amount":1,"target":"picked","when":{"kind":"not","condition":{"kind":"matches","card":"picked","pick":{"type":"location","control":"any","trait":"Forest"}}}},
    {"verb":"PlaceProgressOn","amount":2,"target":"picked","when":{"kind":"matches","card":"picked","pick":{"type":"location","control":"any","trait":"Forest"}}}]},
  // 12088 Hithlain
  {"id":"12088:constant:1","cardCode":"12088","lines":["12088:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"location","control":"any"}],"limitPerHost":true}]},
  // 12089 Robin Smallburrow. The players travel together, so "you" is any player; the traveled event names the location.
  {"id":"12089:response:1","cardCode":"12089","lines":["12089:A:1"],"timing":"response","trigger":"traveled","subject":{"type":"location","control":"any"},"anyPlayer":true,"cost":{"kind":"resources","amount":1,"sphere":"spirit"},"instructions":[
    {"verb":"Each","pick":{"type":"enemy","control":"any","staging":true},"instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":{"stat":"questPoints","of":"subject"},"until":"endOfRound","target":"picked"}]}]},
  // 12091 Strider (line 1 is the generated 12091:constant:1)
  {"id":"12091:constant:2","cardCode":"12091","lines":["12091:A:2"],"timing":"constant","condition":{"kind":"count","pick":{"type":"hero","control":"you"},"max":2},"instructions":[{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"12091:constant:3","cardCode":"12091","lines":["12091:A:3"],"timing":"constant","condition":{"kind":"count","pick":{"type":"character","control":"you"},"max":5},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"whileSourceInPlay","target":"host"}]},
];

export const REPLACES: readonly string[] = [];
