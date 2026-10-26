import type { Effect } from "../../../catalog/boundary.ts";

// Records for the OtD player cards whose lines no template reads (data/cards/OtD.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 132006 Glóin: the gained Response holds while you control at least 5 Dwarf characters (Glóin, in play, counts).
  {"id":"132006:response:1","cardCode":"132006","lines":["132006:A:1"],"timing":"response","trigger":"played","subject":"self","condition":{"kind":"count","pick":{"type":"character","control":"you","trait":"Dwarf"},"min":5},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any"}},{"verb":"AddResources","amount":2,"to":"picked"}]},
  // 132007 Bifur
  {"id":"132007:response:1","cardCode":"132007","lines":["132007:A:1"],"timing":"response","trigger":"played","subject":"self","condition":{"kind":"count","pick":{"type":"character","control":"you","trait":"Dwarf"},"min":5},"instructions":[{"verb":"Draw","amount":2}]},
  // 132008 Dwalin (line 1 is Sentinel)
  {"id":"132008:constant:1","cardCode":"132008","lines":["132008:A:2"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":2,"when":{"kind":"count","pick":{"type":"character","control":"you","trait":"Dwarf"},"min":5}}]},
  // 132012 To me! O my kinsfolk!
  {"id":"132012:action:1","cardCode":"132012","lines":["132012:A:1"],"timing":"action","condition":{"kind":"count","pick":{"type":"hero","control":"you","trait":"Dwarf"},"min":1},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","cardType":"ally","trait":"Dwarf","intoPlay":true}},{"verb":"MovePicked","to":"play"},{"verb":"Delay","until":"endOfPhase","subject":"picked","instructions":[{"verb":"PutOnDeck","position":"bottom","target":"picked","when":{"kind":"matches","card":"picked","inPlay":true}}]}]},
  // 132015 Black Arrow ("a hero with Ranged": printed or gained; line 2, +5 Attack for this attack, is open)
  {"id":"132015:constant:1","cardCode":"132015","lines":["132015:A:1"],"timing":"constant","instructions":[{"verb":"DeckLimit","copies":1},{"verb":"AttachesTo","host":{"kind":"hero"},"hosts":[{"type":"hero","control":"any","keyword":"ranged"}]}]},
  // 132018 King Under the Mountain: once one card is in the hand, the other of the two is the top card.
  {"id":"132018:action:1","cardCode":"132018","lines":["132018:A:2"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":2}},{"verb":"MovePicked","to":"hand"},{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":1}},{"verb":"DiscardPicked"}]},
];

export const REPLACES: readonly string[] = [];
