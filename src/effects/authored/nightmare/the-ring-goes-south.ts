import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

// The Ring Goes South Nightmare (deck 9064, data/printed/nightmare.json). Damage on a location is the count the south family keeps
// (src/effects/authored/the-ring-goes-south.ts); there can be two active locations. Stage 4 is The Gates of Moria (142023).
const TENTACLE = "906402";
const ACTIVE: PickSpec = { type: "location", control: "any", active: true, who: "firstPlayer" };
const OTHER_ACTIVE: PickSpec = { ...ACTIVE, different: true };
const X_DAMAGE_HERE = { stat: "damage", of: "self" } as const;
const DESTROYED = { kind: "x", min: 1 } as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 906401 The Ring Goes South Nightmare (setup card, side A). The Nightmare deck has 4 copies of Pale-green Tentacle: the ones no player
  // took are shuffled back one by one.
  {"id":"906401:setup:1","cardCode":"906401","lines":["906401:A:2"],"timing":"setup","instructions":[{"verb":"SetAsideFromDeck","code":TENTACLE}]},
  {"id":"906401:forced:1","cardCode":"906401","lines":["906401:A:3"],"timing":"forced","trigger":"stageRevealed","condition":{"kind":"matches","card":"subject","pick":{"type":"card","control":"any","names":["The Gates of Moria"]}},"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"EngageSetAside","code":TENTACLE}]},{"verb":"Repeat","times":4,"instructions":[{"verb":"ShuffleSetAsideIntoEncounterDeck","code":TENTACLE}]},{"verb":"ShuffleEncounterDiscard"}]},
  // 906402 Pale-green Tentacle
  {"id":"906402:constant:1","cardCode":"906402","lines":["906402:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"906402:constant:2","cardCode":"906402","lines":["906402:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotTakeDamage","amount":1,"until":"whileSourceInPlay","holders":{"type":"enemy","control":"any","names":["Watcher in the Water"]}}]},
  {"id":"906402:forced:1","cardCode":"906402","lines":["906402:A:3"],"timing":"forced","trigger":"attacks","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"},"when":DESTROYED}]}]},
  // 906403 Hunting Hawk. The player who played the ally chooses.
  {"id":"906403:constant:1","cardCode":"906403","lines":["906403:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay","target":"self"},{"verb":"ModifyStat","stat":"cannotBeOptionallyEngaged","amount":1,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"906403:forced:1","cardCode":"906403","lines":["906403:A:2"],"timing":"forced","trigger":"played","subject":{"type":"ally","control":"any"},"condition":{"kind":"sourceIn","zone":"staging"},"instructions":[{"verb":"Choose","who":"actor","options":[{"id":"exhaust","instructions":[{"verb":"Exhaust","target":{"kind":"ref","ref":"subject"}}]},{"id":"damage","requires":{"kind":"canPick","pick":ACTIVE},"instructions":[{"verb":"Pick","pick":ACTIVE},{"verb":"PlaceDamage","amount":1,"card":"picked"}]}]}]},
  // 906404 Misty Mountain Warg: it attacks from the staging area; the end of that attack reads the characters it destroyed.
  {"id":"906404:whenRevealed:1","cardCode":"906404","lines":["906404:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AttackActor"},{"verb":"AfterAttack","instructions":[{"verb":"Pick","pick":ACTIVE,"when":DESTROYED},{"verb":"PlaceDamage","amount":2,"card":"picked","when":DESTROYED},{"verb":"Pick","pick":OTHER_ACTIVE,"when":DESTROYED},{"verb":"PlaceDamage","amount":2,"card":"picked","when":DESTROYED}]}]},
  // 906405 Expanse of Hollin: its Threat is X.
  {"id":"906405:constant:1","cardCode":"906405","lines":["906405:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threat","amount":{"count":{"type":"enemy","control":"any"},"plus":1},"until":"whileSourceInPlay","target":"self"}]},
  {"id":"906405:forced:1","cardCode":"906405","lines":["906405:A:2"],"timing":"forced","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"ShuffleEncounterDiscard"},{"verb":"Repeat","times":X_DAMAGE_HERE,"instructions":[{"verb":"MoveEncounterCard","card":"deckTop","to":"discard"},{"verb":"MoveEncounterCard","card":"picked","to":"staging","when":{"kind":"matches","card":"picked","pick":{"type":"enemy","control":"any"}}}]}]},
  // 906406 Slopes of Hithaeglir
  {"id":"906406:forced:1","cardCode":"906406","lines":["906406:A:1"],"timing":"forced","trigger":"whenRevealedCanceled","instructions":[{"verb":"Each","pick":{"type":"location","control":"any","active":true},"instructions":[{"verb":"PlaceDamage","amount":1,"card":"picked"}]}]},
  {"id":"906406:forced:2","cardCode":"906406","lines":["906406:A:2"],"timing":"forced","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"RaiseThreat","amount":X_DAMAGE_HERE,"who":"eachSeat"}]},
  // 906407 Hunted in Hollin (line 1 is Peril)
  {"id":"906407:whenRevealed:1","cardCode":"906407","lines":["906407:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"threat","instructions":[{"verb":"RaiseThreat","amount":6}]},{"id":"engage","requires":{"kind":"canPick","pick":{"type":"enemy","control":"any","stagingOnly":true}},"instructions":[{"verb":"PickLowestEngagement"},{"verb":"Engage","target":"picked"},{"verb":"RevealEncounter"}]}]}]},
  {"id":"906407:shadow:1","cardCode":"906407","lines":["906407:A:3"],"timing":"shadow","instructions":[{"verb":"RaiseThreat","amount":{"count":{"type":"enemy","control":"any","engaged":"you"}}}]},
  // 906408 Shelterless Land (line 1 is Surge and Doomed 1)
  {"id":"906408:whenRevealed:1","cardCode":"906408","lines":["906408:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Each","pick":{"type":"location","control":"any","active":true},"instructions":[{"verb":"RaiseStagingThreat","amount":{"stat":"damage","of":"picked"},"until":"endOfPhase"}]}]},
  {"id":"906408:shadow:1","cardCode":"906408","lines":["906408:A:3"],"timing":"shadow","instructions":[{"verb":"Each","pick":{"type":"location","control":"any","active":true},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"stat":"damage","of":"picked"},"until":"endOfAttack","target":"attacker"}]}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
