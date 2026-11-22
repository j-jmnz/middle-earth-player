import type { Effect } from "../../../catalog/boundary.ts";

// Records for the M player cards whose lines no template reads (data/cards/M.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 17001 Kahliel. Readying a character that is not exhausted would change nothing (rr.cost).
  {"id":"17001:action:1","cardCode":"17001","lines":["17001:A:2"],"timing":"action","limit":"oncePerPhase","condition":{"kind":"all","conditions":[{"kind":"canPick","pick":{"type":"card","control":"you","from":"hand","cardType":"ally","trait":"Harad","discarded":true}},{"kind":"canPick","pick":{"type":"character","control":"any","trait":"Harad","state":"exhausted"}}]},"instructions":[
    {"verb":"Pick","pick":{"type":"card","control":"you","from":"hand","cardType":"ally","trait":"Harad"}},{"verb":"DiscardPicked"},
    {"verb":"Pick","pick":{"type":"character","control":"any","trait":"Harad","state":"exhausted"}},{"verb":"Ready","target":"picked"}]},
  // 17004 Yazan (line 1 is Ranged)
  {"id":"17004:response:1","cardCode":"17004","lines":["17004:A:2"],"timing":"response","trigger":"declaredAttacker","subject":"self","limit":"oncePerPhase","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","staging":true,"nonUnique":true}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"nonUnique":true}},{"verb":"DamageCard","amount":1}]},
  // 17007 Dwarf Pipe (line 1 is the generated 17007:constant:1)
  {"id":"17007:response:1","cardCode":"17007","lines":["17007:A:2"],"timing":"response","trigger":"discardedFromDeck","subject":{"type":"card","control":"you"},"cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"PutOnDeck","position":"bottom","target":"subject"}]},
  // 17009 Coney in a Trap. Two different unique characters, one a Ranger and the other a Warrior: at least
  // two unique characters with either trait, at least one Ranger and at least one Warrior.
  {"id":"17009:constant:1","cardCode":"17009","lines":["17009:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"all","conditions":[
    {"kind":"count","pick":{"type":"character","control":"you","unique":true,"traits":["Ranger","Warrior"]},"min":2},
    {"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Ranger"},"min":1},
    {"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Warrior"},"min":1}]}}]},
  // 17010 Kahliel's Headdress (line 1 is the generated 17010:constant:1). "Each Harad character": every one in play.
  {"id":"17010:constant:2","cardCode":"17010","lines":["17010:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"any","trait":"Harad"}}]},
  {"id":"17010:action:1","cardCode":"17010","lines":["17010:A:3"],"timing":"action","cost":{"kind":"exhaustSelf"},"condition":{"kind":"all","conditions":[{"kind":"phase","is":"Refresh"},{"kind":"canPick","pick":{"type":"card","control":"you","from":"discard","cardType":"ally","trait":"Harad","topmost":true}}]},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","cardType":"ally","trait":"Harad","topmost":true}},{"verb":"PutOnDeck","position":"shuffle","target":"picked"}]},
];

export const REPLACES: readonly string[] = [];
