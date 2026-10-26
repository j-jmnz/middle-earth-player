import type { Effect } from "../../../catalog/boundary.ts";

// Records for the JtR player cards whose lines no template reads (data/cards/JtR.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 02050 Prince Imrahil
  {"id":"02050:response:1","cardCode":"02050","lines":["02050:A:1"],"timing":"response","trigger":"leftPlay","subject":{"type":"character","control":"any"},"limit":"oncePerRound","instructions":[{"verb":"Ready"}]},
  // 02051 Dúnedain Quest (line 1 is the generated 02051:constant:1)
  {"id":"02051:constant:2","cardCode":"02051","lines":["02051:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 02052 Parting Gifts. "Any number" is the player's choice of how many to move: MoveResources moves at most what the first
  // hero holds, so every count up to 9, or all of them, can be chosen.
  {"id":"02052:action:1","cardCode":"02052","lines":["02052:A:1"],"timing":"action","condition":{"kind":"canPick","pick":{"type":"hero","control":"any","spheres":["leadership"],"hasResources":true}},"instructions":[
    {"verb":"Pick","pick":{"type":"hero","control":"any","spheres":["leadership"],"hasResources":true}},
    {"verb":"Pick","pick":{"type":"hero","control":"any","different":true}},
    {"verb":"Choose","who":"actor","options":[
      {"id":"all","instructions":[{"verb":"MoveResources","all":true}]},
      {"id":"1","instructions":[{"verb":"MoveResources","amount":1}]},
      {"id":"2","instructions":[{"verb":"MoveResources","amount":2}]},
      {"id":"3","instructions":[{"verb":"MoveResources","amount":3}]},
      {"id":"4","instructions":[{"verb":"MoveResources","amount":4}]},
      {"id":"5","instructions":[{"verb":"MoveResources","amount":5}]},
      {"id":"6","instructions":[{"verb":"MoveResources","amount":6}]},
      {"id":"7","instructions":[{"verb":"MoveResources","amount":7}]},
      {"id":"8","instructions":[{"verb":"MoveResources","amount":8}]},
      {"id":"9","instructions":[{"verb":"MoveResources","amount":9}]}]}]},
  // 02053 Landroval (line 1 is the sentinel keyword)
  {"id":"02053:constant:1","cardCode":"02053","lines":["02053:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  // 02055 Escort from Edoras
  {"id":"02055:constant:1","cardCode":"02055","lines":["02055:A:1"],"timing":"constant","condition":{"kind":"matches","card":"self","pick":{"type":"character","control":"any","committed":true}},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"whileSourceInPlay"}]},
  // 02056 Ancient Mathom. The attachment hears its location leave play (hostLeftPlay) from the discard pile.
  {"id":"02056:constant:1","cardCode":"02056","lines":["02056:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"location","control":"any"}]}]},
  {"id":"02056:response:1","cardCode":"02056","lines":["02056:A:2"],"timing":"response","trigger":"hostLeftPlay","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"Draw","amount":3,"who":"firstPlayer"}]},
];

export const REPLACES: readonly string[] = [];
