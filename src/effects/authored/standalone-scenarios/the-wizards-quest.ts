import type { Amount, Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Wizard's Quest (standalone-scenarios cycle part 10, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// The scenario is a kit: the quest card 51001's Setup builds the Quick-build game (BuildQuickDeck: 7 of the 14 encounter sets; ChooseQuestStage: the first player's stage 2 and stage 3) and searches for the 0 cost enemy or location of each player. "The opposing team" chooses
// and searches in the manner that gives the players the greatest challenge: the engine's fixed policy, never a prompt (docs/scenarios/standalone-scenarios/the-wizards-quest.md, The Wizard's Quest, readings 1 and 3: the search fields byChallenge, maxCost, maxCostMulti, types and top; the pick field `challenge`).
// Rules: rr.search, rr.reveal, rr.cancel, rr.guarded, rr.explored, rr.forced, rr.travel, rr.engaged, rr.staging, rr.first-player, rr.the-word-choose, rr.victory, rr.quest-advancement, rr.in-play-and-out-of-play, rr.attachment-cards, rr.doomed-x, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json).
const STAGE_1 = "51001";
const STAGES_2 = ["51003", "51004", "51005"] as const;
const STAGES_3 = ["51007", "51008", "51009"] as const;
const RHOSGOBEL = "51010";
const RIDER = "51011";
const SETS = Array.from({ length: 14 }, (_, at) => `The Wizard's Quest ${15 + at}`);

const EACH_PLAYER = (instructions: Instruction[]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions } as Instruction);
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const RIDER_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Rider of Mirkwood"] };
const ENEMY_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
const MY_CHARACTER: PickSpec = { type: "character", control: "you" };
const MY_HERO: PickSpec = { type: "hero", control: "you" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const ATTACKER_UNIQUE_OR_NOT = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", unique: true } } as const;
const DEFENDER_DAMAGED = { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: true } } as const;
// "X is 1 more than the stage number of the main quest" (51011:A:2, 51020:A:1).
const STAGE_PLUS_1: Amount = { stage: true, plus: 1 };
const ENGAGED_WITH_YOU: PickSpec = { type: "enemy", control: "any", engaged: "you" };
const SOME_PROGRESS: Condition = { kind: "stageProgress", min: 1 };
const KILLED = { kind: "x", min: 1 } as const;

// "When <location> is explored": the trigger `locationExplored` hears the exploring of a location in the staging area and of the active location (triggerHears), so one record serves both.
const explored = (code: string, line: string, instructions: Instruction[]): Effect[] => [
  { id: `${code}:forced:1`, cardCode: code, lines: [line], timing: "forced", trigger: "locationExplored", subject: "self", instructions },
];
// "The opposing team searches the top 5 cards of the encounter deck for a card with cost N or less (M or less if there are two or more players) ..." (the A side of every stage 2 and stage 3 card).
const topSearch = (code: string, line: string, maxCost: number): Effect => ({
  id: `${code}:whenRevealed:1`,
  cardCode: code,
  lines: [line],
  timing: "whenRevealed",
  instructions: [{ verb: "SearchTopReveal", top: 5, maxCost, maxCostMulti: maxCost + 1 }],
});
// "Players cannot defeat this stage while <card> is in play. If the players defeat this stage, they win the game." (the stage 3 cards).
const wins = (code: string, line: string): Effect => ({ id: `${code}:questResolution:1`, cardCode: code, lines: [line], timing: "questResolution", instructions: [{ verb: "WinGame" }] });
// "Shadow: Attacking enemy gets +N Attack (+M Attack instead if <condition>)".
const plusAttack = (amount: number, instead: number, when: Extract<Condition, { kind: "matches" }>): Instruction[] => [
  { verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: when } },
  { verb: "ModifyStat", stat: "attack", amount: instead, until: "endOfAttack", target: "attacker", when },
];
const damageOneOf = (pick: PickSpec): Instruction => EACH_PLAYER([{ verb: "Pick", pick }, { verb: "DamageCard", amount: 1, target: "picked" }]);

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 51001 Radagast's Request (stage 1). Setup: Rhosgobel is in the staging area (the piles); the Quick-build keeps 7 of the 14 sets and the first player chooses a stage 2 and a stage 3 (readings 2); each player's 0 cost enemy or location, each of a different title, is found by the opposing team and added to the staging area (readings 3 and 6).
  // Side B: Rhosgobel, explored, is flipped over: the one two-sided card shows Rider of Mirkwood in the staging area (reading 7); the stage cannot be defeated while Rhosgobel is in play.
  {
    id: "51001:setup:1",
    cardCode: STAGE_1,
    lines: ["51001:A:1"],
    timing: "setup",
    instructions: [
      { verb: "BuildQuickDeck", sets: SETS, keep: 7 },
      { verb: "ChooseQuestStage", codes: [...STAGES_2] },
      { verb: "ChooseQuestStage", codes: [...STAGES_3] },
      EACH_PLAYER([{ verb: "SearchMove", types: ["enemy", "location"], maxCost: 0, to: "staging", different: true, deckOnly: true, byChallenge: true }]),
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  ...explored(RHOSGOBEL, "51001:B:1", []).map((effect): Effect => ({ ...effect, id: effect.id.replace(RHOSGOBEL, STAGE_1), cardCode: STAGE_1, subject: { type: "location", control: "any", names: ["Rhosgobel"] }, instructions: [{ verb: "FlipOver", into: RIDER, target: "subject" }] })),
  { id: "51001:constant:1", cardCode: STAGE_1, lines: ["51001:B:2"], timing: "constant", condition: { kind: "inPlay", code: RHOSGOBEL, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 51003 A Fork in the Road (stage 2). The location found has a resource on it; while the stage has quest points left it is immune to player card effects and cannot be traveled to (reading 12), and the stage cannot be defeated while it is in play.
  topSearch("51003", "51003:A:1", 1),
  {
    id: "51003:whenRevealed:2",
    cardCode: "51003",
    lines: ["51003:B:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "SearchMove", type: "location", maxCost: 2, to: "staging", byChallenge: true, remember: true }, { verb: "PlaceResourceTokens", amount: 1, on: "picked" }, { verb: "ShuffleEncounterDeck" }],
  },
  {
    id: "51003:constant:1",
    cardCode: "51003",
    lines: ["51003:B:2"],
    timing: "constant",
    condition: { kind: "not", condition: { kind: "stageProgress", min: 5 } },
    instructions: [
      { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", hasResources: true } },
      { verb: "Restrict", what: "travel", withResources: true },
    ],
  },
  { id: "51003:constant:2", cardCode: "51003", lines: ["51003:B:2"], timing: "constant", condition: { kind: "canPick", pick: { type: "location", control: "any", hasResources: true } }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 51004 Carried Away (stage 2). Each player's ally with the highest printed cost lies faceup under the stage (reading 9); no copy of its title can be played; the stage's defeat returns each to its owner's hand.
  topSearch("51004", "51004:A:1", 1),
  { id: "51004:whenRevealed:2", cardCode: "51004", lines: ["51004:B:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "ally", control: "you", highestCost: true, challenge: true } }, { verb: "HoldPickedUnder" }])] },
  { id: "51004:constant:1", cardCode: "51004", lines: ["51004:B:2"], timing: "constant", instructions: [{ verb: "BarHeldTitles" }] },
  { id: "51004:forced:1", cardCode: "51004", lines: ["51004:B:2"], timing: "forced", trigger: "questCardDefeated", subject: "self", instructions: [{ verb: "ReturnFacedownToHands" }] },

  // 51005 A New Terror Abroad (stage 2). +5 quest points for each player; at the beginning of the quest phase Rider of Mirkwood attacks the first player from the staging area.
  topSearch("51005", "51005:A:1", 1),
  { id: "51005:constant:1", cardCode: "51005", lines: ["51005:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { players: true, times: 5 }, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "51005:forced:1",
    cardCode: "51005",
    lines: ["51005:B:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Quest" },
    instructions: [{ verb: "Pick", pick: RIDER_ENEMY }, { verb: "AttackFromStaging", who: "firstPlayer" }],
  },

  // 51007 The Necromancer's Tower (stage 3): after the characters are committed, discard until a treachery is discarded and reveal it (reading 11); defeating the stage wins the game.
  topSearch("51007", "51007:A:1", 2),
  { id: "51007:forced:1", cardCode: "51007", lines: ["51007:B:1"], timing: "forced", trigger: "stagingStepBegins", instructions: [{ verb: "DiscardUntil", type: "treachery" }, { verb: "ResolveWhenRevealed", reveal: true, when: { kind: "matches", card: "picked", pick: { type: "treachery", control: "any" }, inPlay: false } }] },
  wins("51007", "51007:B:2"),

  // 51008 Dungeons of the Necromancer (stage 3). Each player's chosen hero lies under the enemy he discards until (its tokens discarded, its attachments kept, reading 10); the hero returns exhausted when the enemy leaves play; the stage cannot be defeated while an enemy guards a hero.
  topSearch("51008", "51008:A:1", 2),
  {
    id: "51008:whenRevealed:2",
    cardCode: "51008",
    lines: ["51008:B:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ShuffleEncounterDiscard" }, EACH_PLAYER([{ verb: "Pick", pick: MY_HERO }, { verb: "DiscardUntil", type: "enemy" }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }, { verb: "CarryAwayHero", keepAttachments: true }])],
  },
  { id: "51008:forced:1", cardCode: "51008", lines: ["51008:B:2"], timing: "forced", trigger: "leftPlay", subject: { type: "card", control: "any", guardsHero: true }, instructions: [{ verb: "ReleaseGuardedHero" }] },
  { id: "51008:constant:1", cardCode: "51008", lines: ["51008:B:2"], timing: "constant", condition: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true, guardsHero: true } }, instructions: [{ verb: "Restrict", what: "advance" }] },
  wins("51008", "51008:B:2"),

  // 51009 Return to Rhosgobel (stage 3). Rider of Mirkwood's engagement cost is 0, its damage cannot exceed this stage's progress, and the stage cannot be defeated while Rider is in play.
  topSearch("51009", "51009:A:1", 2),
  { id: "51009:constant:1", cardCode: "51009", lines: ["51009:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -50, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, names: ["Rider of Mirkwood"] } }] },
  { id: "51009:constant:2", cardCode: "51009", lines: ["51009:B:2"], timing: "constant", condition: { kind: "not", condition: SOME_PROGRESS }, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: RIDER_ENEMY }] },
  { id: "51009:constant:3", cardCode: "51009", lines: ["51009:B:2"], timing: "constant", condition: SOME_PROGRESS, instructions: [{ verb: "ModifyStat", stat: "damageCeiling", amount: { stat: "progress", of: "self" }, until: "whileSourceInPlay", holders: RIDER_ENEMY }] },
  { id: "51009:constant:4", cardCode: "51009", lines: ["51009:B:3"], timing: "constant", condition: { kind: "inPlay", code: RIDER, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },
  wins("51009", "51009:B:3"),

  // 51010 Rhosgobel (location): Response after the players travel to it: each hero gains 1 resource and each player draws 1 card.
  { id: "51010:response:1", cardCode: RHOSGOBEL, lines: ["51010:A:2"], timing: "response", trigger: "traveled", instructions: [{ verb: "Each", pick: { type: "hero", control: "any" }, instructions: [{ verb: "AddResources", amount: 1, to: "picked" }] }, EACH_PLAYER([{ verb: "Draw", amount: 1 }])] },

  // 51011 Rider of Mirkwood: X is 1 more than the stage number; it cannot leave the staging area unless the players are at stage 3 (reading 8).
  { id: "51011:constant:1", cardCode: RIDER, lines: ["51011:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: STAGE_PLUS_1, until: "whileSourceInPlay", target: "self" }] },
  { id: "51011:constant:2", cardCode: RIDER, lines: ["51011:A:3"], timing: "constant", condition: { kind: "not", condition: { kind: "onStage", stage: 3 } }, instructions: [{ verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 51012 Nazgûl of Dol Guldur: no non-objective player card attachments (the template 51015:constant:1's), no non-combat damage; after it attacks you either it returns to the staging area or you raise your threat by 3.
  { id: "51012:constant:1", cardCode: "51012", lines: ["51012:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "play" }, instructions: [{ verb: "Restrict", what: "attach", exceptTrait: "objective player card" }] },
  { id: "51012:constant:2", cardCode: "51012", lines: ["51012:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeNonCombatDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "51012:forced:1",
    cardCode: "51012",
    lines: ["51012:A:2"],
    timing: "forced",
    trigger: "attackResolved",
    subject: "self",
    instructions: [{ verb: "Choose", who: "actor", options: [{ id: "return", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }, { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 3 }] }] }],
  },

  // 51013 Necromancer's Pass: the first player keeps a card of his hand and the opposing team lays the card of highest printed cost of the others under the Pass (reading 3); copies of it cannot be played; the Pass gives it back to its owner's hand when it leaves play, explored or not (the engine's sweep, held.ts).
  {
    id: "51013:whenRevealed:1",
    cardCode: "51013",
    lines: ["51013:A:1"],
    timing: "whenRevealed",
    instructions: [
      // The first player acts whoever revealed the card: his hand is the one looked at and the one the hand-size test reads.
      { verb: "ActAs", who: "firstPlayer" },
      { verb: "Pick", pick: { type: "card", control: "you", from: "hand", who: "firstPlayer" } },
      { verb: "Pick", pick: { type: "card", control: "you", from: "hand", who: "firstPlayer", different: true, highestCost: true, challenge: true }, when: { kind: "not", condition: { kind: "handSize", max: 1, actor: true } } },
      { verb: "HoldPickedUnder", when: { kind: "not", condition: { kind: "handSize", max: 1, actor: true } } },
      { verb: "BarHeldTitles" },
    ],
  },

  // 51014 Pursued by Shadow: the highest Attack enemy in the staging area attacks the first player, or the card gains surge. Shadow: a unique attacker attacks again.
  {
    id: "51014:whenRevealed:1",
    cardCode: "51014",
    lines: ["51014:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { ...ENEMY_IN_STAGING, highestAttack: true, who: "firstPlayer" } },
      { verb: "AttackFromStaging", who: "firstPlayer", when: { kind: "canPick", pick: ENEMY_IN_STAGING } },
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: ENEMY_IN_STAGING } } },
    ],
  },
  { id: "51014:shadow:1", cardCode: "51014", lines: ["51014:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", when: ATTACKER_UNIQUE_OR_NOT, instructions: [{ verb: "ImmediateAttack" }] }] },

  // 51015 Bane of Amon Lanc: after it destroys an ally the defending player discards 1 card for each excess point of damage.
  // The defending player is the player the enemy attacks, whoever controls the ally that defended (rr.defending-player): the discard runs for the player it is engaged with.
  { id: "51015:forced:1", cardCode: "51015", lines: ["51015:A:2"], timing: "forced", trigger: "characterDestroyedByAttack", subject: { type: "ally", control: "any" }, condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } }, instructions: [{ verb: "ForEachPlayer", order: "firstFirst", seats: "engaged", instructions: [{ verb: "DiscardFromHand", amount: { excessOf: "subject" } }] }] },

  // 51016 Oak-wood Grove: no progress on the other locations of the staging area while it is there; Travel: each player exhausts a character.
  { id: "51016:constant:1", cardCode: "51016", lines: ["51016:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true, other: true } }] },
  { id: "51016:travel:1", cardCode: "51016", lines: ["51016:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }])] },

  // 51017 Smoking Blood: attached to the Troll with the most hit points left (reading 3), or it gains surge; it is a Condition that cancels the damage that would destroy the enemy and is discarded.
  { id: "51017:whenRevealed:1", cardCode: "51017", lines: ["51017:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "enemy", trait: "Troll", challenge: true } }, { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true, trait: "Troll", hasAttachment: { names: ["Smoking Blood"], none: true } } } } }] },
  { id: "51017:constant:1", cardCode: "51017", lines: ["51017:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "cancelsLethalDamage", amount: 1, until: "whileSourceInPlay", target: "host" }] },

  // 51018 Forest Flies: raises the defending player's threat by 1 as it attacks. Shadow: raise your threat by 1 for each enemy engaged with you.
  { id: "51018:forced:1", cardCode: "51018", lines: ["51018:A:1"], timing: "forced", trigger: "enemyAttacks", subject: "self", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eventSeat" }] },
  { id: "51018:shadow:1", cardCode: "51018", lines: ["51018:A:2"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: { count: ENGAGED_WITH_YOU } }] },

  // 51019 Twilight Hall: +1 Threat for each character the first player controls; exploring it reveals 1 encounter card for each player.
  { id: "51019:constant:2", cardCode: "51019", lines: ["51019:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: { type: "character", control: "any", controlledBy: "firstPlayer" } }, until: "whileSourceInPlay", target: "self" }] },
  ...explored("51019", "51019:A:3", [EACH_PLAYER([{ verb: "RevealEncounter" }])]),

  // 51020 Swarming Mosquitoes: each player deals X damage to a character, X 1 more than the stage number. Shadow: +1 Attack, +2 when the defender has an attachment.
  { id: "51020:whenRevealed:1", cardCode: "51020", lines: ["51020:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Pick", pick: MY_CHARACTER }, { verb: "DamageCard", amount: STAGE_PLUS_1, target: "picked" }])] },
  { id: "51020:shadow:1", cardCode: "51020", lines: ["51020:A:2"], timing: "shadow", instructions: plusAttack(1, 2, { kind: "matches", card: "defender", pick: { type: "character", control: "any", hasAttachment: {} } }) },

  // 51021 Goblin Sniper: cannot be optionally engaged; at the end of the combat phase each player deals 1 damage to a hero. Shadow: the defender's Defense is not counted.
  { id: "51021:constant:1", cardCode: "51021", lines: ["51021:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "51021:forced:1", cardCode: "51021", lines: ["51021:A:2"], timing: "forced", trigger: "endOfPhase", condition: { kind: "phase", is: "Combat" }, instructions: [damageOneOf(MY_HERO)] },
  { id: "51021:shadow:1", cardCode: "51021", lines: ["51021:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defenseIgnored", amount: 1, until: "endOfAttack", target: "attacker" }] },

  // 51022 Pine Slopes: each Pine Slopes gets +2 Threat until the end of the phase. Travel: raise your threat (the first player's: he travels, rr.step-4-2, docs/scenarios/standalone-scenarios/the-wizards-quest.md, The Wizard's Quest, reading 14) by 1 for each Pine Slopes in the staging area.
  { id: "51022:whenRevealed:1", cardCode: "51022", lines: ["51022:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "endOfPhase", holders: { type: "location", control: "any", names: ["Pine Slopes"] } }] },
  { id: "51022:travel:1", cardCode: "51022", lines: ["51022:A:2"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: { count: { type: "location", control: "any", stagingOnly: true, names: ["Pine Slopes"] } }, who: "firstPlayer" }] },

  // 51023 Under the Shadow (Doomed 1 is a keyword): attached to the main quest as a Condition; each player cannot play more than 1 card each phase.
  { id: "51023:whenRevealed:1", cardCode: "51023", lines: ["51023:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachToQuest", main: true }] },
  { id: "51023:constant:1", cardCode: "51023", lines: ["51023:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "LimitPlaysPerPhase", max: 1 }] },

  // 51024 Necromancer's Warg: after it engages you, 1 damage to a character you control. Shadow: with an Orc and a Warg enemy engaged with you, discard a character you control.
  { id: "51024:forced:1", cardCode: "51024", lines: ["51024:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Pick", pick: MY_CHARACTER }, { verb: "DamageCard", amount: 1, target: "picked" }] },
  {
    id: "51024:shadow:1",
    cardCode: "51024",
    lines: ["51024:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "Pick", pick: MY_CHARACTER, when: { kind: "all", conditions: [{ kind: "canPick", pick: { ...ENGAGED_WITH_YOU, trait: "Orc" } }, { kind: "canPick", pick: { ...ENGAGED_WITH_YOU, trait: "Warg" } }] } },
      { verb: "DiscardPicked", when: { kind: "all", conditions: [{ kind: "canPick", pick: { ...ENGAGED_WITH_YOU, trait: "Orc" } }, { kind: "canPick", pick: { ...ENGAGED_WITH_YOU, trait: "Warg" } }] } },
    ],
  },

  // 51025 Dol Guldur Beastmaster: after it engages you the opposing team puts a Necromancer's Warg from the encounter deck or discard pile into play engaged with you.
  { id: "51025:forced:1", cardCode: "51025", lines: ["51025:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "SearchMove", code: "51024", to: "engaged" }, { verb: "ShuffleEncounterDeck" }] },

  // 51026 Watched Path: exploring it discards the top card of the encounter deck; an enemy so discarded is added to the staging area.
  ...explored("51026", "51026:A:1", [{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" } } }]),

  // 51027 Evil Storm: each player deals 1 damage to a questing character; each damaged character gets -1 Willpower and cannot be healed until the end of the phase (a lasting effect, faq.lasting-effects). Shadow: 1 damage to the defender.
  {
    id: "51027:whenRevealed:1",
    cardCode: "51027",
    lines: ["51027:A:1"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([{ verb: "Pick", pick: { type: "character", control: "you", committed: true } }, { verb: "DamageCard", amount: 1, target: "picked" }]),
      { verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfPhase", target: "damagedCharacters" },
      { verb: "ModifyStat", stat: "cannotBeHealed", amount: 1, until: "endOfPhase", target: "damagedCharacters" },
    ],
  },
  { id: "51027:shadow:1", cardCode: "51027", lines: ["51027:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },

  // 51028 Spider of Dol Guldur: after it destroys an ally it returns to the staging area. Shadow: the attacker attacks again.
  { id: "51028:forced:1", cardCode: "51028", lines: ["51028:A:1"], timing: "forced", trigger: "characterDestroyedByAttack", subject: { type: "ally", control: "any" }, condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } }, instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] },
  { id: "51028:shadow:1", cardCode: "51028", lines: ["51028:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ImmediateAttack" }] }] },

  // 51029 Patch of Midnight: at the beginning of the staging step it is discarded and the top card of the encounter deck is revealed. Shadow: if the attack destroys a character, reveal the top card.
  { id: "51029:forced:1", cardCode: "51029", lines: ["51029:A:1"], timing: "forced", trigger: "stagingStepBegins", condition: IN_STAGING, instructions: [{ verb: "Discard", target: { kind: "self" } }, { verb: "RevealEncounter" }] },
  { id: "51029:shadow:1", cardCode: "51029", lines: ["51029:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RevealEncounter", when: KILLED }] }] },

  // 51030 Eyes in the Dark: the opposing team chooses the questing character of each player with the highest Willpower (reading 3); it is readied and removed from the quest. Shadow: +1 Attack; a destroyed character raises each player's threat by 1.
  { id: "51030:whenRevealed:1", cardCode: "51030", lines: ["51030:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "character", control: "you", committed: true, highestWillpower: true, challenge: true } }, { verb: "Ready", target: "picked" }, { verb: "RemoveFromQuest" }])] },
  { id: "51030:shadow:1", cardCode: "51030", lines: ["51030:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat", when: KILLED }] }] },

  // 51031 Eastern Crows: while a copy is in the discard pile it gains surge.
  { id: "51031:constant:1", cardCode: "51031", lines: ["51031:A:1"], timing: "constant", condition: { kind: "encounterHas", piles: "discard", code: "51031" }, instructions: [{ verb: "ModifyStat", stat: "gainsSurge", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 51032 The Sorcerer's Tower: while in the staging area each treachery gains Doomed 1; exploring it shuffles the discard pile into the deck and resolves the first treachery discarded.
  { id: "51032:constant:1", cardCode: "51032", lines: ["51032:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "GainsDoomed", amount: 1, pick: { type: "treachery", control: "any" } }] },
  ...explored("51032", "51032:A:2", [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntil", type: "treachery" }, { verb: "ResolveWhenRevealed", reveal: true, when: { kind: "matches", card: "picked", pick: { type: "treachery", control: "any" }, inPlay: false } }]),

  // 51033 Power Sevenfold: the opposing team chooses one non-unique enemy or location in play, the one with the lowest Threat (reading 3), discards it and reveals 1 card. Shadow: either reveal an encounter card or treat the attack as undefended.
  {
    id: "51033:whenRevealed:1",
    cardCode: "51033",
    lines: ["51033:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Each", pick: { type: "card", control: "any", engagedEnemies: true, nonUnique: true, enemyOrLocation: true, lowestThreat: true, challenge: true }, instructions: [{ verb: "Discard", target: { kind: "picked" } }, { verb: "RevealEncounter" }] }],
  },
  { id: "51033:shadow:1", cardCode: "51033", lines: ["51033:A:2"], timing: "shadow", instructions: [{ verb: "Choose", who: "actor", options: [{ id: "reveal", instructions: [{ verb: "RevealEncounter" }] }, { id: "undefended", instructions: [{ verb: "ConsiderUndefended" }] }] }] },

  // 51035 Troll Cave: Response after the players travel here: each player draws 1 card. Travel: the opposing team finds a Hill Troll among the top 5 cards of the encounter deck and adds it to the staging area.
  { id: "51035:response:1", cardCode: "51035", lines: ["51035:A:1"], timing: "response", trigger: "traveled", instructions: [EACH_PLAYER([{ verb: "Draw", amount: 1 }])] },
  { id: "51035:travel:1", cardCode: "51035", lines: ["51035:A:2"], timing: "travel", instructions: [{ verb: "SearchMove", code: "51034", top: 5, to: "staging" }, { verb: "ShuffleEncounterDeck" }] },

  // 51036 Befouled Equipment: attached to the hero with the most attachments that has no Befouled Equipment (reading: the heroes carry the attachments); at the end of the round an attachment of the host is discarded, this card only when it is the only one.
  { id: "51036:whenRevealed:1", cardCode: "51036", lines: ["51036:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "character", control: "mostAttachments" } }] },
  {
    id: "51036:constant:1",
    cardCode: "51036",
    lines: ["51036:A:1"],
    timing: "constant",
    instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }],
  },
  {
    id: "51036:forced:1",
    cardCode: "51036",
    lines: ["51036:A:1"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [
      { verb: "Pick", pick: { type: "attachment", control: "any", attachedTo: "host", other: true } },
      { verb: "Discard", target: { kind: "picked" }, when: { kind: "canPick", pick: { type: "attachment", control: "any", attachedTo: "host", other: true } } },
      { verb: "Discard", target: { kind: "self" }, when: { kind: "not", condition: { kind: "canPick", pick: { type: "attachment", control: "any", attachedTo: "host", other: true } } } },
    ],
  },

  // 51037 Hunting Warg: after it engages a player it makes an immediate attack; dealt a shadow card with no effect for that attack it gets +2 Attack for it (ImmediateAttack `blankBonus`, for the attack itself: docs/scenarios/standalone-scenarios/the-wizards-quest.md, The Wizard's Quest, reading 16).
  { id: "51037:forced:1", cardCode: "51037", lines: ["51037:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "ImmediateAttack", blankBonus: 2 }] },

  // 51038 Hunter's Lookout: while in the staging area it raises each player's threat at the end of the round for each enemy in the staging area. Travel: the highest Attack enemy in the staging area attacks the first player.
  { id: "51038:forced:1", cardCode: "51038", lines: ["51038:A:1"], timing: "forced", trigger: "endOfRound", condition: IN_STAGING, instructions: [{ verb: "RaiseThreat", amount: { count: ENEMY_IN_STAGING }, who: "eachSeat" }] },
  { id: "51038:travel:1", cardCode: "51038", lines: ["51038:A:2"], timing: "travel", instructions: [{ verb: "Pick", pick: { ...ENEMY_IN_STAGING, highestAttack: true, who: "firstPlayer" } }, { verb: "AttackFromStaging", who: "firstPlayer", when: { kind: "canPick", pick: ENEMY_IN_STAGING } }] },

  // 51039 Restless Hunters: each engaged enemy returns to the staging area; with none returned it gains surge. Shadow: +1 Attack; a destroyed character sends the attacker back to the staging area.
  { id: "51039:whenRevealed:1", cardCode: "51039", lines: ["51039:A:1"], timing: "whenRevealed", instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "each", pick: "all" } }, { verb: "GainSurge", when: { kind: "noneReturned" } }] },
  { id: "51039:shadow:1", cardCode: "51039", lines: ["51039:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" }, when: KILLED }] }] },

  // 51040 Dol Guldur Orcs: each player deals 1 damage to a character he controls. Shadow: the defender gets -1 Defense for each damage on it.
  { id: "51040:whenRevealed:1", cardCode: "51040", lines: ["51040:A:1"], timing: "whenRevealed", instructions: [damageOneOf(MY_CHARACTER)] },
  { id: "51040:shadow:1", cardCode: "51040", lines: ["51040:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: { stat: "damage", of: "defender", negative: true }, until: "endOfAttack", target: "defender" }] },

  // 51041 The Shadow Road: while in the staging area it gains a Forced effect after a player optionally engages an enemy: he deals 1 damage to a character he controls. Travel: each player deals 1 damage to a character.
  { id: "51041:forced:1", cardCode: "51041", lines: ["51041:A:1"], timing: "forced", trigger: "optionallyEngaged", condition: IN_STAGING, instructions: [{ verb: "Pick", pick: MY_CHARACTER }, { verb: "DamageCard", amount: 1, target: "picked" }] },
  { id: "51041:travel:1", cardCode: "51041", lines: ["51041:A:2"], timing: "travel", instructions: [damageOneOf(MY_CHARACTER)] },

  // 51042 The Necromancer's Reach: 1 damage to each exhausted character. Shadow: +1 Attack, +2 when the defender is damaged.
  { id: "51042:whenRevealed:1", cardCode: "51042", lines: ["51042:A:1"], timing: "whenRevealed", instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any", state: "exhausted" } }] },
  { id: "51042:shadow:1", cardCode: "51042", lines: ["51042:A:2"], timing: "shadow", instructions: plusAttack(1, 2, DEFENDER_DAMAGED) },

  // 51043 Ravenous Spider: after it destroys a character the defending player exhausts a character. Shadow: with a destroyed character, exhaust a character you control.
  { id: "51043:forced:1", cardCode: "51043", lines: ["51043:A:1"], timing: "forced", trigger: "characterDestroyedByAttack", subject: { type: "character", control: "any" }, condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } }, instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] },
  { id: "51043:shadow:1", cardCode: "51043", lines: ["51043:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "Pick", pick: READY_CHARACTER, when: KILLED }, { verb: "Exhaust", target: { kind: "picked" }, when: KILLED }] }] },

  // 51044 Forest Gate: +1 Threat for each enemy in the staging area. Shadow: +1 Attack for each enemy engaged with you.
  { id: "51044:constant:1", cardCode: "51044", lines: ["51044:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: ENEMY_IN_STAGING }, until: "whileSourceInPlay", target: "self" }] },
  { id: "51044:shadow:1", cardCode: "51044", lines: ["51044:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: ENGAGED_WITH_YOU }, until: "endOfAttack", target: "attacker" }] },

  // 51045 Nightfall (Doomed 1 is a keyword): attached to the first player's threat dial as a Condition; each refresh phase its player raises threat by 1 more.
  { id: "51045:whenRevealed:1", cardCode: "51045", lines: ["51045:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachToDial", firstPlayer: true, unlimited: true }] },
  { id: "51045:constant:1", cardCode: "51045", lines: ["51045:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  { id: "51045:forced:1", cardCode: "51045", lines: ["51045:A:2"], timing: "forced", trigger: "endOfPhase", condition: { kind: "phase", is: "Refresh" }, instructions: [{ verb: "RaiseThreat", amount: 1, who: "actor" }] },

  // 51046 Venomous Spider: the character it damages cannot ready until the end of the round. Shadow: the defender cannot ready until the end of the round.
  { id: "51046:forced:1", cardCode: "51046", lines: ["51046:A:1"], timing: "forced", trigger: "damagedByAttack", subject: { type: "character", control: "any" }, condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", isSource: true } }, instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "subject" }] },
  { id: "51046:shadow:1", cardCode: "51046", lines: ["51046:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "defender" }] },

  // 51047 Pitch-dark Thicket: enemies in the staging area cannot take damage. Shadow: an attacker engaged this round cannot take damage until the end of the round.
  { id: "51047:constant:1", cardCode: "51047", lines: ["51047:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: ENEMY_IN_STAGING }] },
  { id: "51047:shadow:1", cardCode: "51047", lines: ["51047:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", target: "attacker", when: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", engagedThisRound: true } } }] },

  // 51048 Fastness of Mirkwood: the opposing team finds a different 0 cost location for each player (at most 2) and adds them to the staging area. Shadow: a destroyed character returns the active location to the staging area.
  { id: "51048:whenRevealed:1", cardCode: "51048", lines: ["51048:A:1"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", limit: 2, instructions: [{ verb: "SearchMove", type: "location", maxCost: 0, to: "staging", different: true, byChallenge: true }] } as Instruction, { verb: "ShuffleEncounterDeck" }] },
  { id: "51048:shadow:1", cardCode: "51048", lines: ["51048:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "activeLocation" }, when: KILLED }] }] },

  // 51049 Dark Bats: after it damages a character the top card of the encounter deck is revealed and Dark Bats is discarded. Shadow: +1 Attack and an additional shadow card.
  { id: "51049:forced:1", cardCode: "51049", lines: ["51049:A:1"], timing: "forced", trigger: "damagedByAttack", subject: { type: "character", control: "any" }, condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", isSource: true } }, instructions: [{ verb: "RevealEncounter" }, { verb: "Discard", target: { kind: "self" } }] },
  { id: "51049:shadow:1", cardCode: "51049", lines: ["51049:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "DealShadow", additional: true }] },

  // 51050 Forest Stream: while in the staging area it removes 2 progress from the main quest at the end of the round. Travel: raise each player's threat by 2.
  { id: "51050:forced:1", cardCode: "51050", lines: ["51050:A:1"], timing: "forced", trigger: "endOfRound", condition: IN_STAGING, instructions: [{ verb: "RemoveProgressFromQuest", amount: 2 }] },
  { id: "51050:travel:1", cardCode: "51050", lines: ["51050:A:2"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },

  // 51051 Treacherous Fog: each enemy and location in the staging area gets +2 Threat until the end of the phase. Shadow: each enemy engaged with you gets +1 Attack and +1 Defense until the end of the phase.
  { id: "51051:whenRevealed:1", cardCode: "51051", lines: ["51051:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "endOfPhase", holders: { type: "enemy", control: "any", stagingOnly: true } }, { verb: "ModifyStat", stat: "threat", amount: 2, until: "endOfPhase", holders: { type: "location", control: "any", stagingOnly: true } }] },
  { id: "51051:shadow:1", cardCode: "51051", lines: ["51051:A:2"], timing: "shadow", instructions: [{ verb: "Each", pick: ENGAGED_WITH_YOU, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfPhase", target: "picked" }, { verb: "ModifyStat", stat: "defense", amount: 1, until: "endOfPhase", target: "picked" }] }] },

  // 51052 Howling Warg: the top card of the encounter deck is discarded; a Warg is revealed and added to the staging area. Shadow: +1 Attack, +2 for a Warg attacker.
  { id: "51052:whenRevealed:1", cardCode: "51052", lines: ["51052:A:1"], timing: "whenRevealed", instructions: [{ verb: "DiscardEncounterTop", count: 1, reset: true }, { verb: "RevealDiscarded", trait: "Warg", anyType: true }] },
  { id: "51052:shadow:1", cardCode: "51052", lines: ["51052:A:2"], timing: "shadow", instructions: plusAttack(1, 2, { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Warg" } }) },

  // 51053 The Wargs' Glade: while in the staging area the first Warg enemy revealed each round gains surge; exploring it, the opposing team adds a non-unique Warg enemy found in the deck or discard pile to the staging area.
  { id: "51053:constant:1", cardCode: "51053", lines: ["51053:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "FirstTraitSurge", trait: "Warg", type: "enemy" }] },
  ...explored("51053", "51053:A:2", [{ verb: "SearchMove", trait: "Warg", type: "enemy", nonUnique: true, to: "staging", byChallenge: true }, { verb: "ShuffleEncounterDeck" }]),

  // 51054 Weighed Down: each character with an attachment is exhausted; with none exhausted it gains surge. Shadow: an attachment of the defender is discarded.
  {
    id: "51054:whenRevealed:1",
    cardCode: "51054",
    lines: ["51054:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: { type: "character", control: "any", state: "ready", hasAttachment: {} } } } },
      { verb: "Each", pick: { type: "character", control: "any", state: "ready", hasAttachment: {} }, instructions: [{ verb: "Exhaust", target: { kind: "picked" } }] },
    ],
  },
  { id: "51054:shadow:1", cardCode: "51054", lines: ["51054:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "any", attachedTo: "defender" } }, { verb: "Discard", target: { kind: "picked" } }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
