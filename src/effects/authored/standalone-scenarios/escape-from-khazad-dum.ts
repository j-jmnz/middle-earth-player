import type { Amount, Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { consideredEngaged } from "../considered-engaged.ts";

// Records for Escape from Khazad-dûm (standalone-scenarios cycle part 13, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) needs no record here.
// The scenario is a kit like The Mines of Moria (src/effects/authored/standalone-scenarios/the-mines-of-moria.ts): the 1A Setup builds the Quick-build (7 of the 14 sets, the first player's stage 2 and stage 3: docs/brief.md, Escape from Khazad-dûm, reading 2) and finds the 0 cost cards,
// and Dark Pit lies in the staging area from the deal. "The opposing team" chooses and searches in the manner that gives the players the greatest challenge: the engine's fixed policy, never a prompt (readings 1 and 3).
// Rules: rr.search, rr.reveal, rr.cancel, rr.explored, rr.forced, rr.travel, rr.engaged, rr.staging, rr.first-player, rr.guarded, rr.victory, rr.quest-advancement, rr.attachment-cards, rr.blank, rr.surge, rr.damage, faq.additional-attacks (data/rules/entries.json).
const STAGE_1 = "51301";
const DARK_PIT = "51310";
const BANE = "51311";
const STAGES_2 = ["51303", "51304", "51305"] as const;
const STAGES_3 = ["51307", "51308", "51309"] as const;
const SETS = Array.from({ length: 14 }, (_, at) => `Escape from Khazad-dûm ${15 + at}`);

const EACH_PLAYER = (instructions: Instruction[]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions } as Instruction);
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ENEMY_STAGED_OR_ENGAGED: PickSpec = { type: "enemy", control: "any", staging: true };
const MY_CHARACTER: PickSpec = { type: "character", control: "you" };
const MY_HERO: PickSpec = { type: "hero", control: "you" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const ENGAGED_WITH_YOU: PickSpec = { type: "enemy", control: "any", engaged: "you" };
const STAGED_LOCATIONS: PickSpec = { type: "location", control: "any", stagingOnly: true };
const THE_BANE: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Durin's Bane"] };
const THE_BANE_STAGED: PickSpec = { type: "enemy", control: "any", stagingOnly: true, names: ["Durin's Bane"] };
// "X is 1 more than the stage number of the main quest" (51316:A:1).
const STAGE_PLUS_1: Amount = { stage: true, plus: 1 };
const KILLED = { kind: "x", min: 1 } as const;
const PHASE_QUEST: Condition = { kind: "phase", is: "Quest" };

// "Forced: When <location> is explored, ...": the trigger `locationExplored` hears the exploring of a location in the staging area and of the active location (triggerHears), so one record serves both.
const explored = (code: string, line: string, instructions: Instruction[]): Effect => ({ id: `${code}:forced:1`, cardCode: code, lines: [line], timing: "forced", trigger: "locationExplored", subject: "self", instructions });
// "The opposing team searches the top 5 cards of the encounter deck for a card with cost 1 or less (cost 2 or less instead if there are two or more players) ..." (the A side of every stage 2 card, Dark Pit's Travel).
const topSearch = (code: string, line: string, timing: "whenRevealed" | "travel", id: number): Effect => ({ id: `${code}:${timing}:${id}`, cardCode: code, lines: [line], timing, instructions: [{ verb: "SearchTopReveal", top: 5, maxCost: 1, maxCostMulti: 2 }] });
// "When this stage is defeated, the players win the game." (the stage 3 cards).
const wins = (code: string, line: string): Effect => ({ id: `${code}:questResolution:1`, cardCode: code, lines: [line], timing: "questResolution", instructions: [{ verb: "WinGame" }] });
// "Cannot have non-objective player card attachments or take non-combat damage." (the records of 51233:A:1).
const armoured = (code: string): Effect[] => [
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", condition: { kind: "sourceIn", zone: "play" }, instructions: [{ verb: "Restrict", what: "attach", exceptTrait: "objective player card" }] },
  { id: `${code}:constant:2`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeNonCombatDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] },
];
// "Cannot be optionally engaged." (51311:A:2, 51336:A:1).
const noOptionalEngage = (code: string, line: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] });
// "Forced: When <location> is explored, the opposing team searches the encounter deck and discard pile for a <trait> enemy with cost 1 or less and adds it to the staging area. Shuffle the encounter deck." (51313:A:2, 51322:A:2).
const exploredSearch = (code: string, line: string, trait: string): Effect => explored(code, line, [{ verb: "SearchMove", trait, type: "enemy", maxCost: 1, to: "staging", byChallenge: true }, { verb: "ShuffleEncounterDeck" }]);
// "Shadow: If this attack destroys a character, <instruction>".
const afterKill = (code: string, line: string, instruction: Instruction): Effect => ({ id: `${code}:shadow:1`, cardCode: code, lines: [line], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [instruction] } as Instruction] });
// "Forced: When <enemy> attacks you, discard the top card of your deck ..." (51330:A:1, 51333:A:2).
const DISCARD_ONE: Instruction = { verb: "DiscardFromDeck", amount: 1 };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 51301 Out of the Depths (stage 1). Setup: the Quick-build, then the opposing team finds one different 0 cost enemy or location for each player (Dark Pit lies in the staging area from the deal). Side B: when Dark Pit is explored it flips and Durin's Bane is set aside, out of play; each player takes a card of the top 5 of his own deck (reading 7); the stage cannot be defeated while Dark Pit is in play.
  {
    id: "51301:setup:1",
    cardCode: STAGE_1,
    lines: ["51301:A:1"],
    timing: "setup",
    instructions: [
      { verb: "BuildQuickDeck", sets: SETS, keep: 7 },
      { verb: "ChooseQuestStage", codes: [...STAGES_2] },
      { verb: "ChooseQuestStage", codes: [...STAGES_3] },
      EACH_PLAYER([{ verb: "SearchMove", types: ["enemy", "location"], maxCost: 0, to: "staging", different: true, deckOnly: true, byChallenge: true }]),
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  {
    id: "51301:forced:1",
    cardCode: STAGE_1,
    lines: ["51301:B:1"],
    timing: "forced",
    trigger: "locationExplored",
    subject: { type: "location", control: "any", names: ["Dark Pit"] },
    instructions: [
      { verb: "FlipOver", into: BANE, target: "subject", setAside: true },
      EACH_PLAYER([{ verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: 5 } }, { verb: "MovePicked", to: "hand" }, { verb: "ShuffleDeck" }]),
    ],
  },
  { id: "51301:constant:1", cardCode: STAGE_1, lines: ["51301:B:2"], timing: "constant", condition: { kind: "inPlay", code: DARK_PIT, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 51303 Old One Lair (stage 2): the top 5 search; the opposing team adds an enemy with cost 2 or less to the staging area and places a resource on it; while it holds the resource it is immune to player card effects and no progress is placed on this stage (reading 8).
  topSearch("51303", "51303:A:1", "whenRevealed", 1),
  { id: "51303:whenRevealed:2", cardCode: "51303", lines: ["51303:B:1"], timing: "whenRevealed", instructions: [{ verb: "SearchMove", type: "enemy", maxCost: 2, to: "staging", byChallenge: true, remember: true }, { verb: "PlaceResourceTokens", amount: 1, on: "picked" }, { verb: "ShuffleEncounterDeck" }] },
  { id: "51303:constant:1", cardCode: "51303", lines: ["51303:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { ...ENEMY_STAGED_OR_ENGAGED, hasResources: true } }] },
  { id: "51303:constant:2", cardCode: "51303", lines: ["51303:B:2"], timing: "constant", condition: { kind: "canPick", pick: { ...ENEMY_STAGED_OR_ENGAGED, hasResources: true } }, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 51304 A Wrong Turn (stage 2): each player keeps 1 card of his hand and shuffles the rest into his deck (reading 9).
  topSearch("51304", "51304:A:1", "whenRevealed", 1),
  { id: "51304:whenRevealed:2", cardCode: "51304", lines: ["51304:B:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "card", control: "you", from: "hand" } }, { verb: "ShuffleHandIntoDeck", keepPicked: true }])] },

  // 51305 A Way Up (stage 2): the active location's Threat counts in the staging area; in the travel phase the players must travel to a location, if able (reading 10).
  topSearch("51305", "51305:A:1", "whenRevealed", 1),
  { id: "51305:constant:1", cardCode: "51305", lines: ["51305:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "activeThreat", amount: 1, until: "whileSourceInPlay" }] },
  { id: "51305:constant:2", cardCode: "51305", lines: ["51305:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "mustTravel", amount: 1, until: "whileSourceInPlay", target: "table" }] },

  // 51307 The Bridge of Khazad-dûm (stage 3). A:1 (the three stage 3 cards): the set-aside Durin's Bane joins the staging area, cannot take damage this round, and with more than 1 player attacks the first player at once (reading 12). Side B: no more than 5 progress a round;
  // at the beginning of the quest phase Durin's Bane attacks the first player and the undefended and excess damage is placed on this stage (reading 14); the players lose at damage equal to the quest points; defeating the stage wins.
  {
    id: "51307:whenRevealed:1",
    cardCode: "51307",
    lines: ["51307:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "EnterSetAsideStaging", code: BANE },
      { verb: "Pick", pick: THE_BANE_STAGED },
      { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", target: "picked" },
      { verb: "AttackFromStaging", who: "firstPlayer", orEngaged: true, when: { kind: "less", left: 1, right: { players: true } } },
    ],
  },
  { id: "51307:constant:1", cardCode: "51307", lines: ["51307:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 5, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "51307:forced:1",
    cardCode: "51307",
    lines: ["51307:B:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: PHASE_QUEST,
    instructions: [{ verb: "Pick", pick: THE_BANE }, { verb: "AttackFromStaging", who: "firstPlayer", orEngaged: true, undefendedToStage: true, excessToStage: true }],
  },
  { id: "51307:constant:2", cardCode: "51307", lines: ["51307:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "loseAtDamage", amount: { stat: "questPoints", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  wins("51307", "51307:B:3"),

  // 51308 Last Lord of Moria (stage 3): Durin's Bane engages the first player, as soon as it is in the staging area (reading 15); it takes no more damage each round than the progress tokens here (none with no progress); the stage cannot be defeated while it is in play.
  { id: "51308:whenRevealed:1", cardCode: "51308", lines: ["51308:A:1"], timing: "whenRevealed", instructions: [{ verb: "EnterSetAsideStaging", code: BANE }, { verb: "Pick", pick: THE_BANE_STAGED }, { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", target: "picked" }, { verb: "AttackFromStaging", who: "firstPlayer", orEngaged: true, when: { kind: "less", left: 1, right: { players: true } } }] },
  { id: "51308:forced:1", cardCode: "51308", lines: ["51308:B:1"], timing: "forced", trigger: "addedToStaging", subject: THE_BANE, instructions: [{ verb: "EngageFirstPlayer", target: "subject" }] },
  { id: "51308:forced:2", cardCode: "51308", lines: ["51308:B:1"], timing: "forced", trigger: "returnedToStaging", subject: THE_BANE, instructions: [{ verb: "EngageFirstPlayer", target: "subject" }] },
  { id: "51308:constant:1", cardCode: "51308", lines: ["51308:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "damageCap", amount: { stat: "progress", of: "self" }, until: "whileSourceInPlay", holders: THE_BANE }] },
  { id: "51308:constant:2", cardCode: "51308", lines: ["51308:B:2"], timing: "constant", condition: { kind: "not", condition: { kind: "stageProgress", min: 1 } }, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: THE_BANE }] },
  { id: "51308:constant:3", cardCode: "51308", lines: ["51308:B:3"], timing: "constant", condition: { kind: "inPlay", code: BANE, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },
  wins("51308", "51308:B:3"),

  // 51309 The Rear Guard (stage 3): no player's threat is reduced by a player card effect; Durin's Bane is considered engaged with each player and cannot leave the staging area (the records of The Watcher, 51201:B:1, with no progress condition).
  { id: "51309:whenRevealed:1", cardCode: "51309", lines: ["51309:A:1"], timing: "whenRevealed", instructions: [{ verb: "EnterSetAsideStaging", code: BANE }, { verb: "Pick", pick: THE_BANE_STAGED }, { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", target: "picked" }, { verb: "AttackFromStaging", who: "firstPlayer", orEngaged: true, when: { kind: "less", left: 1, right: { players: true } } }] },
  { id: "51309:constant:1", cardCode: "51309", lines: ["51309:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noThreatReduction", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  { id: "51309:constant:2", cardCode: "51309", lines: ["51309:B:2"], timing: "constant", instructions: consideredEngaged(THE_BANE) },
  {
    id: "51309:constant:3",
    cardCode: "51309",
    lines: ["51309:B:2"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", holders: THE_BANE },
      { verb: "ModifyStat", stat: "leavesStagingWhenDefeated", amount: 1, until: "whileSourceInPlay", holders: THE_BANE },
    ],
  },
  wins("51309", "51309:B:3"),

  // 51310 Dark Pit: Travel is the stage 2 search. 51311 Durin's Bane: cannot be optionally engaged; after its attack destroys a character, that character's controller raises his threat by 2 and it heals 2 damage (reading 13).
  topSearch(DARK_PIT, "51310:A:2", "travel", 1),
  noOptionalEngage(BANE, "51311:A:2"),
  {
    id: "51311:forced:1",
    cardCode: BANE,
    lines: ["51311:A:3"],
    timing: "forced",
    trigger: "characterDestroyedByAttack",
    subject: { type: "character", control: "any" },
    condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } },
    instructions: [{ verb: "RaiseThreat", amount: 2, who: "eventSeat" }, { verb: "Heal", amount: 2, target: "self" }],
  },

  // 51312 Black Bats: the first player chooses either to raise each player's threat by 2 or to reveal one more card (reading 18); Shadow: the defending player raises his threat by 2 or the attack is considered undefended.
  {
    id: "51312:whenRevealed:1",
    cardCode: "51312",
    lines: ["51312:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Choose", who: "firstPlayer", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] }, { id: "reveal", instructions: [{ verb: "RevealEncounter" }] }] }],
  },
  {
    id: "51312:shadow:1",
    cardCode: "51312",
    lines: ["51312:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2 }] }, { id: "undefended", instructions: [{ verb: "ConsiderUndefended" }] }] }],
  },

  // 51313 Nest of Vermin: each Creature enemy gets +1 Threat while it is in the staging area; explored, the opposing team finds a Creature enemy with cost 1 or less.
  { id: "51313:constant:1", cardCode: "51313", lines: ["51313:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { ...ENEMY_STAGED_OR_ENGAGED, trait: "Creature" } }] },
  exploredSearch("51313", "51313:A:2", "Creature"),

  // 51314 Swarm of Bats: each character gets -1 Willpower until the end of the phase; Shadow: each character you control gets -1 Attack and -1 Defense until the end of the phase.
  { id: "51314:whenRevealed:1", cardCode: "51314", lines: ["51314:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfPhase", target: "characters" }] },
  {
    id: "51314:shadow:1",
    cardCode: "51314",
    lines: ["51314:A:2"],
    timing: "shadow",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: -1, until: "endOfPhase", target: "ownCharacters" }, { verb: "ModifyStat", stat: "defense", amount: -1, until: "endOfPhase", target: "ownCharacters" }],
  },

  // 51315 Cave Spider: when it attacks the defending player chooses either to remove 2 progress from the main quest or to give it +2 Attack for this attack (reading 18); Shadow: the same choice, the attacking enemy getting the Attack.
  {
    id: "51315:forced:1",
    cardCode: "51315",
    lines: ["51315:A:1"],
    timing: "forced",
    trigger: "attacks",
    subject: "self",
    instructions: [{ verb: "Choose", who: "actor", options: [{ id: "progress", instructions: [{ verb: "RemoveProgressFromQuest", amount: 2 }] }, { id: "attack", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "self" }] }] }],
  },
  {
    id: "51315:shadow:1",
    cardCode: "51315",
    lines: ["51315:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Choose", who: "actor", options: [{ id: "progress", instructions: [{ verb: "RemoveProgressFromQuest", amount: 2 }] }, { id: "attack", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker" }] }] }],
  },

  // 51316 The Mountain's Roots: X (its Threat and its Travel's) is 1 more than the stage number of the main quest (reading 24); Travel: each player discards the top X cards of his deck.
  { id: "51316:constant:1", cardCode: "51316", lines: ["51316:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: STAGE_PLUS_1, until: "whileSourceInPlay", target: "self" }] },
  { id: "51316:travel:1", cardCode: "51316", lines: ["51316:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "DiscardFromDeck", amount: STAGE_PLUS_1 }])] },

  // 51317 Watchful Eyes: the opposing team attaches it to the hero with the highest Willpower that has none (Limit 1 per hero); it counts as a Condition; at the end of the combat phase an exhausted attached hero reveals 1 encounter card (the records of 41040:A:1).
  { id: "51317:whenRevealed:1", cardCode: "51317", lines: ["51317:A:1"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", hasAttachment: { names: ["Watchful Eyes"], none: true }, highestWillpower: true, challenge: true } }, { verb: "AttachSelfToPicked" }] },
  { id: "51317:constant:1", cardCode: "51317", lines: ["51317:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  {
    id: "51317:forced:1",
    cardCode: "51317",
    lines: ["51317:A:1"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "matches", card: "host", pick: { type: "hero", control: "any", state: "exhausted" } }] },
    instructions: [{ verb: "RevealEncounter" }],
  },

  // 51318 Cave-troll: allies cannot be declared as attackers or defenders against it (the records of 143023:A:2).
  {
    id: "51318:constant:2",
    cardCode: "51318",
    lines: ["51318:A:2"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "alliesCannotAttack", amount: 1, until: "whileSourceInPlay", holders: { ...ENEMY_STAGED_OR_ENGAGED, names: ["Cave-troll"] } }, { verb: "Restrict", what: "defend", allies: true }],
  },

  // 51319 Twisting Passage: the top card of the encounter deck is discarded; a location so discarded is added to the staging area (the records of 51249:A:1, with a location).
  { id: "51319:whenRevealed:1", cardCode: "51319", lines: ["51319:A:1"], timing: "whenRevealed", instructions: [{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "location", control: "any" } } }] },

  // 51320 Undisturbed Bones: attached to the main quest as a Condition; a cancel of a When Revealed effect does not happen and the card is discarded instead (reading 20).
  { id: "51320:whenRevealed:1", cardCode: "51320", lines: ["51320:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachToQuest", main: true }] },
  { id: "51320:constant:1", cardCode: "51320", lines: ["51320:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ReplacesRevealCancel" }] },

  // 51321 Old Stone-troll: after it attacks and destroys a character, that character's controller raises his threat by 1 for each excess point of damage (the records of 18049:A:2).
  {
    id: "51321:forced:1",
    cardCode: "51321",
    lines: ["51321:A:2"],
    timing: "forced",
    trigger: "characterDestroyedByAttack",
    subject: { type: "character", control: "any" },
    condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } },
    instructions: [{ verb: "RaiseThreat", amount: { excessOf: "subject" }, who: "eventSeat" }],
  },

  // 51322 Frightful Den: each Troll enemy gets -10 engagement cost while it is in the staging area; explored, the opposing team finds a Troll enemy with cost 1 or less.
  { id: "51322:constant:1", cardCode: "51322", lines: ["51322:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "whileSourceInPlay", holders: { ...ENEMY_STAGED_OR_ENGAGED, trait: "Troll" } }] },
  exploredSearch("51322", "51322:A:2", "Troll"),

  // 51323 Deep Deep Dark: each player chooses either to raise his threat by 1 for each character he controls or to discard a character he controls (the records of 18057:A:2); Shadow: raise your threat by 1 for each enemy engaged with you.
  {
    id: "51323:whenRevealed:1",
    cardCode: "51323",
    lines: ["51323:A:1"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "threat", instructions: [{ verb: "RaiseThreat", amount: { count: MY_CHARACTER }, who: "actor" }] },
            { id: "discard", requires: { kind: "canPick", pick: MY_CHARACTER }, instructions: [{ verb: "Pick", pick: MY_CHARACTER }, { verb: "Discard", target: { kind: "picked" } }] },
          ],
        },
      ]),
    ],
  },
  { id: "51323:shadow:1", cardCode: "51323", lines: ["51323:A:2"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: { count: ENGAGED_WITH_YOU } }] },

  // 51324 Rock Adder: no player can declare a defender against it; Shadow: +2 Attack if the attack is undefended.
  { id: "51324:constant:1", cardCode: "51324", lines: ["51324:A:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "defend", anyDefender: true }] },
  { id: "51324:shadow:1", cardCode: "51324", lines: ["51324:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "undefended" } }] },

  // 51325 Bottomless Chasm: while it is in the staging area the players must travel to it, if able (reading 11); Shadow: +2 Defense until the end of the phase.
  { id: "51325:constant:1", cardCode: "51325", lines: ["51325:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "Restrict", what: "travelOnly" }] },
  { id: "51325:shadow:1", cardCode: "51325", lines: ["51325:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfPhase", target: "attacker" }] },

  // 51326 Lost and Alone: the opposing team removes the questing character with the highest Willpower each player controls from the quest (reading 19); Shadow: the defending character cannot ready until the end of the round.
  { id: "51326:whenRevealed:1", cardCode: "51326", lines: ["51326:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "character", control: "you", committed: true, highestWillpower: true, challenge: true } }, { verb: "RemoveFromQuest" }])] },
  { id: "51326:shadow:1", cardCode: "51326", lines: ["51326:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "defender" }] },

  // 51327 Hobgoblin: after it engages a player it cannot take damage until the end of the round; Shadow: the attacking enemy cannot take damage this phase.
  { id: "51327:forced:1", cardCode: "51327", lines: ["51327:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", target: "self" }] },
  { id: "51327:shadow:1", cardCode: "51327", lines: ["51327:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfPhase", target: "attacker" }] },

  // 51328 Western Hall: Travel: the top card of the encounter deck is discarded and each player raises his threat by its printed Threat (the records of 142055:A:2); Shadow: a destroyed character reveals the top card.
  { id: "51328:travel:1", cardCode: "51328", lines: ["51328:A:1"], timing: "travel", instructions: [{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "RaiseThreat", amount: { stat: "threat", of: "discardTop", printed: true }, who: "eachSeat" }] },
  afterKill("51328", "51328:A:2", { verb: "RevealEncounter", when: KILLED }),

  // 51329 New Devilry: each character's text box is blank until the end of the round, its Traits kept (the records of 51114:A:1 and :A:2); Shadow: the defending character's, until the end of the phase.
  { id: "51329:whenRevealed:1", cardCode: "51329", lines: ["51329:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfRound", holders: { type: "character", control: "any" } }] },
  { id: "51329:shadow:1", cardCode: "51329", lines: ["51329:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfPhase", target: "defender" }] },

  // 51330 Unspeakable Thing: when it attacks you, the top card of your deck is discarded and it gets +X Attack for this attack, X the printed cost of that card (the records of 09034:A:1).
  { id: "51330:forced:1", cardCode: "51330", lines: ["51330:A:1"], timing: "forced", trigger: "attacks", subject: "self", instructions: [DISCARD_ONE, { verb: "ModifyStat", stat: "attack", amount: { discarded: "cost" }, until: "endOfAttack", target: "self" }] },

  // 51331 Lightless Grotto: non-unique enemies in the staging area cannot take damage while it is there; Travel: the first player chooses an enemy in the staging area and engages it (the records of 10023:A:2).
  { id: "51331:constant:1", cardCode: "51331", lines: ["51331:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true, nonUnique: true } }] },
  { id: "51331:travel:1", cardCode: "51331", lines: ["51331:A:2"], timing: "travel", instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true, who: "firstPlayer" } }, { verb: "Engage", target: "picked" }] },

  // 51332 Many Roads: the opposing team finds one different 0 cost location for each player (the records of 51204:B:1); Shadow: the opposing team shuffles a location of the encounter discard pile into the encounter deck.
  { id: "51332:whenRevealed:1", cardCode: "51332", lines: ["51332:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "location", maxCost: 0, to: "staging", different: true, byChallenge: true }]), { verb: "ShuffleEncounterDeck" }] },
  { id: "51332:shadow:1", cardCode: "51332", lines: ["51332:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "location", control: "any", from: "encounterDiscard", highestThreat: true, challenge: true } }, { verb: "MoveEncounterCard", card: "picked", to: "shuffle" }] },

  // 51333 Shadow Dweller: no non-objective player card attachments or non-combat damage; when it attacks you, the top card of your deck is discarded and you assign X damage among your characters, X its printed cost (the records of 09034:A:1).
  ...armoured("51333"),
  { id: "51333:forced:1", cardCode: "51333", lines: ["51333:A:2"], timing: "forced", trigger: "attacks", subject: "self", instructions: [DISCARD_ONE, { verb: "AssignDamage", amount: { discarded: "cost" }, pick: MY_CHARACTER }] },

  // 51334 Branching Paths: +1 Threat for each location in the staging area, at most +3 (reading 23).
  { id: "51334:constant:1", cardCode: "51334", lines: ["51334:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: STAGED_LOCATIONS, limit: 3 }, until: "whileSourceInPlay", target: "self" }] },

  // 51335 Fatigue: each player exhausts a character and no player card effect readies a character until the end of the round (the records of 51120:A:1); Shadow: the defending character leaves the attack and another may be declared (reading 21).
  {
    id: "51335:whenRevealed:1",
    cardCode: "51335",
    lines: ["51335:A:1"],
    timing: "whenRevealed",
    instructions: [EACH_PLAYER([{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }]), { verb: "ModifyStat", stat: "cannotReadyByPlayerCard", amount: 1, until: "endOfRound", target: "characters" }],
  },
  { id: "51335:shadow:1", cardCode: "51335", lines: ["51335:A:2"], timing: "shadow", instructions: [{ verb: "RemoveDefender" }] },

  // 51336 Elder Nameless Thing: cannot be optionally engaged; while in the staging area it gains a Forced effect after the players commit characters to the quest: it attacks the first player (the staging step begins, as 51007:B:1).
  noOptionalEngage("51336", "51336:A:1"),
  { id: "51336:forced:1", cardCode: "51336", lines: ["51336:A:2"], timing: "forced", trigger: "stagingStepBegins", condition: IN_STAGING, instructions: [{ verb: "AttackFromStaging", target: "self", who: "firstPlayer" }] },

  // 51337 Silent Caverns: while in the staging area no player's threat is reduced by more than 1 each round (the records of 51143:A:1); Travel: each player raises his threat by 2.
  { id: "51337:constant:1", cardCode: "51337", lines: ["51337:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "threatReductionCap", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  { id: "51337:travel:1", cardCode: "51337", lines: ["51337:A:2"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },

  // 51338 Dark Places: each player raises his threat by the Threat of the active location (surge with none, the records of 09058:A:1); Shadow: +X Attack, X the stage number of the main quest.
  { id: "51338:whenRevealed:1", cardCode: "51338", lines: ["51338:A:1"], timing: "whenRevealed", instructions: [{ verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: { type: "location", control: "any", active: true } } } }, { verb: "RaiseThreat", amount: { stat: "threat", of: "activeLocation" }, who: "eachSeat" }] },
  { id: "51338:shadow:1", cardCode: "51338", lines: ["51338:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stage: true }, until: "endOfAttack", target: "attacker" }] },

  // 51339 Orc Horn Blower: at the beginning of the combat phase each engaged enemy is dealt an additional shadow card; Shadow: the attacking enemy is dealt 2 additional shadow cards.
  { id: "51339:forced:1", cardCode: "51339", lines: ["51339:A:1"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Combat" }, instructions: [{ verb: "Each", pick: { type: "enemy", control: "any" }, instructions: [{ verb: "DealShadowTo", target: "picked" }] }] },
  { id: "51339:shadow:1", cardCode: "51339", lines: ["51339:A:2"], timing: "shadow", instructions: [{ verb: "DealShadowTo", target: "attacker" }, { verb: "DealShadowTo", target: "attacker" }] },

  // 51340 Goblin Dungeon: the opposing team's choice of ally (the highest printed cost in play) lies faceup under it with its tokens discarded; it returns to its owner exhausted when Goblin Dungeon leaves play, explored or not (reading 28).
  { id: "51340:whenRevealed:1", cardCode: "51340", lines: ["51340:A:1"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: { type: "ally", control: "any", highestCost: true, challenge: true } }, { verb: "HoldPickedUnder", returnsExhausted: true }] },

  // 51341 Deep Fissure: each player deals 1 damage to a questing character he controls and removes it from the quest; Shadow: 1 damage to a character you control (the records of 41026:A:2).
  { id: "51341:whenRevealed:1", cardCode: "51341", lines: ["51341:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "character", control: "you", committed: true } }, { verb: "DamageCard", amount: 1, target: "picked" }, { verb: "RemoveFromQuest" }])] },
  { id: "51341:shadow:1", cardCode: "51341", lines: ["51341:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: MY_CHARACTER }, { verb: "DamageCard", amount: 1, target: "picked" }] },

  // 51342 Black Uruks: while it attacks it gets +1 Attack for each shadow card dealt for the attack (the records of 10129:A:2, read live); Shadow: the opposing team deals a card of the top 5 of the encounter deck to the attacker as a shadow card (reading 27).
  { id: "51342:constant:1", cardCode: "51342", lines: ["51342:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attackPerShadow", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "51342:shadow:1", cardCode: "51342", lines: ["51342:A:2"], timing: "shadow", instructions: [{ verb: "SearchTopShadow", top: 5 }] },

  // 51343 Dreadful Gap: no progress can be placed on the other locations in the staging area while it is there (the records of 146044:A:1); Travel: the opposing team shuffles a card of the encounter discard pile into the encounter deck (the records of 51116:A:1).
  { id: "51343:constant:1", cardCode: "51343", lines: ["51343:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true, other: true } }] },
  { id: "51343:travel:1", cardCode: "51343", lines: ["51343:A:2"], timing: "travel", instructions: [{ verb: "Pick", pick: { type: "card", control: "any", from: "encounterDiscard", highestThreat: true, challenge: true } }, { verb: "MoveEncounterCard", card: "picked", to: "shuffle" }] },

  // 51344 Orcish Howls: exhaust X characters, X the Uruk enemies in play (the first player chooses, reading 19); surge with no Uruk in play. Shadow: +1 Attack, +2 against an Uruk attacker.
  {
    id: "51344:whenRevealed:1",
    cardCode: "51344",
    lines: ["51344:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "enemyInPlay", trait: "Uruk", is: true } } },
      { verb: "Repeat", times: { count: { ...ENEMY_STAGED_OR_ENGAGED, trait: "Uruk" } }, instructions: [{ verb: "Pick", pick: { type: "character", control: "any", state: "ready", who: "firstPlayer" } }, { verb: "Exhaust", target: { kind: "picked" } }] },
    ],
  },
  {
    id: "51344:shadow:1",
    cardCode: "51344",
    lines: ["51344:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Uruk" } } } },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Uruk" } } },
    ],
  },

  // 51345 Orc Raiders: after it engages a player it is dealt a shadow card; Shadow: +1 Attack and an additional shadow card for the attacker (the records of 51049:A:2).
  { id: "51345:forced:1", cardCode: "51345", lines: ["51345:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "DealShadowTo", target: "self" }] },
  { id: "51345:shadow:1", cardCode: "51345", lines: ["51345:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "DealShadow", additional: true }] },

  // 51346 The Great Bridge: while it is in the staging area no more than 1 character can be declared as an attacker against each enemy (reading 22); explored, each player reveals 1 encounter card.
  { id: "51346:constant:1", cardCode: "51346", lines: ["51346:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "singleAttacker", amount: 1, until: "whileSourceInPlay", holders: ENEMY_STAGED_OR_ENGAGED }] },
  explored("51346", "51346:A:2", [EACH_PLAYER([{ verb: "RevealEncounter" }])]),

  // 51347 Vast and Intricate: the opposing team attaches it to the non-unique location of the staging area with the highest Threat (surge with none); it counts as a Condition: +2 Threat and immunity to player card effects for the location.
  {
    id: "51347:whenRevealed:1",
    cardCode: "51347",
    lines: ["51347:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Pick", pick: { ...STAGED_LOCATIONS, nonUnique: true, challenge: true } }, { verb: "AttachSelfToPicked" }, { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: { ...STAGED_LOCATIONS, nonUnique: true } } } }],
  },
  {
    id: "51347:constant:1",
    cardCode: "51347",
    lines: ["51347:A:1"],
    timing: "constant",
    instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "host" }, { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "host" }],
  },

  // 51348 Chieftain of the Pit: no non-objective player card attachments or non-combat damage; no shadow effect can be canceled while it is in play; when it attacks it is dealt an additional shadow card.
  ...armoured("51348"),
  { id: "51348:constant:3", cardCode: "51348", lines: ["51348:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "allShadowsUncancelable", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "51348:forced:1", cardCode: "51348", lines: ["51348:A:3"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "DealShadow", additional: true }] },

  // 51349 Forked Passage: while in the staging area each player raises his threat by 1 additional point in the refresh phase (the records of 01114:A:1); Travel: each player raises his threat by 1.
  { id: "51349:forced:1", cardCode: "51349", lines: ["51349:A:1"], timing: "forced", trigger: "endOfPhase", condition: { kind: "all", conditions: [{ kind: "phase", is: "Refresh" }, IN_STAGING] }, instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },
  { id: "51349:travel:1", cardCode: "51349", lines: ["51349:A:2"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },

  // 51350 Chance Encounter: the highest Attack enemy in the staging area attacks the first player (surge when none does, the records of 51014:A:1); Shadow: a unique attacker makes an additional attack against you after this one.
  {
    id: "51350:whenRevealed:1",
    cardCode: "51350",
    lines: ["51350:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true, highestAttack: true, who: "firstPlayer" } },
      { verb: "AttackFromStaging", who: "firstPlayer", when: { kind: "canPick", pick: { type: "enemy", control: "any", stagingOnly: true } } },
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: { type: "enemy", control: "any", stagingOnly: true } } } },
    ],
  },
  { id: "51350:shadow:1", cardCode: "51350", lines: ["51350:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", when: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", unique: true } }, instructions: [{ verb: "ImmediateAttack" }] }] },

  // 51351 Nameless Thing: after it enters play the first player attaches the top card of his deck to it faceup as a guarded attachment; it gets +X Threat, Attack and Defense, X that card's printed cost; the card is discarded when it leaves play (the records of 18050:A:1 and :A:2).
  { id: "51351:forced:1", cardCode: "51351", lines: ["51351:A:1"], timing: "forced", trigger: "encounterEnteredPlay", subject: "self", instructions: [{ verb: "GuardWithDeckTop" }] },
  { id: "51351:forced:2", cardCode: "51351", lines: ["51351:A:1"], timing: "forced", trigger: "leftPlay", subject: "self", instructions: [{ verb: "ReturnGuardedToHand" }] },
  {
    id: "51351:constant:1",
    cardCode: "51351",
    lines: ["51351:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: { guardedCost: true }, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "attack", amount: { guardedCost: true }, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "defense", amount: { guardedCost: true }, until: "whileSourceInPlay", target: "self" },
    ],
  },

  // 51352 Mithril Lode: while it is the active location it gains a Response when it is explored: each player adds 1 resource to the pool of a hero he controls (the records of 51243:A:1).
  { id: "51352:response:1", cardCode: "51352", lines: ["51352:A:1"], timing: "response", trigger: "activeExplored", subject: "self", instructions: [EACH_PLAYER([{ verb: "Pick", pick: MY_HERO }, { verb: "AddResources", amount: 1, to: "picked" }])] },

  // 51353 A Foe Beyond: the opposing team discards the attachment of highest printed cost a player controls (surge with none, reading 3); Shadow: discard an attachment you control (the records of 51153:A:2).
  {
    id: "51353:whenRevealed:1",
    cardCode: "51353",
    lines: ["51353:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: { type: "attachment", control: "any", controlled: true } } } },
      { verb: "Pick", pick: { type: "attachment", control: "any", controlled: true, highestCost: true, challenge: true } },
      { verb: "Discard", target: { kind: "picked" }, when: { kind: "canPick", pick: { type: "attachment", control: "any", controlled: true } } },
    ],
  },
  { id: "51353:shadow:1", cardCode: "51353", lines: ["51353:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
