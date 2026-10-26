import type { Effect } from "../../../catalog/boundary.ts";

// Records for the FotS player cards whose lines no template reads (data/cards/FotS.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 12001 Denethor (his Setup, 12001:A:1, is the record 12001:setup:1 in families/sidequests.ts). MoveResources moves from
  // the card picked before the last: Denethor (unique, so the one Denethor the actor controls), then the other Gondor hero.
  {"id":"12001:action:1","cardCode":"12001","lines":["12001:A:2"],"timing":"action","limit":"oncePerRound","condition":{"kind":"all","conditions":[{"kind":"matches","card":"self","pick":{"type":"hero","control":"any","hasResources":true}},{"kind":"canPick","pick":{"type":"hero","control":"any","trait":"Gondor","other":true}}]},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you","names":["Denethor"]}},{"verb":"Pick","pick":{"type":"hero","control":"any","trait":"Gondor","other":true}},{"verb":"MoveResources","amount":1}]},
  // 12002 Rod of the Steward (line 1 is the generated 12002:constant:1)
  {"id":"12002:action:1","cardCode":"12002","lines":["12002:A:2"],"timing":"action","cost":{"kind":"resources","amount":2,"from":"host"},"instructions":[{"verb":"Draw","amount":1}]},
  // 12003 In Service of the Steward (line 1 is the generated 12003:constant:1)
  {"id":"12003:constant:2","cardCode":"12003","lines":["12003:A:2"],"timing":"constant","instructions":[{"verb":"GrantTrait","trait":"Gondor"}]},
  // 12006 Glorfindel. Discarding the card is the cost; readying him changes the game only while he is exhausted.
  {"id":"12006:constant:1","cardCode":"12006","lines":["12006:A:1"],"timing":"constant","instructions":[{"verb":"PlayFromDiscard"}]},
  {"id":"12006:action:1","cardCode":"12006","lines":["12006:A:2"],"timing":"action","limit":"oncePerPhase","condition":{"kind":"all","conditions":[{"kind":"handHasCard"},{"kind":"matches","card":"self","pick":{"type":"ally","control":"any","state":"exhausted"}}]},"instructions":[{"verb":"DiscardFromHand","amount":1},{"verb":"Ready"}]},
  // 12008 Imladris Caregiver
  {"id":"12008:action:1","cardCode":"12008","lines":["12008:A:1"],"timing":"action","limit":"twicePerRound","condition":{"kind":"all","conditions":[{"kind":"handHasCard"},{"kind":"canPick","pick":{"type":"character","control":"any","damaged":true}}]},"instructions":[{"verb":"DiscardFromHand","amount":1},{"verb":"Pick","pick":{"type":"character","control":"any","damaged":true}},{"verb":"Heal","amount":1,"target":"picked"}]},
  // 12011 Vanish from Sight
  {"id":"12011:constant:1","cardCode":"12011","lines":["12011:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"count","pick":{"type":"hero","control":"you"},"max":2}}]},
];

export const REPLACES: readonly string[] = [];
