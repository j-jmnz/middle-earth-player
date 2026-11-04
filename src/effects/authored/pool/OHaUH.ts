import type { Effect } from "../../../catalog/boundary.ts";

// Records for the OHaUH player cards whose lines no template reads (data/cards/OHaUH.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 131002 Thorin Oakenshield
  {"id":"131002:constant:1","cardCode":"131002","lines":["131002:A:1"],"timing":"constant","condition":{"kind":"count","pick":{"type":"character","control":"you","trait":"Dwarf"},"min":5},"instructions":[{"verb":"ModifyStat","stat":"extraResource","amount":1,"until":"whileSourceInPlay"}]},
  // 131003 Nori
  {"id":"131003:response:1","cardCode":"131003","lines":["131003:A:1"],"timing":"response","trigger":"played","subject":{"type":"character","control":"you","trait":"Dwarf"},"instructions":[{"verb":"LowerThreat","amount":1,"who":"actor"}]},
  // 131004 Ori. The resource phase draw (rr.step-1-3) is the draw at its beginning.
  {"id":"131004:constant:1","cardCode":"131004","lines":["131004:A:1"],"timing":"constant","condition":{"kind":"count","pick":{"type":"character","control":"you","trait":"Dwarf"},"min":5},"instructions":[{"verb":"ModifyStat","stat":"extraDraw","amount":1,"until":"whileSourceInPlay","target":"actorSeat"}]},
  // 131005 Beorn (Sentinel is a printed keyword; line 2 is the immune keyword)
  {"id":"131005:constant:2","cardCode":"131005","lines":["131005:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noExhaustDefend","amount":1,"until":"whileSourceInPlay"}]},
  // 131006 Fili and 131007 Kili
  {"id":"131006:response:1","cardCode":"131006","lines":["131006:A:1"],"timing":"response","trigger":"played","subject":"self","condition":{"kind":"phase","is":"Planning"},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","cardType":"ally","names":["Kili"],"intoPlay":true}},{"verb":"MovePicked","to":"play"},{"verb":"ShuffleDeck"}]},
  {"id":"131007:response:1","cardCode":"131007","lines":["131007:A:1"],"timing":"response","trigger":"played","subject":"self","condition":{"kind":"phase","is":"Planning"},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","cardType":"ally","names":["Fili"],"intoPlay":true}},{"verb":"MovePicked","to":"play"},{"verb":"ShuffleDeck"}]},
  // 131008 Bofur
  {"id":"131008:action:1","cardCode":"131008","lines":["131008:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"attachment","trait":"Weapon"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
  // 131010 Gandalf. "You may raise your threat by 2 to cancel this effect": his controller chooses between paying the 2 threat
  // (the effect does not happen) and the discard. The cancel field only takes resources from the first player.
  {"id":"131010:constant:1","cardCode":"131010","lines":["131010:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"131010:forced:1","cardCode":"131010","lines":["131010:A:2"],"timing":"forced","trigger":"endOfPhase","condition":{"kind":"phase","is":"Refresh"},"instructions":[{"verb":"Choose","who":"actor","options":[{"id":"cancel","instructions":[{"verb":"RaiseThreat","amount":2,"who":"actor"}]},{"id":"discard","instructions":[{"verb":"Discard","target":{"kind":"self"}}]}]}]},
  // 131011 Cram (line 1 is the generated 131011:constant:1). Readying the hero changes the game only while it is exhausted.
  {"id":"131011:action:1","cardCode":"131011","lines":["131011:A:2"],"timing":"action","cost":{"kind":"discardSelf"},"condition":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","state":"exhausted"}},"instructions":[{"verb":"Ready","target":"host"}]},
];

export const REPLACES: readonly string[] = [];
