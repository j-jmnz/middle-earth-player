import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TMV player cards whose lines no template reads (data/cards/TMV.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 06134 Théoden: every player's Tactics heroes.
  {"id":"06134:constant:1","cardCode":"06134","lines":["06134:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","holders":{"type":"hero","control":"any","printedIcon":"tactics"}}]},
  // 06135 Pelargir Ship Captain
  {"id":"06135:response:1","cardCode":"06135","lines":["06135:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"canPick","pick":{"type":"hero","control":"you","hasResources":true}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you","hasResources":true}},{"verb":"Pick","pick":{"type":"hero","control":"any","different":true}},{"verb":"MoveResources","amount":1}]},
  // 06136 Visionary Leadership (06136:constant:1 is the generated "Attach to a Gondor hero"): every player's Gondor characters.
  {"id":"06136:constant:2","cardCode":"06136","lines":["06136:A:2"],"timing":"constant","condition":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","hasResources":true}},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"any","trait":"Gondor"}}]},
  // 06139 Steed of the Mark: readying a ready hero would not change the game state (rr.cost).
  {"id":"06139:constant:1","cardCode":"06139","lines":["06139:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","traits":["Gondor","Rohan"]}]}]},
  {"id":"06139:response:1","cardCode":"06139","lines":["06139:A:2"],"timing":"response","trigger":"committed","subject":"host","cost":{"kind":"resources","amount":1,"from":"host"},"condition":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","state":"exhausted"}},"instructions":[{"verb":"Ready","target":"host"}]},
  // 06140 Lay of Nimrodel: the resources are counted as the effect resolves.
  {"id":"06140:action:1","cardCode":"06140","lines":["06140:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any","spheres":["spirit"]}},{"verb":"ModifyStat","stat":"willpower","amount":{"stat":"resources","of":"picked"},"until":"endOfPhase","target":"picked"}]},
  // 06141 Ered Nimrais Prospector
  {"id":"06141:response:1","cardCode":"06141","lines":["06141:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Repeat","times":3,"instructions":[{"verb":"DiscardTopOfDeck"}]},{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard"},"when":{"kind":"thenResolves"}},{"verb":"PutOnDeck","position":"shuffle","when":{"kind":"thenResolves"}}]},
  // 06142 Scroll of Isildur (06142:constant:1 is the generated "Attach to a Lore hero"). Line 3 plays an event from the
  // discard pile, which no verb does.
  {"id":"06142:constant:2","cardCode":"06142","lines":["06142:A:2"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":{"count":{"type":"hero","control":"you","printedIcon":"lore"}}}]},
  // 06143 Hidden Cache: it answers from the discard pile, where the discard put it. Line 2's "Spend 1 resource" is a cost
  // beside the event's printed cost: open.
  {"id":"06143:response:1","cardCode":"06143","lines":["06143:A:1"],"timing":"response","trigger":"discardedFromDeck","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you"}},{"verb":"AddResources","amount":2,"to":"picked"}]},
];

export const REPLACES: readonly string[] = [];
