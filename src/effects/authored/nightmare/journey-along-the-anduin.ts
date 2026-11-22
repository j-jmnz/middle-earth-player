import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

// Journey Along the Anduin Nightmare (deck 9002, data/printed/nightmare.json). Stage 3 is Ambush on the Shore (01128), which the players win
// once no enemy is in play. Rules: rr.running-out-of-cards, ltp.undefended-attack, rr.step-6-8-1, rr.doomed-x, rr.surge, rr.first-player
// (data/rules/entries.json).
const UNDEFENDED = { kind: "undefended" } as const;
const NOT_UNDEFENDED = { kind: "not", condition: UNDEFENDED } as const;
const HILL_TROLL: PickSpec = { type: "enemy", control: "any", names: ["Hill Troll"] };
const RATS = ["Brown Water Rats"];
// On stage 3 with no enemy in play but ones with the Rat trait.
const ONLY_RATS_ON_STAGE_3: Condition = { kind: "all", conditions: [{ kind: "onStage", stage: 3 }, { kind: "count", pick: { type: "enemy", control: "any", staging: true, notTraits: ["Rat"] }, max: 0 }, { kind: "sourceIn", zone: "play" }] };
const DISCARD_SELF = [{ verb: "Discard", target: { kind: "self" } }] as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 900201 Journey Along the Anduin Nightmare (setup card, side A)
  {"id":"900201:constant:1","cardCode":"900201","lines":["900201:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay","holders":{"type":"enemy","control":"any","staging":true,"trait":"Troll"}}]},
  {"id":"900201:constant:2","cardCode":"900201","lines":["900201:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"encounterRefill","amount":1,"until":"whileSourceInPlay","target":"table"}]},
  // 900202 Marshland Outlaws: the player engaged with it is held to attacking, and damaging by effects, enemies of its title.
  {"id":"900202:constant:1","cardCode":"900202","lines":["900202:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"engaged"},"instructions":[{"verb":"ModifyStat","stat":"attackOnlyTitle","amount":1,"until":"whileSourceInPlay","target":"engagedSeat"}]},
  {"id":"900202:shadow:1","cardCode":"900202","lines":["900202:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"RaiseThreat","amount":{"dealt":true},"who":"actor"}]}]},
  // 900203 Anduin Troll Spawn: surge when it is revealed with no Hill Troll in play.
  {"id":"900203:whenRevealed:1","cardCode":"900203","lines":["900203:A:1"],"timing":"whenRevealed","instructions":[{"verb":"GainSurge","when":{"kind":"count","pick":{...HILL_TROLL,"staging":true},"max":0}}]},
  {"id":"900203:forced:1","cardCode":"900203","lines":["900203:A:2"],"timing":"forced","trigger":"beginningOfPhase","condition":{"kind":"phase","is":"Combat"},"instructions":[{"verb":"EngageSeatWith","pick":HILL_TROLL}]},
  // 900204 Brown Water Rats: on stage 3, with only Rats left, each copy is discarded (when the stage is revealed, when another enemy leaves
  // play, and when a copy enters play there), so the players can win.
  {"id":"900204:constant:1","cardCode":"900204","lines":["900204:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotTakeDamage","amount":1,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"900204:forced:1","cardCode":"900204","lines":["900204:A:2"],"timing":"forced","trigger":"stageRevealed","condition":ONLY_RATS_ON_STAGE_3,"instructions":[...DISCARD_SELF]},
  {"id":"900204:forced:2","cardCode":"900204","lines":["900204:A:2"],"timing":"forced","trigger":"leftPlay","subject":{"type":"enemy","control":"any","exceptNames":RATS},"condition":ONLY_RATS_ON_STAGE_3,"instructions":[...DISCARD_SELF]},
  {"id":"900204:forced:3","cardCode":"900204","lines":["900204:A:2"],"timing":"forced","trigger":"encounterEnteredPlay","subject":"self","condition":ONLY_RATS_ON_STAGE_3,"instructions":[...DISCARD_SELF]},
  {"id":"900204:shadow:1","cardCode":"900204","lines":["900204:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"cannotTakeDamage","amount":1,"until":"endOfRound","target":"attacker"}]},
  // 900205 A Flooded Ford: each card the encounter deck reveals gains doomed X, X the progress on it (GainsDoomed; nothing at 0).
  {"id":"900205:constant:1","cardCode":"900205","lines":["900205:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"play"},"instructions":[{"verb":"GainsDoomed","amount":{"stat":"progress","of":"self"},"pick":{"type":"card","control":"any"},"byEncounterDeck":true}]},
  {"id":"900205:shadow:1","cardCode":"900205","lines":["900205:A:2"],"timing":"shadow","instructions":[{"verb":"MoveEncounterCard","card":"self","to":"staging","when":UNDEFENDED},{"verb":"PlaceProgressOn","amount":1,"target":"self","when":UNDEFENDED}]},
  // 900206 Gladden Marshlands: the damage is the cost.
  {"id":"900206:action:1","cardCode":"900206","lines":["900206:A:1"],"timing":"action","anyPlayer":true,"condition":{"kind":"canPick","pick":{"type":"hero","control":"you"}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you"}},{"verb":"DamageCard","amount":1,"target":"picked"},{"verb":"ModifyStat","stat":"threat","amount":-1,"until":"endOfPhase","target":"self"}]},
  {"id":"900206:shadow:1","cardCode":"900206","lines":["900206:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfPhase","holders":{"type":"enemy","control":"any","engaged":"you"},"when":NOT_UNDEFENDED},{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfPhase","holders":{"type":"enemy","control":"any","engaged":"you"},"when":UNDEFENDED}]},
  // 900207 Pursuit on the Shore
  {"id":"900207:whenRevealed:1","cardCode":"900207","lines":["900207:A:1"],"timing":"whenRevealed","uncancelable":{"kind":"sourceIn","zone":"staging"},"instructions":[{"verb":"PickMostHitPoints"},{"verb":"MoveEncounterCard","to":"staging"},{"verb":"GainSurge","when":{"kind":"not","condition":{"kind":"matches","card":"picked","inPlay":true}}}]},
  // 900208 Troll Attack
  {"id":"900208:whenRevealed:1","cardCode":"900208","lines":["900208:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ImmediateAttackEach","trait":"Troll"},{"verb":"GainSurge","when":{"kind":"noneReturned"}}]},
  {"id":"900208:shadow:1","cardCode":"900208","lines":["900208:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"AttackOthersUndefended","when":{"kind":"matches","card":"self","pick":{"type":"enemy","control":"any","trait":"Troll"}}}]}]},
  // 900209 Smoking Blood: defended, the damage moves to the defender now; undefended, to the hero the attack damaged once it ends.
  {"id":"900209:whenRevealed:1","cardCode":"900209","lines":["900209:A:1"],"timing":"whenRevealed","instructions":[{"verb":"RemoveEnemyDamage"},{"verb":"GainSurge","when":{"kind":"not","condition":{"kind":"x","min":1}}}]},
  {"id":"900209:shadow:1","cardCode":"900209","lines":["900209:A:2"],"timing":"shadow","instructions":[{"verb":"MoveDamageTo","from":"attacker","to":"defender","when":NOT_UNDEFENDED},{"verb":"AfterAttack","when":UNDEFENDED,"instructions":[{"verb":"MoveDamageTo","from":"self","to":"other"}]}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
