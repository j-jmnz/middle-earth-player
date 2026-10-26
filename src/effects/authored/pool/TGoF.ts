import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TGoF player cards whose lines no template reads (data/cards/TGoF.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 19084 Dáin Ironfoot: the Action he gains while defending.
  {"id":"19084:action:1","cardCode":"19084","lines":["19084:A:1"],"timing":"action","limit":"thricePerPhase","cost":{"kind":"discardDeckTop","amount":1},"condition":{"kind":"matches","card":"self","pick":{"type":"character","control":"any","defending":true}},"instructions":[{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfAttack"}]},
  // 19085 Soldier of Erebor
  {"id":"19085:action:1","cardCode":"19085","lines":["19085:A:1"],"timing":"action","limit":"oncePerRound","cost":{"kind":"discardDeckTop","amount":3},"instructions":[{"verb":"Ready"}]},
  // 19086 Man the Walls (A:2, a cost reduction for the next ally, is open)
  {"id":"19086:constant:1","cardCode":"19086","lines":["19086:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"copiesPlayedThisRound","max":0}}]},
  // 19088 Familiar Lands
  {"id":"19088:action:1","cardCode":"19088","lines":["19088:A:1"],"timing":"action","instructions":[{"verb":"ModifyStat","stat":"threat","amount":-2,"until":"endOfPhase","holders":{"type":"location","control":"any","hasAttachment":{}}}]},
  // 19089 Warrior Sword: the host rule and the bonus are one printed line.
  {"id":"19089:constant:1","cardCode":"19089","lines":["19089:A:2"],"timing":"constant","instructions":[
    {"verb":"AttachesTo","hosts":[{"type":"character","control":"any","spheres":["tactics"]},{"type":"character","control":"any","trait":"Warrior"}],"limitPerHost":true},
    {"verb":"ModifyStat","stat":"attack","amount":{"count":{"type":"enemy","control":"any","engaged":"you"},"limit":3},"until":"whileSourceInPlay","target":"host"}]},
  // 19092 Valiant Determination
  {"id":"19092:constant:1","cardCode":"19092","lines":["19092:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"ally","control":"any"}]},{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 19093 Ring of Thrór: the card the cost discarded is the top of the discard pile; an attachment is attached to a host its
  // own text allows (A:1, Guarded, is open).
  {"id":"19093:action:1","cardCode":"19093","lines":["19093:A:3"],"timing":"action","cost":[{"kind":"exhaustSelf"},{"kind":"discardDeckTop","amount":1}],"instructions":[
    {"verb":"Ready","target":"host"},
    {"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","topmost":true}},
    {"verb":"Pick","pick":{"type":"card","control":"any","hostForPicked":true},"when":{"kind":"matches","card":"picked","pick":{"type":"card","control":"any","cardType":"attachment"}}},
    {"verb":"AttachPicked"}]},
];

export const REPLACES: readonly string[] = [];
