import type { Effect } from "../../../catalog/boundary.ts";

// Records for the EfMG player cards whose lines no template reads (data/cards/EfMG.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 10029 Veteran of Osgiliath
  {"id":"10029:constant:1","cardCode":"10029","lines":["10029:A:1"],"timing":"constant","condition":{"kind":"threat","min":40},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay"}]},
  // 10031 Derndingle Warrior (line 1 is Sentinel). The granted Action is usable while it defends, once per attack.
  {"id":"10031:constant:1","cardCode":"10031","lines":["10031:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"10031:constant:2","cardCode":"10031","lines":["10031:A:3"],"timing":"constant","instructions":[{"verb":"EntersPlayExhausted"}]},
  {"id":"10031:action:1","cardCode":"10031","lines":["10031:A:4"],"timing":"action","limit":"oncePerAttack","cost":{"kind":"damageSelf","amount":1},"condition":{"kind":"matches","card":"self","pick":{"type":"ally","control":"any","defending":true}},"instructions":[{"verb":"ModifyStat","stat":"defense","amount":3,"until":"endOfAttack","target":"self"}]},
  // 10032 Boomed and Trumpeted. "Takes any amount of damage" is heard while the character is still in play.
  {"id":"10032:response:1","cardCode":"10032","lines":["10032:A:1"],"timing":"response","trigger":"damaged","subject":{"type":"character","control":"any","trait":"Ent"},"cost":{"kind":"playEvent"},"instructions":[{"verb":"Ready","target":"subject"},{"verb":"ModifyStat","stat":"attack","amount":3,"until":"endOfPhase","target":"subject"}]},
  // 10034 Double Back
  {"id":"10034:constant:1","cardCode":"10034","lines":["10034:A:1"],"timing":"constant","instructions":[{"verb":"DeckLimit","copies":1}]},
  // 10035 Leave No Trace. A location's leaving play is announced only when it
  // is explored (effect-verbs.ts placeProgress, stage-reveal.ts). The event goes to the victory display instead of the discard
  // pile (its cost), then the location joins it.
  {"id":"10035:response:1","cardCode":"10035","lines":["10035:A:2"],"timing":"response","trigger":"leftPlay","subject":{"type":"location","control":"any","nonUnique":true},"cost":{"kind":"playEvent"},"instructions":[{"verb":"AddSourceToVictory"},{"verb":"AddToVictory","target":"subject"}]},
  // 10037 Keen as Lances
  {"id":"10037:action:1","cardCode":"10037","lines":["10037:A:2"],"timing":"action","instructions":[{"verb":"AddSourceToVictory"},{"verb":"Choose","who":"actor","options":[{"id":"resources","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any"}},{"verb":"AddResources","amount":2,"to":"picked"}]},{"id":"draw","instructions":[{"verb":"Draw","amount":3}]},{"id":"threat","instructions":[{"verb":"LowerThreat","amount":4,"who":"actor"}]}]}]},
];

export const REPLACES: readonly string[] = [];
