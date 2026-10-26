import type { Effect } from "../../../catalog/boundary.ts";

// Records for the LoS player cards whose lines no template reads (data/cards/LoS.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 144001 Frodo Baggins. The One Ring in play is the Fellowship box's (141085), the only saga Ring a playable scenario deals.
  {"id":"144001:action:1","cardCode":"144001","lines":["144001:A:1"],"timing":"action","cost":[{"kind":"resources","amount":1,"sphere":"fellowship"},{"kind":"exhaustCode","code":"141085"}],"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"endOfRound"},{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfRound"}]},
  // 144002 Faramir: readying a ready ally would not change the game state (rr.triggered-ability).
  {"id":"144002:response:1","cardCode":"144002","lines":["144002:A:2"],"timing":"response","trigger":"engaged","eventSeat":"you","limit":"oncePerPhase","condition":{"kind":"canPick","pick":{"type":"ally","control":"you","state":"exhausted"}},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","state":"exhausted"}},{"verb":"Ready","target":"picked"}]},
  // 144004 Anborn
  {"id":"144004:response:1","cardCode":"144004","lines":["144004:A:1"],"timing":"response","trigger":"addedToStaging","subject":{"type":"enemy","control":"any"},"cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":5,"until":"endOfRound","target":"subject"},{"verb":"DamageCard","amount":1,"target":"subject"}]},
  // 144005 Mablung: the enemy may be in the staging area or engaged with a player; then engaging it or returning it is optional.
  {"id":"144005:response:1","cardCode":"144005","lines":["144005:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","staging":true}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true}},{"verb":"ModifyStat","stat":"engagementCost","amount":5,"until":"endOfRound","target":"picked"},{"verb":"Choose","who":"actor","options":[{"id":"engage","instructions":[{"verb":"Engage","target":"picked"}]},{"id":"return","instructions":[{"verb":"ReturnToStaging","target":{"kind":"picked"}}]},{"id":"neither","instructions":[]}]}]},
  // 144006 Skinbark.
  {"id":"144006:constant:1","cardCode":"144006","lines":["144006:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"},{"verb":"EntersPlayExhausted"}]},
  // 144008 Staff of Lebethron (line 2 discards the attacking enemy's shadow card, which no pick names).
  {"id":"144008:constant:1","cardCode":"144008","lines":["144008:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","traits":["Gondor","Hobbit"]}]}]},
  // 144012 In the Shadows
  {"id":"144012:constant:1","cardCode":"144012","lines":["144012:A:1"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":{"count":{"type":"hero","control":"you","traits":["Hobbit","Ranger"]}}}]},
  {"id":"144012:action:1","cardCode":"144012","lines":["144012:A:2"],"timing":"action","condition":{"kind":"phase","is":"Combat"},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":-1,"until":"endOfPhase","holders":{"type":"enemy","control":"any","engaged":"you","aboveThreat":true}},{"verb":"ModifyStat","stat":"defense","amount":-1,"until":"endOfPhase","holders":{"type":"enemy","control":"any","engaged":"you","aboveThreat":true}}]},
];

export const REPLACES: readonly string[] = [];
