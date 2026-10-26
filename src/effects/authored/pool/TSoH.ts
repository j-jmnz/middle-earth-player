import type { Condition, Effect } from "../../../catalog/boundary.ts";

// Records for the TSoH player cards whose lines no template reads (data/cards/TSoH.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
//
// "A unique X character and another unique Y character" (16007:A:1, 16008:A:1) needs two different characters: at least one
// of each, and at least two that are either (one character with both traits, Legolas the Noble Scout, is not enough).
const UNLIKELY_FRIENDS: Condition = {"kind":"all","conditions":[{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Silvan"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Dwarf"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"traits":["Silvan","Dwarf"]},"min":2}]};
const NOBLE_AND_SCOUT: Condition = {"kind":"all","conditions":[{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Noble"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Scout"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"traits":["Noble","Scout"]},"min":2}]};

export const RECORDS: readonly Effect[] = [
  // 16001 Gimli (line 1 is Sentinel)
  {"id":"16001:response:1","cardCode":"16001","lines":["16001:A:2"],"timing":"response","trigger":"declaredDefender","subject":"self","limit":"oncePerPhase","cost":{"kind":"resources","amount":1,"from":"self"},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any","other":true}},{"verb":"Ready","target":"picked"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfPhase","target":"picked","when":{"kind":"matches","card":"picked","pick":{"type":"hero","control":"any","names":["Legolas"]}}}]},
  // 16002 Legolas: the card discarded from the hand is the cost.
  {"id":"16002:response:1","cardCode":"16002","lines":["16002:A:2"],"timing":"response","trigger":"committed","subject":"self","limit":"oncePerPhase","condition":{"kind":"handHasCard"},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"hand"}},{"verb":"DiscardPicked"},{"verb":"Pick","pick":{"type":"hero","control":"any","other":true}},{"verb":"Ready","target":"picked"},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","target":"picked","when":{"kind":"matches","card":"picked","pick":{"type":"hero","control":"any","names":["Gimli"]}}}]},
  // 16003 Greenwood Archer (line 1 is Ranged)
  {"id":"16003:response:1","cardCode":"16003","lines":["16003:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any"}},{"verb":"Ready","target":"picked"}]},
  // 16007 Unlikely Friendship
  {"id":"16007:constant:1","cardCode":"16007","lines":["16007:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":UNLIKELY_FRIENDS}]},
  {"id":"16007:action:1","cardCode":"16007","lines":["16007:A:2"],"timing":"action","instructions":[{"verb":"Draw","amount":1},{"verb":"Pick","pick":{"type":"hero","control":"you"}},{"verb":"AddResources","amount":1,"to":"picked"}]},
  // 16008 Well Warned. A Response event is played from its Response window, where PlayOnlyIf is not read, so the Response
  // carries the same play restriction as its condition.
  {"id":"16008:constant:1","cardCode":"16008","lines":["16008:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":NOBLE_AND_SCOUT}]},
  {"id":"16008:response:1","cardCode":"16008","lines":["16008:A:2"],"timing":"response","trigger":"engaged","cost":{"kind":"playEvent"},"condition":NOBLE_AND_SCOUT,"instructions":[{"verb":"LowerThreat","amount":{"stat":"threat","of":"subject","printed":true},"who":"eventSeat"}]},
  // 16010 Dwarven Shield (line 3, after damage from an enemy attack, is open)
  {"id":"16010:constant:2","cardCode":"16010","lines":["16010:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 16011 Mirkwood Long-knife
  {"id":"16011:constant:2","cardCode":"16011","lines":["16011:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"}]},
];

export const REPLACES: readonly string[] = [];
