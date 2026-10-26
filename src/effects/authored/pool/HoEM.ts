import type { Effect } from "../../../catalog/boundary.ts";

// Records for the HoEM player cards whose lines no template reads (data/cards/HoEM.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 02073 Keen-eyed Took (A:1, revealing the top card of each player's deck, is open)
  {"id":"02073:action:1","cardCode":"02073","lines":["02073:A:2"],"timing":"action","cost":{"kind":"returnSelfToHand"},"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"DiscardTopOfDeck"}]}]},
  // 02074 Rear Guard
  {"id":"02074:action:1","cardCode":"02074","lines":["02074:A:1"],"timing":"action","condition":{"kind":"phase","is":"Quest"},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","spheres":["leadership"]}},{"verb":"Discard","target":{"kind":"picked"}},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","holders":{"type":"hero","control":"any","committed":true}}]},
  // 02075 Descendant of Thorondor: "enters or leaves play" is two events.
  {"id":"02075:constant:1","cardCode":"02075","lines":["02075:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"02075:response:1","cardCode":"02075","lines":["02075:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","stagingOnly":true}},{"verb":"DamageCard","amount":2}]},
  {"id":"02075:response:2","cardCode":"02075","lines":["02075:A:2"],"timing":"response","trigger":"leftPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","stagingOnly":true}},{"verb":"DamageCard","amount":2}]},
  // 02076 Meneldor's Flight
  {"id":"02076:action:1","cardCode":"02076","lines":["02076:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"ally","control":"any","trait":"Eagle"}},{"verb":"ReturnToHand"}]},
  // 02077 The Riddermark's Finest
  {"id":"02077:action:1","cardCode":"02077","lines":["02077:A:1"],"timing":"action","cost":[{"kind":"exhaustSelf"},{"kind":"discardSelf"}],"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"PlaceProgressOn","amount":2,"target":"picked"}]},
  // 02078 Ride to Ruin
  {"id":"02078:action:1","cardCode":"02078","lines":["02078:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","trait":"Rohan"}},{"verb":"Discard","target":{"kind":"picked"}},{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"PlaceProgressOn","amount":3,"target":"picked"}]},
  // 02081 Song of Travel
  {"id":"02081:constant:2","cardCode":"02081","lines":["02081:A:2"],"timing":"constant","instructions":[{"verb":"GrantIcon","sphere":"spirit"}]},
];

export const REPLACES: readonly string[] = [];
