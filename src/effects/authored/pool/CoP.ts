import type { Effect } from "../../../catalog/boundary.ts";

// Records for the CoP player cards whose lines no template reads (data/cards/CoP.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 17135 Quickbeam. Readying him changes the game only while he is exhausted (rr.triggered-ability).
  {"id":"17135:constant:1","cardCode":"17135","lines":["17135:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"17135:action:1","cardCode":"17135","lines":["17135:A:2"],"timing":"action","limit":"oncePerPhase","cost":{"kind":"damageSelf","amount":2},"condition":{"kind":"matches","card":"self","pick":{"type":"hero","control":"any","state":"exhausted"}},"instructions":[{"verb":"Ready"}]},
  // 17136 Halfast Gamgee. Each side quest in the victory display, a player side quest or an encounter side quest (mec108.side-quests).
  {"id":"17136:constant:1","cardCode":"17136","lines":["17136:A:1"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":{"count":{"type":"card","control":"any","from":"victory","sideQuest":true}}}]},
  {"id":"17136:response:1","cardCode":"17136","lines":["17136:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any"}},{"verb":"AddResources","amount":1,"to":"picked"}]},
  // 17137 Bulwark of the West. Discarding the ally is the cost, so both choices must be possible.
  {"id":"17137:action:1","cardCode":"17137","lines":["17137:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"canPick","pick":{"type":"ally","control":"you"}},{"kind":"canPick","pick":{"type":"attachment","control":"any","trait":"Condition"}}]},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you"}},{"verb":"Discard","target":{"kind":"picked"}},{"verb":"Pick","pick":{"type":"attachment","control":"any","trait":"Condition"}},{"verb":"Discard","target":{"kind":"picked"}}]},
  // 17138 Beorning Guardian. The attack's destroyed enemy is the event's other card.
  {"id":"17138:response:1","cardCode":"17138","lines":["17138:A:1"],"timing":"response","trigger":"attackDestroyed","subject":"self","cost":{"kind":"discardSelf"},"condition":{"kind":"canPick","pick":{"type":"location","control":"any"}},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"PlaceProgressOn","amount":{"stat":"threat","of":"other","printed":true},"target":"picked"}]},
  // 17140 Flight to the Sea
  {"id":"17140:constant:1","cardCode":"17140","lines":["17140:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"count","pick":{"type":"hero","control":"you","traits":["Noldor","Silvan"]},"min":1}}]},
  // 17141 Emyn Arnen Ranger. An enemy in play: in the staging area or engaged with a player.
  {"id":"17141:response:1","cardCode":"17141","lines":["17141:A:1"],"timing":"response","trigger":"committed","subject":"self","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","staging":true,"hasAttachment":{"trait":"Trap"}}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"hasAttachment":{"trait":"Trap"}}},{"verb":"ModifyStat","stat":"willpower","amount":{"stat":"threat","of":"picked","printed":true},"until":"endOfPhase","target":"self"}]},
  // 17142 The Dam Bursts. "A unique Ent and another unique Hobbit": one of each, and two different cards among them.
  {"id":"17142:constant:1","cardCode":"17142","lines":["17142:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Ent"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Hobbit"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"traits":["Ent","Hobbit"]},"min":2}]}}]},
  {"id":"17142:action:1","cardCode":"17142","lines":["17142:A:2"],"timing":"action","instructions":[{"verb":"Each","pick":{"type":"character","control":"you","trait":"Ent","damaged":true},"instructions":[{"verb":"Ready","target":"picked"}]}]},
  // 17143 Magic Ring. Each option is offered only when it changes the game (rr.effects).
  {"id":"17143:constant:1","cardCode":"17143","lines":["17143:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"},"limitPerHost":true},{"verb":"DeckLimit","copies":1}]},
  {"id":"17143:action:1","cardCode":"17143","lines":["17143:A:2"],"timing":"action","cost":[{"kind":"exhaustSelf"},{"kind":"raiseThreat","amount":1}],"instructions":[{"verb":"Choose","who":"actor","options":[{"id":"heal","requires":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","damaged":true}},"instructions":[{"verb":"Heal","amount":1,"target":"host"}]},{"id":"resource","instructions":[{"verb":"AddResources","amount":1,"to":"host"}]},{"id":"ready","requires":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","state":"exhausted"}},"instructions":[{"verb":"Ready","target":"host"}]}]}]},
];

export const REPLACES: readonly string[] = [];
