import type { Effect } from "../../../catalog/boundary.ts";

// Records for the FoS player cards whose lines no template reads (data/cards/FoS.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 04101 Glorfindel. He exhausted to commit only if he is exhausted now (Light of Valinor leaves him ready).
  {"id":"04101:forced:1","cardCode":"04101","lines":["04101:A:1"],"timing":"forced","trigger":"committed","condition":{"kind":"matches","card":"self","pick":{"type":"character","control":"any","state":"exhausted"}},"instructions":[{"verb":"RaiseThreat","amount":1,"who":"actor"}]},
  // 04103 Path of Need (line 2 open: no condition says the attached location is the active location)
  {"id":"04103:constant:1","cardCode":"04103","lines":["04103:A:1"],"timing":"constant","instructions":[{"verb":"DeckLimit","copies":1},{"verb":"AttachesTo","hosts":[{"type":"location","control":"any"}]}]},
  // 04104 Trollshaw Scout (line 1 is Ranged; line 3, "after ~ attacks", stays open)
  {"id":"04104:constant:1","cardCode":"04104","lines":["04104:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noExhaustAttack","amount":1,"until":"whileSourceInPlay"}]},
  // 04107 Light of Valinor
  {"id":"04107:constant:1","cardCode":"04107","lines":["04107:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","traits":["Noldor","Silvan"]}]}]},
  {"id":"04107:constant:2","cardCode":"04107","lines":["04107:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 04108 Daeron's Runes
  {"id":"04108:action:1","cardCode":"04108","lines":["04108:A:1"],"timing":"action","instructions":[{"verb":"Draw","amount":2},{"verb":"DiscardFromHand","amount":1}]},
  // 04109 Healing Herbs (line 1 is the generated 04109:constant:1). The host exhausts before the card leaves it.
  {"id":"04109:action:1","cardCode":"04109","lines":["04109:A:2"],"timing":"action","cost":[{"kind":"exhaustHost"},{"kind":"discardSelf"}],"condition":{"kind":"canPick","pick":{"type":"character","control":"any","damaged":true}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","damaged":true}},{"verb":"Heal","all":true,"target":"picked"}]},
  // 04110 Asfaloth
  {"id":"04110:constant:1","cardCode":"04110","lines":["04110:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","traits":["Noldor","Silvan"]}]}]},
  {"id":"04110:action:1","cardCode":"04110","lines":["04110:A:2"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"PlaceProgressOn","amount":1,"target":"picked","when":{"kind":"not","condition":{"kind":"hostNamed","name":"Glorfindel"}}},{"verb":"PlaceProgressOn","amount":2,"target":"picked","when":{"kind":"hostNamed","name":"Glorfindel"}}]},
];

export const REPLACES: readonly string[] = [];
