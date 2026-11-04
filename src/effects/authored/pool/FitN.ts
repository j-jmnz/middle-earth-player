import type { Effect } from "../../../catalog/boundary.ts";

// Records for the FitN player cards whose lines no template reads (data/cards/FitN.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 19057 The Elvenking: returning the Silvan ally is part of the cost.
  {"id":"19057:action:1","cardCode":"19057","lines":["19057:A:2"],"timing":"action","cost":{"kind":"exhaustSelf"},"condition":{"kind":"canPick","pick":{"type":"ally","control":"you","trait":"Silvan"}},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","trait":"Silvan"}},{"verb":"ReturnToHand","target":"picked"},{"verb":"Ready","target":"host"}]},
  // 19058 Orcrist: an attack the attached hero makes destroys the enemy.
  {"id":"19058:response:1","cardCode":"19058","lines":["19058:A:4"],"timing":"response","trigger":"attackDestroyed","subject":"host","instructions":[{"verb":"AddResources","amount":1,"to":"host"}]},
  // 19060 Leather Boots
  {"id":"19060:constant:1","cardCode":"19060","lines":["19060:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character"},"hosts":[{"type":"character","control":"any","spheres":["lore"]},{"type":"character","control":"any","trait":"Ranger"}],"limitPerHost":true}]},
  {"id":"19060:response:1","cardCode":"19060","lines":["19060:A:2"],"timing":"response","trigger":"encounterRevealed","subject":{"type":"location","control":"any"},"cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Ready","target":"host"}]},
  // 19061 Giant Bear
  {"id":"19061:action:1","cardCode":"19061","lines":["19061:A:2"],"timing":"action","limit":"oncePerPhase","instructions":[{"verb":"Ready"},{"verb":"Delay","until":"endOfPhase","instructions":[{"verb":"ShuffleSelfIntoDeck"}]}]},
  // 19063 Galion
  {"id":"19063:constant:1","cardCode":"19063","lines":["19063:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotAttack","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"cannotDefend","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"19063:response:1","cardCode":"19063","lines":["19063:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfRound","target":"self"}]},
  // 19064 Quicker Than Sight: returning the Silvan ally is the cost.
  {"id":"19064:response:1","cardCode":"19064","lines":["19064:A:1"],"timing":"response","trigger":"shadowPending","cost":{"kind":"playEvent"},"condition":{"kind":"canPick","pick":{"type":"ally","control":"you","trait":"Silvan"}},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","trait":"Silvan"}},{"verb":"ReturnToHand","target":"picked"},{"verb":"CancelEffect"}]},
];

export const REPLACES: readonly string[] = [];
