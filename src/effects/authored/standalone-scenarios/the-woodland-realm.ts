import type { Amount, Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Woodland Realm (standalone-scenarios cycle part 11, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// The scenario is a kit like The Wizard's Quest (the Quick-build, the top-5 searches and the opposing team's policy of src/effects/authored/standalone-scenarios/the-wizards-quest.ts): the quest card 51101's Setup builds the game, Spider Den lies in the staging area from the deal
// and, explored, flips into Mendor under the first player's control. "The opposing team" chooses and searches in the manner that gives the players the greatest challenge: the engine's fixed policy, never a prompt (docs/scenarios/standalone-scenarios/the-woodland-realm.md, The Woodland Realm, readings 1 and 3).
// Rules: rr.search, rr.reveal, rr.cancel, rr.explored, rr.forced, rr.travel, rr.engaged, rr.staging, rr.first-player, rr.ownership-and-control, rr.victory, rr.quest-advancement, rr.attachment-cards, rr.doomed-x, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json).
const STAGE_1 = "51101";
const STAGES_2 = ["51103", "51104", "51105"] as const;
// The search of the running effect found an enemy ("then", rr.then): `remember` leaves it as the picked card.
const FOUND_ENEMY: Condition = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" } };
const HAS_COST_2: Condition = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", minCost: 2 } };
const STAGES_3 = ["51107", "51108", "51109"] as const;
const SPIDER_DEN = "51110";
const MENDOR = "51111";
const SETS = Array.from({ length: 14 }, (_, at) => `The Woodland Realm ${1 + at}`);

const EACH_PLAYER = (instructions: Instruction[]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions } as Instruction);
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ENEMY_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
const ENEMY_STAGED_OR_ENGAGED: PickSpec = { type: "enemy", control: "any", staging: true };
const MY_CHARACTER: PickSpec = { type: "character", control: "you" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const ENGAGED_WITH_YOU: PickSpec = { type: "enemy", control: "any", engaged: "you" };
const MENDOR_COMMITTED: PickSpec = { type: "ally", control: "any", names: ["Mendor"], committed: true };
// "X is 1 more than the stage number of the main quest" (51113:A:1, 51117:A:1, 51136:A:1).
const STAGE_PLUS_1: Amount = { stage: true, plus: 1 };
const STAGING_DARK_WOODS: PickSpec = { type: "location", control: "any", stagingOnly: true, names: ["Dark Black Woods"] };
const KILLED = { kind: "x", min: 1 } as const;
const ATTACKER_IS = (pick: PickSpec): Extract<Condition, { kind: "matches" }> => ({ kind: "matches", card: "attacker", pick });

// "When <location> is explored": the trigger `locationExplored` hears the exploring of a location in the staging area and of the active location (triggerHears), so one record serves both.
const explored = (code: string, line: string, instructions: Instruction[]): Effect => ({ id: `${code}:forced:1`, cardCode: code, lines: [line], timing: "forced", trigger: "locationExplored", subject: "self", instructions });
// "The opposing team searches the top 5 cards of the encounter deck for a card with cost N or less (M or less if there are two or more players) ..." (the A side of every stage 2 and stage 3 card).
const topSearch = (code: string, maxCost: number): Effect => ({ id: `${code}:whenRevealed:1`, cardCode: code, lines: [`${code}:A:1`], timing: "whenRevealed", instructions: [{ verb: "SearchTopReveal", top: 5, maxCost, maxCostMulti: maxCost + 1 }] });
// "If the players defeat this stage, they win the game." (the stage 3 cards).
const wins = (code: string, line: string): Effect => ({ id: `${code}:questResolution:1`, cardCode: code, lines: [line], timing: "questResolution", instructions: [{ verb: "WinGame" }] });
// "Forced: After characters are committed to the quest, no more than 5 progress can be placed here this round (10 progress instead if Mendor is committed to the quest)" (the stage 2 cards; reading 9): the trigger is the start of the staging step, after the commitment, and the cap holds to the end of the round.
const progressCap = (code: string, line: string): Effect => ({
  id: `${code}:forced:1`,
  cardCode: code,
  lines: [line],
  timing: "forced",
  trigger: "stagingStepBegins",
  instructions: [
    { verb: "ModifyStat", stat: "questProgressCap", amount: 5, until: "endOfRound", target: "table", when: { kind: "not", condition: { kind: "canPick", pick: MENDOR_COMMITTED } } },
    { verb: "ModifyStat", stat: "questProgressCap", amount: 10, until: "endOfRound", target: "table", when: { kind: "canPick", pick: MENDOR_COMMITTED } },
  ],
});
// "Cannot have non-objective player card attachments or take non-combat damage." (51112, 51115, 51145: the records of 51012:A:1).
const armoured = (code: string): Effect[] => [
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", condition: { kind: "sourceIn", zone: "play" }, instructions: [{ verb: "Restrict", what: "attach", exceptTrait: "objective player card" }] },
  { id: `${code}:constant:2`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeNonCombatDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] },
];
// "Shadow: Attacking enemy gets +N Attack (+M Attack instead if <condition>)".
const plusAttack = (amount: number, instead: number, when: Extract<Condition, { kind: "matches" | "threat" }>): Instruction[] => [
  { verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: when } },
  { verb: "ModifyStat", stat: "attack", amount: instead, until: "endOfAttack", target: "attacker", when },
];
// "Forced: When <location> is explored, the opposing team searches the encounter deck and discard pile for a non-unique <trait> enemy and adds it to the staging area. Shuffle the encounter deck."
const exploredSearch = (code: string, trait: string): Effect => explored(code, `${code}:A:2`, [{ verb: "SearchMove", trait, type: "enemy", nonUnique: true, to: "staging", byChallenge: true }, { verb: "ShuffleEncounterDeck" }]);
const exhaustOne: Instruction[] = [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 51101 Captured by Spiders (stage 1). Setup: Spider Den is in the staging area (the deal); the Quick-build keeps 7 of the 14 sets and the first player chooses a stage 2 and a stage 3 (reading 2); each player's 0 cost enemy or location, each of a different title, is found by the opposing team and added to the staging area (readings 3 and 6).
  // Side B: Spider Den, explored, flips into Mendor under the first player's control, ready (reading 8); the stage cannot be defeated unless the first player controls Mendor.
  {
    id: "51101:setup:1",
    cardCode: STAGE_1,
    lines: ["51101:A:1"],
    timing: "setup",
    instructions: [
      { verb: "BuildQuickDeck", sets: SETS, keep: 7 },
      { verb: "ChooseQuestStage", codes: [...STAGES_2] },
      { verb: "ChooseQuestStage", codes: [...STAGES_3] },
      EACH_PLAYER([{ verb: "SearchMove", types: ["enemy", "location"], maxCost: 0, to: "staging", different: true, deckOnly: true, byChallenge: true }]),
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  { id: "51101:forced:1", cardCode: STAGE_1, lines: ["51101:B:1"], timing: "forced", trigger: "locationExplored", subject: { type: "location", control: "any", names: ["Spider Den"] }, instructions: [{ verb: "FlipOver", into: MENDOR, target: "subject", control: "firstPlayer" }] },
  { id: "51101:constant:1", cardCode: STAGE_1, lines: ["51101:B:2"], timing: "constant", condition: { kind: "not", condition: { kind: "controls", code: MENDOR } }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 51103 Lost in the Dark (stage 2): the first treachery revealed each round gains Doomed 1 and its When Revealed effects cannot be canceled (reading 10).
  topSearch("51103", 1),
  { id: "51103:constant:1", cardCode: "51103", lines: ["51103:B:1"], timing: "constant", instructions: [{ verb: "UncancelableWhenRevealed", firstRevealedEachRound: true, doomed: 1 }] },
  progressCap("51103", "51103:B:2"),

  // 51104 "Don't Leave the Path" (stage 2): no progress on a location in the staging area; the players must travel (reading 12).
  topSearch("51104", 1),
  { id: "51104:constant:1", cardCode: "51104", lines: ["51104:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } }] },
  { id: "51104:constant:2", cardCode: "51104", lines: ["51104:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "mustTravel", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  progressCap("51104", "51104:B:3"),

  // 51105 Ambushed at Night (stage 2): each staging enemy gets -10 engagement cost (so it engages at the checks), cannot be optionally engaged and cannot take damage (reading 11).
  topSearch("51105", 1),
  {
    id: "51105:constant:1",
    cardCode: "51105",
    lines: ["51105:B:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "whileSourceInPlay", holders: ENEMY_IN_STAGING },
      { verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", holders: ENEMY_IN_STAGING },
      { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: ENEMY_IN_STAGING },
    ],
  },
  progressCap("51105", "51105:B:2"),

  // 51107 The Forest of Great Fear (stage 3): the opposing team finds an enemy of any cost (reading 13; the deck is shuffled after the search) and a resource goes on an enemy with cost 2 or higher; that enemy gets +2/+2 and is immune to player card effects, and the stage cannot be defeated while it is in play.
  topSearch("51107", 2),
  {
    id: "51107:whenRevealed:2",
    cardCode: "51107",
    lines: ["51107:B:1"],
    timing: "whenRevealed",
    instructions: [
      // "Then" (rr.then): the Pick and the resource follow only when the search found an enemy, which `remember` leaves as the picked card; the resource goes on the enemy the Pick chose, an enemy with cost 2 or more.
      { verb: "SearchMove", type: "enemy", to: "staging", byChallenge: true, remember: true },
      { verb: "ShuffleEncounterDeck" },
      { verb: "Pick", pick: { ...ENEMY_STAGED_OR_ENGAGED, minCost: 2, highestThreat: true, challenge: true }, when: FOUND_ENEMY },
      { verb: "PlaceResourceTokens", amount: 1, on: "picked", when: HAS_COST_2 },
      // "While this stage is in play, the enemy with a resource gets +2 Attack, +2 Defense, and is immune to player card effects": lasting on the enemy the resource went on, until this stage leaves play.
      ...(["attack", "defense", "immuneToPlayerCards"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: stat === "immuneToPlayerCards" ? 1 : 2, until: "whileSourceInPlay", target: "picked", when: HAS_COST_2 })),
    ],
  },
  { id: "51107:constant:2", cardCode: "51107", lines: ["51107:B:2"], timing: "constant", condition: { kind: "canPick", pick: { ...ENEMY_STAGED_OR_ENGAGED, hasResources: true } }, instructions: [{ verb: "Restrict", what: "advance" }] },
  wins("51107", "51107:B:2"),

  // 51108 To the Elvenking's Halls (stage 3): X is the highest threat; the table's note of the quest phase's progress (51108:constant:3, switched on by this stage) is carried under the constant line B:2; no player's threat is reduced by more than 1 each round; after the players quest successfully with 10 or more progress placed here this phase the top card is revealed (reading 14; the table notes the quest phase's progress).
  topSearch("51108", 2),
  { id: "51108:constant:1", cardCode: "51108", lines: ["51108:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { highestThreat: true }, until: "whileSourceInPlay", target: "self" }] },
  { id: "51108:constant:2", cardCode: "51108", lines: ["51108:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threatReductionCap", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  { id: "51108:constant:3", cardCode: "51108", lines: ["51108:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noteQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "51108:forced:1", cardCode: "51108", lines: ["51108:B:3"], timing: "forced", trigger: "questSucceeded", condition: { kind: "all", conditions: [{ kind: "firstPlayer" }, { kind: "questProgressNoted", is: true, min: 10 }] }, instructions: [{ verb: "RevealEncounter" }] },
  wins("51108", "51108:B:4"),

  // 51109 Escape from Taur-nu-Fuin (stage 3): at the beginning of the quest phase cards are discarded until a location (the discard pile is shuffled into an empty deck, reading 15) and it is added to the staging area.
  topSearch("51109", 2),
  {
    id: "51109:forced:1",
    cardCode: "51109",
    lines: ["51109:B:1"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Quest" },
    instructions: [{ verb: "DiscardUntil", type: "location", reshuffle: true }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "location", control: "any" }, inPlay: false } }],
  },
  wins("51109", "51109:B:2"),

  // 51110 Spider Den: Travel: the opposing team finds a 0 cost enemy (1 cost or less with two or more players) in the deck or discard pile and adds it to the staging area.
  { id: "51110:travel:1", cardCode: SPIDER_DEN, lines: ["51110:A:2"], timing: "travel", instructions: [{ verb: "SearchMove", type: "enemy", maxCost: 0, maxCostMulti: 1, to: "staging", byChallenge: true }, { verb: "ShuffleEncounterDeck" }] },

  // 51111 Mendor: the first player gains control of him, as an ally, and each new first player after him (reading 7); he leaving play loses the game (the template 51111:triggered:1).
  { id: "51111:constant:1", cardCode: MENDOR, lines: ["51111:A:2"], timing: "constant", instructions: [{ verb: "ControlledBy", who: "firstPlayer", card: "self", intoPlay: true, follows: true }] },

  // 51112 Ungoliant's Spawn: no non-objective player card attachments, no non-combat damage; while in the staging area no player card effect readies a character.
  ...armoured("51112"),
  { id: "51112:constant:3", cardCode: "51112", lines: ["51112:A:2"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotReadyByPlayerCard", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } }] },

  // 51113 Forest Grove: X is 1 more than the stage number; Travel: each player deals X damage to a character he controls.
  { id: "51113:constant:1", cardCode: "51113", lines: ["51113:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: STAGE_PLUS_1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "questPoints", amount: STAGE_PLUS_1, until: "whileSourceInPlay", target: "self" }] },
  { id: "51113:travel:1", cardCode: "51113", lines: ["51113:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "Pick", pick: MY_CHARACTER }, { verb: "DamageCard", amount: STAGE_PLUS_1, target: "picked" }])] },

  // 51114 Despair: no character's printed text box counts until the end of the round; the Shadow blanks the defender's until the end of the phase (Traits stay).
  { id: "51114:whenRevealed:1", cardCode: "51114", lines: ["51114:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfRound", holders: { type: "character", control: "any" } }] },
  { id: "51114:shadow:1", cardCode: "51114", lines: ["51114:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfPhase", target: "defender" }] },

  // 51115 Chieftain Ufthak: after he engages you the opposing team puts an Orc enemy of cost 1 or less from the deck or discard pile into play engaged with you.
  ...armoured("51115"),
  { id: "51115:forced:1", cardCode: "51115", lines: ["51115:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "SearchMove", trait: "Orc", type: "enemy", maxCost: 1, to: "engaged", byChallenge: true }, { verb: "ShuffleEncounterDeck" }] },

  // 51116 Abandoned Camp: explored, the opposing team shuffles a card of the encounter discard pile into the deck: the enemy or location with the highest Threat (an enemy: then Attack), else the card discarded last (reading 3).
  {
    id: "51116:forced:1",
    cardCode: "51116",
    lines: ["51116:A:1"],
    timing: "forced",
    trigger: "leftPlay",
    subject: "self",
    condition: { kind: "subjectExplored" },
    instructions: [{ verb: "Pick", pick: { type: "card", control: "any", from: "encounterDiscard", highestThreat: true, challenge: true } }, { verb: "MoveEncounterCard", card: "picked", to: "shuffle" }],
  },

  // 51117 Gathering Gloom: each player raises his threat by X; the Shadow gives +1 Attack, +2 when your threat is 35 or higher.
  { id: "51117:whenRevealed:1", cardCode: "51117", lines: ["51117:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "RaiseThreat", amount: STAGE_PLUS_1, who: "actor" }])] },
  { id: "51117:shadow:1", cardCode: "51117", lines: ["51117:A:2"], timing: "shadow", instructions: plusAttack(1, 2, { kind: "threat", min: 35 }) },

  // 51118 Black Forest Bats: the opposing team removes the questing character with the highest Willpower from the quest. Shadow: shuffled into the encounter deck.
  {
    id: "51118:whenRevealed:1",
    cardCode: "51118",
    lines: ["51118:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { type: "character", control: "any", committed: true, highestWillpower: true, challenge: true } },
      { verb: "RemoveFromQuest", when: { kind: "canPick", pick: { type: "character", control: "any", committed: true } } },
    ],
  },
  { id: "51118:shadow:1", cardCode: "51118", lines: ["51118:A:2"], timing: "shadow", instructions: [{ verb: "ShuffleSelfIntoEncounterDeck" }] },

  // 51119 Enchanted Stream: no progress on the main quest while it is in the staging area. Travel: each player exhausts a hero; those heroes cannot ready while it is the active location (reading 16).
  { id: "51119:constant:1", cardCode: "51119", lines: ["51119:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "51119:travel:1",
    cardCode: "51119",
    lines: ["51119:A:2"],
    timing: "travel",
    instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "hero", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "whileSourceActive", target: "picked" }])],
  },

  // 51120 Exhaustion: each player exhausts a character; until the end of the round no player card effect readies a character. Shadow: the defender cannot ready until the end of the round.
  { id: "51120:whenRevealed:1", cardCode: "51120", lines: ["51120:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER(exhaustOne), { verb: "ModifyStat", stat: "cannotReadyByPlayerCard", amount: 1, until: "endOfRound", target: "characters" }] },
  { id: "51120:shadow:1", cardCode: "51120", lines: ["51120:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "defender" }] },

  // 51121 Spiders of Mirkwood: after it engages you, exhaust a character you control. Shadow: +1 Attack, +2 for a Spider.
  { id: "51121:forced:1", cardCode: "51121", lines: ["51121:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: exhaustOne },
  { id: "51121:shadow:1", cardCode: "51121", lines: ["51121:A:2"], timing: "shadow", instructions: plusAttack(1, 2, ATTACKER_IS({ type: "enemy", control: "any", trait: "Spider" })) },

  // 51122 The Spiders' Ring: each Spider enemy gets +1 Threat while it is in the staging area; explored, the opposing team adds a non-unique Spider enemy to the staging area.
  { id: "51122:constant:1", cardCode: "51122", lines: ["51122:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { ...ENEMY_STAGED_OR_ENGAGED, trait: "Spider" } }] },
  exploredSearch("51122", "Spider"),

  // 51123 Caught in a Web: attached to the hero with the highest Willpower that has no copy (reading 3) and exhausts it; the hero cannot ready unless its controller spends 2 resources from its pool (reading 17, the records of 01080).
  {
    id: "51123:whenRevealed:1",
    cardCode: "51123",
    lines: ["51123:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { type: "hero", control: "any", hasAttachment: { names: ["Caught in a Web"], none: true }, highestWillpower: true, challenge: true } },
      { verb: "AttachSelfToPicked" },
      { verb: "Exhaust", target: { kind: "picked" } },
    ],
  },
  { id: "51123:constant:1", cardCode: "51123", lines: ["51123:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "doesNotReady", amount: 1, until: "whileSourceInPlay", target: "host" }, { verb: "ModifyStat", stat: "readyPayment", amount: 2, until: "whileSourceInPlay", target: "host" }] },

  // 51124 Wolf Rider: surge with another Orc enemy in the staging area. Shadow: with an Orc attacker it enters play engaged with you.
  { id: "51124:whenRevealed:1", cardCode: "51124", lines: ["51124:A:1"], timing: "whenRevealed", instructions: [{ verb: "GainSurge", when: { kind: "canPick", pick: { ...ENEMY_IN_STAGING, trait: "Orc", other: true } } }] },
  { id: "51124:shadow:1", cardCode: "51124", lines: ["51124:A:2"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "engaged", when: ATTACKER_IS({ type: "enemy", control: "any", trait: "Orc" }) }] },

  // 51125 The Goblins' Caves: each Orc enemy gets +1 Attack while it is in the staging area; explored, the opposing team adds a non-unique Orc enemy to the staging area.
  { id: "51125:constant:1", cardCode: "51125", lines: ["51125:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: { ...ENEMY_STAGED_OR_ENGAGED, trait: "Orc" } }] },
  exploredSearch("51125", "Orc"),

  // 51126 Driven by Shadow: attached to the enemy with the highest Threat (then Attack) that has none, which returns to the staging area (reading 3); with no such enemy it gains surge.
  {
    id: "51126:whenRevealed:1",
    cardCode: "51126",
    lines: ["51126:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { ...ENEMY_STAGED_OR_ENGAGED, hasAttachment: { names: ["Driven by Shadow"], none: true }, highestThreat: true, challenge: true } },
      { verb: "AttachSelfToPicked" },
      { verb: "ReturnToStaging", target: { kind: "picked" } },
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: ENEMY_STAGED_OR_ENGAGED } } },
    ],
  },
  {
    id: "51126:constant:1",
    cardCode: "51126",
    lines: ["51126:A:1"],
    timing: "constant",
    instructions: [
      { verb: "CountsAs", cardType: "attachment", trait: "Condition" },
      { verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "host" },
    ],
  },

  // 51127 Beast of Taur-nu-Fuin: +1 Attack for each damage on it; dealt a shadow card with no effect it and the defender take 1 damage.
  { id: "51127:constant:1", cardCode: "51127", lines: ["51127:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "damage", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  { id: "51127:forced:1", cardCode: "51127", lines: ["51127:A:2"], timing: "forced", trigger: "attackResolved", subject: "self", condition: { kind: "shadowBlank" }, instructions: [{ verb: "DamageCard", amount: 1, target: "self" }, { verb: "DamageCard", amount: 1, target: "other" }] },

  // 51128 Dark Black Woods: +1 Threat for each in the staging area; Travel: each player discards 1 card from his hand for each in the staging area.
  { id: "51128:constant:1", cardCode: "51128", lines: ["51128:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: STAGING_DARK_WOODS }, until: "whileSourceInPlay", target: "self" }] },
  { id: "51128:travel:1", cardCode: "51128", lines: ["51128:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "DiscardFromHand", amount: { count: STAGING_DARK_WOODS } }])] },

  // 51129 Wind-whipped Rain: each player either keeps 1 card of his hand and discards the rest, or assigns X damage among his characters, X the number of cards in his hand. Shadow: 1 random card of your hand is discarded.
  {
    id: "51129:whenRevealed:1",
    cardCode: "51129",
    lines: ["51129:A:1"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "keep", requires: { kind: "count", pick: { type: "card", control: "you", from: "hand" }, min: 1 }, instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "hand" } }, { verb: "DiscardEach", pick: { type: "card", control: "you", from: "hand", different: true } }] },
            { id: "damage", requires: { kind: "count", pick: { type: "card", control: "you", from: "hand" }, min: 1 }, instructions: [{ verb: "AssignDamage", amount: { count: { type: "card", control: "you", from: "hand" } }, pick: MY_CHARACTER }] },
          ],
        },
      ]),
    ],
  },
  { id: "51129:shadow:1", cardCode: "51129", lines: ["51129:A:2"], timing: "shadow", instructions: [{ verb: "DiscardRandomFromHand" }] },

  // 51130 Giant Spider: each player exhausts a character (the Shadow: you do).
  { id: "51130:whenRevealed:1", cardCode: "51130", lines: ["51130:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER(exhaustOne)] },
  { id: "51130:shadow:1", cardCode: "51130", lines: ["51130:A:2"], timing: "shadow", instructions: exhaustOne },

  // 51131 Giant Web: becomes the active location, any previous active location returning to the staging area.
  { id: "51131:whenRevealed:1", cardCode: "51131", lines: ["51131:A:1"], timing: "whenRevealed", instructions: [{ verb: "MakeActive", target: "self" }] },

  // 51132 Eyes of the Forest: the opposing team discards the card of highest printed cost from each hand (reading 3). Shadow: +X Attack, X the stage number.
  { id: "51132:whenRevealed:1", cardCode: "51132", lines: ["51132:A:2"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "card", control: "you", from: "hand", highestCost: true, challenge: true } }, { verb: "DiscardPicked" }])] },
  { id: "51132:shadow:1", cardCode: "51132", lines: ["51132:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stage: true }, until: "endOfAttack", target: "attacker" }] },

  // 51133 Mirkwood Patrol: no enemy can be optionally engaged while it is in the staging area. Shadow: +1 Attack, +2 when the attacker was engaged this round.
  { id: "51133:constant:1", cardCode: "51133", lines: ["51133:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "51133:shadow:1", cardCode: "51133", lines: ["51133:A:2"], timing: "shadow", instructions: plusAttack(1, 2, ATTACKER_IS({ type: "enemy", control: "any", engagedThisRound: true })) },

  // 51134 Mountains of Mirkwood: while in the staging area it raises each player's threat by 2 at the end of the round. Shadow: either raise your threat by 2 or the attacker gets +2 Attack.
  { id: "51134:forced:1", cardCode: "51134", lines: ["51134:A:1"], timing: "forced", trigger: "endOfRound", condition: IN_STAGING, instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },
  { id: "51134:shadow:1", cardCode: "51134", lines: ["51134:A:2"], timing: "shadow", instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2, who: "actor" }] }, { id: "attack", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker" }] }] }] },

  // 51135 Hatred Rekindled: each engaged enemy makes an immediate attack, surge when none did. Shadow: +1 Attack and an additional shadow card whose effects cannot be canceled.
  { id: "51135:whenRevealed:1", cardCode: "51135", lines: ["51135:A:1"], timing: "whenRevealed", instructions: [{ verb: "ImmediateAttackEach" }, { verb: "GainSurge", when: { kind: "noneReturned" } }] },
  { id: "51135:shadow:1", cardCode: "51135", lines: ["51135:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "ModifyStat", stat: "shadowsUncancelable", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "DealShadow", additional: true }] },

  // 51136 Wild Bear: Threat and Defense X, 1 more than the stage number. Shadow: the attacker gets +X Defense until the end of the phase, X the stage number.
  { id: "51136:constant:1", cardCode: "51136", lines: ["51136:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: STAGE_PLUS_1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "defense", amount: STAGE_PLUS_1, until: "whileSourceInPlay", target: "self" }] },
  { id: "51136:shadow:1", cardCode: "51136", lines: ["51136:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: { stage: true }, until: "endOfPhase", target: "attacker" }] },

  // 51137 Labyrinthine Woods: each location in the staging area gets +1 Threat until the end of the phase. Shadow: each enemy engaged with you gets +1 Attack until the end of the phase.
  { id: "51137:whenRevealed:1", cardCode: "51137", lines: ["51137:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", holders: { type: "location", control: "any", stagingOnly: true } }] },
  { id: "51137:shadow:1", cardCode: "51137", lines: ["51137:A:2"], timing: "shadow", instructions: [{ verb: "Each", pick: ENGAGED_WITH_YOU, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfPhase", target: "picked" }] }] },

  // 51138 Vastness of Mirkwood: the top-5 search takes a card with cost no more than the stage number, with no bar on canceling (reading 5). Shadow: a destroyed character reveals the top card.
  { id: "51138:whenRevealed:1", cardCode: "51138", lines: ["51138:A:1"], timing: "whenRevealed", instructions: [{ verb: "SearchTopReveal", top: 5, maxCostStage: true, cancelable: true }] },
  { id: "51138:shadow:1", cardCode: "51138", lines: ["51138:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RevealEncounter", when: KILLED }] }] },

  // 51139 Mirkwood Flock: Shadow: it is added to the staging area.
  { id: "51139:shadow:1", cardCode: "51139", lines: ["51139:A:2"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging" }] },

  // 51140 The Eaves of Mirkwood: while in the staging area no more than 1 progress goes on each location there each round. Travel: each player discards 1 random card from his hand.
  { id: "51140:constant:1", cardCode: "51140", lines: ["51140:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "progressCap", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } }] },
  { id: "51140:travel:1", cardCode: "51140", lines: ["51140:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "DiscardRandomFromHand" }])] },

  // 51141 Massing at Night: the opposing team finds one different 0 cost enemy per player (at most 2). Shadow: a destroyed character gives an additional attack against you.
  { id: "51141:whenRevealed:1", cardCode: "51141", lines: ["51141:A:1"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", limit: 2, instructions: [{ verb: "SearchMove", type: "enemy", maxCost: 0, to: "staging", different: true, byChallenge: true }] } as Instruction, { verb: "ShuffleEncounterDeck" }] },
  { id: "51141:shadow:1", cardCode: "51141", lines: ["51141:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ImmediateAttack", when: KILLED }] }] },

  // 51142 Wild Wargs: dealt a shadow card with no effect, it returns to the staging area (the records of 01085:A:1).
  { id: "51142:forced:1", cardCode: "51142", lines: ["51142:A:1"], timing: "forced", trigger: "attackResolved", subject: "self", condition: { kind: "shadowBlank" }, instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] },

  // 51143 Dry Watercourse: while in the staging area no player's threat is reduced by more than 1 each round. Travel: raise each player's threat by 1.
  { id: "51143:constant:1", cardCode: "51143", lines: ["51143:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "threatReductionCap", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  { id: "51143:travel:1", cardCode: "51143", lines: ["51143:A:2"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },

  // 51144 Turned Around: 5 progress comes off the main quest and this card attaches to it as a Condition: the quest gets +5 quest points.
  { id: "51144:whenRevealed:1", cardCode: "51144", lines: ["51144:A:1"], timing: "whenRevealed", instructions: [{ verb: "RemoveProgressFromQuest", amount: 5 }, { verb: "AttachToQuest", main: true }] },
  { id: "51144:constant:1", cardCode: "51144", lines: ["51144:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "questPoints", amount: 5, until: "whileSourceInPlay", target: "host" }] },

  // 51145 Pack of Wargs: dealt a shadow card with no effect, it makes an additional attack with no shadow card.
  ...armoured("51145"),
  { id: "51145:forced:1", cardCode: "51145", lines: ["51145:A:2"], timing: "forced", trigger: "attackResolved", subject: "self", condition: { kind: "shadowBlank" }, instructions: [{ verb: "ImmediateAttack", shadow: false }] },

  // 51146 Dark-wood Grove: while in the staging area it gains a Forced effect raising each player's threat by 3 after a When Revealed effect is canceled. Travel: reveal the top card of the encounter deck.
  { id: "51146:forced:1", cardCode: "51146", lines: ["51146:A:1"], timing: "forced", trigger: "whenRevealedCanceled", condition: IN_STAGING, instructions: [{ verb: "RaiseThreat", amount: 3, who: "eachSeat" }] },
  { id: "51146:travel:1", cardCode: "51146", lines: ["51146:A:2"], timing: "travel", instructions: [{ verb: "RevealEncounter" }] },

  // 51147 Lost and Witless: each player reveals his hand and discards each ally card in it. Shadow: with an undefended attack, discard an ally you control.
  { id: "51147:whenRevealed:1", cardCode: "51147", lines: ["51147:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Each", pick: { type: "ally", control: "you", from: "hand" }, instructions: [{ verb: "DiscardPicked" }] }])] },
  { id: "51147:shadow:1", cardCode: "51147", lines: ["51147:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "ally", control: "you" }, when: { kind: "undefended" } }, { verb: "Discard", target: { kind: "picked" }, when: { kind: "undefended" } }] },

  // 51148 Wicked Spider: after it engages you, discard an exhausted character you control. Shadow: the attacker cannot take damage this phase.
  { id: "51148:forced:1", cardCode: "51148", lines: ["51148:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "exhausted" } }, { verb: "Discard", target: { kind: "picked" } }] },
  { id: "51148:shadow:1", cardCode: "51148", lines: ["51148:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfPhase", target: "attacker" }] },

  // 51149 Old Forest Road: the records of 41015:A:1 and 41015:A:2 (the same printed text).
  { id: "51149:response:1", cardCode: "51149", lines: ["51149:A:1"], timing: "response", trigger: "traveled", instructions: [{ verb: "DiscardFromDeck", amount: 1 }, { verb: "Pick", pick: { type: "card", control: "you", from: "discard", looked: true, cardType: "ally" } }, { verb: "PutIntoPlay", card: "picked", who: "actor" }] },
  { id: "51149:travel:1", cardCode: "51149", lines: ["51149:A:2"], timing: "travel", instructions: [{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" } } }] },

  // 51150 A Frightened Beast: each player either raises his threat by 1 for each questing character he controls or discards one. Shadow: +1 Attack; a destroyed character raises each player's threat by 1.
  {
    id: "51150:whenRevealed:1",
    cardCode: "51150",
    lines: ["51150:A:1"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "threat", instructions: [{ verb: "RaiseThreat", amount: { count: { type: "character", control: "you", committed: true } }, who: "actor" }] },
            { id: "discard", requires: { kind: "canPick", pick: { type: "character", control: "you", committed: true } }, instructions: [{ verb: "Pick", pick: { type: "character", control: "you", committed: true } }, { verb: "Discard", target: { kind: "picked" } }] },
          ],
        },
      ]),
    ],
  },
  { id: "51150:shadow:1", cardCode: "51150", lines: ["51150:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat", when: KILLED }] }] },

  // 51151 Ambushing Orcs: it makes an immediate attack against the first player. Shadow: the lowest engagement cost enemy in the staging area engages you and is dealt a shadow card (reading 18).
  { id: "51151:whenRevealed:1", cardCode: "51151", lines: ["51151:A:1"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: { ...ENEMY_IN_STAGING, isSource: true } }, { verb: "AttackFromStaging", who: "firstPlayer" }] },
  {
    id: "51151:shadow:1",
    cardCode: "51151",
    lines: ["51151:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Pick", pick: { ...ENEMY_IN_STAGING, lowestEngagementCost: true } }, { verb: "Engage", target: "picked", when: { kind: "canPick", pick: ENEMY_IN_STAGING } }, { verb: "DealShadowTo", target: "picked", when: { kind: "canPick", pick: ENEMY_IN_STAGING } }],
  },

  // 51152 Mirkwood Path: explored, the top card of the encounter deck is discarded; a location so discarded is added to the staging area.
  explored("51152", "51152:A:1", [{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "location", control: "any" } } }]),

  // 51153 Wasted Provisions: the records of 18041:A:1 (each player discards the resources of his heroes and raises his threat by 1 for each; surge when none).
  { id: "51153:whenRevealed:1", cardCode: "51153", lines: ["51153:A:1"], timing: "whenRevealed", instructions: [{ verb: "GainSurge", when: { kind: "less", left: { resourcesOn: { type: "hero", control: "any" } }, right: 1 } }, EACH_PLAYER([{ verb: "RaiseThreat", amount: { resourcesOn: { type: "hero", control: "you" } }, who: "actor" }]), { verb: "Each", pick: { type: "hero", control: "any" }, instructions: [{ verb: "DiscardResources", all: true, target: "picked" }] }] },
  { id: "51153:shadow:1", cardCode: "51153", lines: ["51153:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
