import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TDR player cards whose lines no template reads (data/cards/TDR.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 10140 Arwen Undómiel: "a Noldor's resource pool, or Aragorn's" is a trait or a name, so the target is a choice of two picks.
  {"id":"10140:action:1","cardCode":"10140","lines":["10140:A:1"],"timing":"action","limit":"oncePerRound","condition":{"kind":"handHasCard"},"instructions":[
    {"verb":"DiscardFromHand","amount":1},
    {"verb":"Choose","who":"actor","options":[
      {"id":"noldor","requires":{"kind":"canPick","pick":{"type":"hero","control":"any","trait":"Noldor"}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any","trait":"Noldor"}},{"verb":"AddResources","amount":1,"to":"picked"}]},
      {"id":"aragorn","requires":{"kind":"canPick","pick":{"type":"hero","control":"any","names":["Aragorn"]}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any","names":["Aragorn"]}},{"verb":"AddResources","amount":1,"to":"picked"}]}]}]},
  // 10142 Sword of Númenor: A:2 is the generated 10142:constant:1, so the attach line takes the next number (A:3 is open).
  {"id":"10142:constant:2","cardCode":"10142","lines":["10142:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","traits":["Dúnedain","Gondor"]}]}]},
  // 10143 Fornost Bowman
  {"id":"10143:constant:1","cardCode":"10143","lines":["10143:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"count":{"type":"enemy","control":"any","engaged":"you"}},"until":"whileSourceInPlay"}]},
  // 10144 Hour of Wrath (A:2, the Valour Action on a chosen player's heroes, is open)
  {"id":"10144:action:1","cardCode":"10144","lines":["10144:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any"}},{"verb":"ModifyStat","stat":"noExhaustAttack","amount":1,"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"noExhaustDefend","amount":1,"until":"endOfPhase","target":"picked"}]},
  // 10145 Elven-light (A:2, returning the event to the hand instead of the discard pile, is open)
  {"id":"10145:constant:1","cardCode":"10145","lines":["10145:A:1"],"timing":"constant","instructions":[{"verb":"PlayFromDiscard","only":true}]},
  // 10149 Sword-thain (A:2, the card type change, is open)
  {"id":"10149:constant:1","cardCode":"10149","lines":["10149:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"ally","control":"any","unique":true,"nonNeutral":true}]}]},
];

export const REPLACES: readonly string[] = [];
