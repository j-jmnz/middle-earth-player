import type { Effect } from "../../../catalog/boundary.ts";

// Records for the RAR player cards whose lines no template reads (data/cards/RAR.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 19026 Haldan (line 2 counts the attachments on a location as it is explored, after they have left play: open).
  {"id":"19026:constant:1","cardCode":"19026","lines":["19026:A:1"],"timing":"constant","condition":{"kind":"matches","card":"activeLocation","pick":{"type":"location","control":"any","hasAttachment":{}}},"instructions":[{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"whileSourceInPlay"}]},
  // 19027 Wiglaf: the exhausted attachment is the cost; readying a ready Wiglaf would not change the game state. Line 1
  // (play an Item attachment on him for no cost) needs a pick of the hand's attachments that may go on him: open.
  {"id":"19027:action:1","cardCode":"19027","lines":["19027:A:2"],"timing":"action","limit":"oncePerPhase","condition":{"kind":"all","conditions":[{"kind":"canPick","pick":{"type":"attachment","control":"you","attachedTo":"source","state":"ready"}},{"kind":"matches","card":"self","pick":{"type":"ally","control":"any","state":"exhausted"}}]},"instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"you","attachedTo":"source","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"Ready"}]},
  // 19028 Ancestral Armor: "Limit 1 per character" is part of where it may be attached.
  {"id":"19028:constant:1","cardCode":"19028","lines":["19028:A:1","19028:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","spheres":["leadership"]},{"type":"character","control":"any","trait":"Noble"}],"limitPerHost":true}]},
  {"id":"19028:constant:2","cardCode":"19028","lines":["19028:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"defense","amount":2,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"hitPoints","amount":2,"until":"whileSourceInPlay","target":"host"}]},
  // 19029 Glamdring (line 1, Guarded, is open).
  {"id":"19029:constant:1","cardCode":"19029","lines":["19029:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any"},{"type":"character","control":"any","names":["Gandalf"]}]}]},
  {"id":"19029:constant:2","cardCode":"19029","lines":["19029:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"19029:response:1","cardCode":"19029","lines":["19029:A:4"],"timing":"response","trigger":"attackDestroyed","subject":"host","instructions":[{"verb":"Draw","amount":1}]},
  // 19031 Meneldor: one Response on two events.
  {"id":"19031:constant:1","cardCode":"19031","lines":["19031:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"19031:response:1","cardCode":"19031","lines":["19031:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"canPick","pick":{"type":"location","control":"any"}},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"PlaceProgressOn","amount":2,"target":"picked"}]},
  {"id":"19031:response:2","cardCode":"19031","lines":["19031:A:2"],"timing":"response","trigger":"leftPlay","subject":"self","condition":{"kind":"canPick","pick":{"type":"location","control":"any"}},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"PlaceProgressOn","amount":2,"target":"picked"}]},
  // 19033 Wild Stallion (line 2 attaches the ally to an ally: open).
  {"id":"19033:constant:1","cardCode":"19033","lines":["19033:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
  // 19035 Eagle of the North (lines 1 and 3, the Encounter keyword and its When Revealed, are open).
  {"id":"19035:constant:1","cardCode":"19035","lines":["19035:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
];

export const REPLACES: readonly string[] = [];
