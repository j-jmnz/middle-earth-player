import type { Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Escape from Dol Guldur Nightmare (deck 9003, data/printed/nightmare.json). The quest is The Necromancer's Tower (01123), Through the Caverns
// (01124) and Out of the Dungeons (01125); the Nazgûl of Dol Guldur (01102) waits out of play. Several heroes may be "the prisoner" at once
// (src/rules/families/prisoner.ts). Rules: rr.objective-cards, rr.step-3-4, rr.delayed-effects, rr.in-play-and-out-of-play, rr.doomed-x
// (data/rules/entries.json).
const UNDEFENDED = { kind: "undefended" } as const;
// TakeHeroPrisoner leaves X at 1 when it captured a hero: the part after "Then" resolves only if it did (rr.then).
const CAPTURED = { kind: "x", min: 1 } as const;
const DOL_GULDUR_LOCATION: PickSpec = { type: "location", control: "any", trait: "Dol Guldur" };
const UNCLAIMED_OBJECTIVE: PickSpec = { type: "objective", control: "any", stagingOnly: true };
const ATTACKING: PickSpec = { type: "enemy", control: "any", staging: true, attackingEnemy: true };
const ADD_TOKENS: Instruction = { verb: "Each", pick: DOL_GULDUR_LOCATION, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "picked" }] };
const HAND: PickSpec = { type: "card", control: "you", from: "hand" };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 900301 Escape from Dol Guldur Nightmare (setup card, side A): heard once the stage 1B When Revealed has taken the first prisoner.
  {"id":"900301:forced:1","cardCode":"900301","lines":["900301:A:2"],"timing":"forced","trigger":"prisonerTaken","subject":{"type":"hero","control":"any"},"instructions":[{"verb":"TakeMorePrisoners"}]},
  // 900302 Torture Master
  {"id":"900302:whenRevealed:1","cardCode":"900302","lines":["900302:A:1"],"timing":"whenRevealed","instructions":[ADD_TOKENS]},
  {"id":"900302:shadow:1","cardCode":"900302","lines":["900302:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"TakeHeroPrisoner","card":"other","dealt":true},{"verb":"ReturnToStage","stage":2,"when":{"kind":"all","conditions":[CAPTURED,{"kind":"onStage","stage":3}]}}]}]},
  // 900303 Crazed Captive (line 1 is Doomed 1)
  {"id":"900303:forced:1","cardCode":"900303","lines":["900303:A:2"],"timing":"forced","trigger":"enemyDestroyed","subject":"self","instructions":[{"verb":"RaiseThreat","amount":7,"who":"eachSeat"}]},
  {"id":"900303:shadow:1","cardCode":"900303","lines":["900303:A:3"],"timing":"shadow","instructions":[{"verb":"Pick","pick":ATTACKING},{"verb":"Delay","until":"endOfPhase","subject":"picked","instructions":[{"verb":"RaiseThreat","amount":7,"who":"actor","when":{"kind":"matches","card":"picked","inPlay":true}}]}]},
  // 900304 Spider of Dol Guldur: surge when it is revealed while an objective is unclaimed.
  {"id":"900304:whenRevealed:1","cardCode":"900304","lines":["900304:A:1"],"timing":"whenRevealed","instructions":[{"verb":"GainSurge","when":{"kind":"count","pick":UNCLAIMED_OBJECTIVE,"min":1}}]},
  {"id":"900304:shadow:1","cardCode":"900304","lines":["900304:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"count":UNCLAIMED_OBJECTIVE,"times":3},"until":"endOfAttack","target":"attacker"}]},
  // 900305 Torture Chamber
  {"id":"900305:constant:1","cardCode":"900305","lines":["900305:A:1"],"timing":"constant","condition":{"kind":"matches","card":"self","pick":{"type":"location","control":"any","minResources":4}},"instructions":[{"verb":"LoseGame"}]},
  {"id":"900305:forced:1","cardCode":"900305","lines":["900305:A:2"],"timing":"forced","trigger":"endOfRound","instructions":[ADD_TOKENS]},
  // 900306 Dungeon Labyrinth
  {"id":"900306:constant:1","cardCode":"900306","lines":["900306:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threat","amount":{"stat":"resources","of":"self"},"until":"whileSourceInPlay","target":"self"},{"verb":"ModifyStat","stat":"questPoints","amount":{"stat":"resources","of":"self"},"until":"whileSourceInPlay","target":"self"}]},
  {"id":"900306:forced:1","cardCode":"900306","lines":["900306:A:2"],"timing":"forced","trigger":"endOfRound","instructions":[{"verb":"PlaceResourceTokens","amount":{"players":true},"on":"self"}]},
  // 900307 Sentinel of Shadow
  {"id":"900307:whenRevealed:1","cardCode":"900307","lines":["900307:A:1"],"timing":"whenRevealed","uncancelable":{"kind":"sourceIn","zone":"staging"},"instructions":[{"verb":"RaiseStagingThreat","amount":{"players":true,"times":2},"until":"endOfPhase"},{"verb":"Delay","until":"questFailed","instructions":[{"verb":"EngageOutOfPlay","code":"01102"}]}]},
  // 900308 Catacomb Inspection (line 1 is Surge)
  {"id":"900308:whenRevealed:1","cardCode":"900308","lines":["900308:A:2"],"timing":"whenRevealed","instructions":[ADD_TOKENS]},
  {"id":"900308:shadow:1","cardCode":"900308","lines":["900308:A:3"],"timing":"shadow","instructions":[{"verb":"Each","pick":{...DOL_GULDUR_LOCATION,"stagingOnly":true},"instructions":[{"verb":"MoveResourceFromHeroes","to":"picked"}]}]},
  // 900309 Dark Interrogation
  {"id":"900309:whenRevealed:1","cardCode":"900309","lines":["900309:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"RevealEncounter","when":{"kind":"count","pick":HAND,"max":2}},{"verb":"DiscardFromHand","amount":{"hand":true,"plus":-2},"when":{"kind":"count","pick":HAND,"min":3}}]}]},
  {"id":"900309:shadow:1","cardCode":"900309","lines":["900309:A:2"],"timing":"shadow","instructions":[{"verb":"Each","pick":{"type":"card","control":"you","copyInDiscard":true},"instructions":[{"verb":"DiscardPicked"}],"when":{"kind":"not","condition":UNDEFENDED}},{"verb":"Each","pick":{"type":"card","control":"any","copyInDiscard":true},"instructions":[{"verb":"DiscardPicked"}],"when":UNDEFENDED}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
