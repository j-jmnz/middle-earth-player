import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Temple of Doom (Vengeance of Mordor part 3, A Shadow in the East, no campaign card): the stage 1 and the four stage 2 cards, Thane Ulchor and Tribute to Mordor, the Power of Mordor deck, and the encounter sets The Temple of Doom, Ulchor's Guard, Twisted Tunnels
// and Easterling Raiders (the last read in the-river-running.ts). Every line is read from the scan ledger (data/printed/vengeance-of-mordor.json). The scenario's readings are in docs/scenarios/vengeance-of-mordor/the-temple-of-doom.md; the vocabulary the box adds is in
// src/catalog/families/mordor.ts (the Power of Mordor deck, the cards under a threat dial, the enemies that engage by a constant line, the stages shuffled under stage 1).
// Rules: rr.damage, rr.forced, rr.hit-points, rr.cannot, rr.reveal, rr.victory, rr.discard-pile-and-victory-display, rr.engaged, rr.immune, rr.travel, rr.threat-elimination-level, rr.attachment-cards, rr.then, rr.shadow-effects, rr.quest-phase,
// vom.quest-stages-vs-side-quests, vom.power-of-mordor-deck-the-temple-of-doom (data/rules/entries.json).
const TRIBUTE = "21053";
const ULCHOR = "21054";
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
// "Quest stage" counts the double-sided cards from the quest deck in the victory display, no side quest (vom.quest-stages-vs-side-quests): the quest cards of the display that print the type quest.
const QUEST_STAGES: PickSpec = { type: "card", control: "any", from: "victory", cardType: "quest" };
const STAGES_IN_VICTORY = { count: QUEST_STAGES } as const;
// "X is 1 more than the number of quest stages in the victory display".
const X_STAGES = { count: QUEST_STAGES, plus: 1 } as const;
// "While there are 4 quest stages in the victory display".
const FOUR_STAGES: Condition = { kind: "not", condition: { kind: "less", left: STAGES_IN_VICTORY, right: 4 } };
const FEWER_THAN_FOUR_STAGES: Condition = { kind: "less", left: STAGES_IN_VICTORY, right: 4 };
const PLACE_ON_TRIBUTE: Instruction = { verb: "PlaceDamageOn", code: TRIBUTE, amount: 1 };
// "If this attack destroys a character": the attack's X is the characters it destroyed.
const DESTROYED_A_CHARACTER: Condition = { kind: "x", min: 1 };
const AN_ENEMY: PickSpec = { type: "enemy", control: "any" };
const ULCHOR_IN_PLAY: PickSpec = { type: "enemy", control: "any", names: ["Thane Ulchor"] };
// The enemy among the cards the effect just discarded from the top of the encounter deck.
const LOOKED_ENEMY: PickSpec = { type: "enemy", control: "any", looked: true };
const PICKED_IS = (pick: PickSpec): Condition => ({ kind: "matches", card: "picked", pick, inPlay: false });
// "The Easterling enemy (staging area or engaged) with the lowest Defense without a copy of Fanaticism" (21060:A:2).
const FANATICISM_CANDIDATE: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Easterling", hasAttachment: { names: ["Fanaticism"], none: true } };
// "At the beginning of the quest phase" (the Forced effects of the stage 2B sides).
const QUEST_PHASE_BEGINS = { trigger: "beginningOfPhase", condition: { kind: "phase", is: "Quest" } } as const;
// "While there are 4 quest stages in the victory display, progress cannot be placed here" (stage 2B).
const NO_PROGRESS_AT_FOUR = (code: string, line: string, n = 1): Effect => ({ id: `${code}:constant:${n}`, cardCode: code, lines: [line], timing: "constant", condition: FOUR_STAGES, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] });
// "Reveal 1 encounter card per player" (the four stage 2A sides).
const STAGE_TWO_REVEAL = (code: string): Effect => ({ id: `${code}:whenRevealed:1`, cardCode: code, lines: [`${code}:A:1`], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "RevealEncounter" }])] });

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 21053 Tribute to Mordor (encounter side quest). Forced: at the end of the round 1 damage token goes on it; with 4 or more, a card of the Power of Mordor deck is revealed and 4 tokens come off, and with no card to reveal the players lose the game. It cannot be the current quest
  // while Thane Ulchor has hit points remaining; when it is defeated the players win.
  {
    id: "21053:forced:1",
    cardCode: TRIBUTE,
    lines: ["21053:A:1"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [
      { verb: "PlaceDamage", amount: 1, card: "self" },
      { verb: "RevealPowerOfMordor", onEmpty: "loseGame", when: { kind: "not", condition: { kind: "less", left: { stat: "damage", of: "self" }, right: 4 } } },
      { verb: "RemoveDamageFrom", code: TRIBUTE, amount: 4, when: { kind: "not", condition: { kind: "less", left: { stat: "damage", of: "self" }, right: 4 } } },
    ],
  },
  { id: "21053:constant:1", cardCode: TRIBUTE, lines: ["21053:A:2"], timing: "constant", condition: { kind: "hitPointsLeft", code: ULCHOR }, instructions: [{ verb: "ModifyStat", stat: "cannotBeCurrentQuest", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "21053:forced:2", cardCode: TRIBUTE, lines: ["21053:A:2"], timing: "forced", trigger: "questDefeated", subject: "self", instructions: [{ verb: "WinGame" }] },

  // 21054 Thane Ulchor (Indestructible and Immune to player card effects are keywords). X is 1 more than the quest stages in the victory display; he cannot be engaged unless X is 5. Forced: when he attacks and destroys a character, 1 damage goes on Tribute to Mordor.
  {
    id: "21054:constant:1",
    cardCode: ULCHOR,
    lines: ["21054:A:2"],
    timing: "constant",
    condition: { kind: "any", conditions: [FEWER_THAN_FOUR_STAGES, { kind: "less", left: 4, right: STAGES_IN_VICTORY }] },
    instructions: [{ verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }],
  },
  { id: "21054:forced:1", cardCode: ULCHOR, lines: ["21054:A:3"], timing: "forced", trigger: "characterDestroyedByAttack", subject: { type: "character", control: "any" }, condition: { kind: "matches", card: "other", pick: { ...AN_ENEMY, isSource: true } }, instructions: [PLACE_ON_TRIBUTE] },

  // 21055 Temple of Sauron (location). Forced: when it leaves play, 1 damage goes on Tribute to Mordor. Shadow: the attacking enemy gets +1 Attack for each quest stage in the victory display.
  { id: "21055:forced:1", cardCode: "21055", lines: ["21055:A:1"], timing: "forced", trigger: "leftPlay", subject: "self", instructions: [PLACE_ON_TRIBUTE] },
  { id: "21055:shadow:1", cardCode: "21055", lines: ["21055:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: STAGES_IN_VICTORY, until: "endOfAttack", target: "attacker" }] },

  // 21056 Hall of Horrors (location). X is 1 more than the quest stages in the victory display. Forced: when it leaves play, each player deals X damage to a character he controls.
  {
    id: "21056:forced:1",
    cardCode: "21056",
    lines: ["21056:A:1", "21056:A:2"],
    timing: "forced",
    trigger: "leftPlay",
    subject: "self",
    instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "character", control: "you" } }, { verb: "DamageCard", amount: X_STAGES, target: "picked" }])],
  },

  // 21057 Place of Evil (treachery). When Revealed: 1 damage goes on Tribute to Mordor; then the first player chooses: 1 more damage on it, or Place of Evil gains Surge. Shadow: the attacking enemy gets +1 Attack; if the attack destroys a character, 1 damage goes on Tribute.
  {
    id: "21057:whenRevealed:1",
    cardCode: "21057",
    lines: ["21057:A:1"],
    timing: "whenRevealed",
    instructions: [PLACE_ON_TRIBUTE, { verb: "Choose", who: "firstPlayer", options: [{ id: "damage", instructions: [PLACE_ON_TRIBUTE] }, { id: "surge", instructions: [{ verb: "GainSurge" }] }] }],
  },
  {
    id: "21057:shadow:1",
    cardCode: "21057",
    lines: ["21057:A:2"],
    timing: "shadow",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ ...PLACE_ON_TRIBUTE, when: DESTROYED_A_CHARACTER }] }],
  },

  // 21058 Ulchor's Guard (enemy). While Thane Ulchor is engaged with a player the Guard engages that player (it stays engaged if he leaves). Shadow: the attacking enemy gets +2 Defense until the end of the phase.
  { id: "21058:constant:1", cardCode: "21058", lines: ["21058:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagesWithUlchor", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "21058:shadow:1", cardCode: "21058", lines: ["21058:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfPhase", target: "attacker" }] },

  // 21059 Ulchor's Rage (treachery). When Revealed: Thane Ulchor makes an immediate attack against the first player (from the staging area); with Ulchor not in play, Rage gains Surge. Shadow: 1 damage to the defending character.
  {
    id: "21059:whenRevealed:1",
    cardCode: "21059",
    lines: ["21059:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Pick", pick: ULCHOR_IN_PLAY }, { verb: "AttackFromStaging", who: "firstPlayer", orEngaged: true }, { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: ULCHOR_IN_PLAY } } }],
  },
  { id: "21059:shadow:1", cardCode: "21059", lines: ["21059:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },

  // 21060 Fanaticism (treachery, Easterling). While attached to an enemy it counts as a Condition attachment: the enemy gets +1 Threat, +1 Attack, +1 Defense and is immune to player card effects. When Revealed: it attaches to the Easterling enemy with the lowest Defense
  // without a copy of Fanaticism (the first player chooses among ties); with none it gains Surge.
  { id: "21060:constant:1", cardCode: "21060", lines: ["21060:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  {
    id: "21060:constant:2",
    cardCode: "21060",
    lines: ["21060:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "host" },
    ],
  },
  {
    id: "21060:whenRevealed:1",
    cardCode: "21060",
    lines: ["21060:A:2"],
    timing: "whenRevealed",
    instructions: [
      { verb: "PickLowestDefense", pick: FANATICISM_CANDIDATE },
      { verb: "AttachSelfToPicked", when: { kind: "canPick", pick: FANATICISM_CANDIDATE } },
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: FANATICISM_CANDIDATE } } },
    ],
  },

  // 21061 Twisted Tunnel (location). When Revealed: cards are discarded from the top of the encounter deck until an enemy is, and it is added to the staging area (not revealed). Shadow: the top card of the encounter deck is discarded; an enemy is added to the staging area.
  { id: "21061:whenRevealed:1", cardCode: "21061", lines: ["21061:A:1"], timing: "whenRevealed", instructions: [{ verb: "DiscardUntil", type: "enemy" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: PICKED_IS(AN_ENEMY) }] },
  { id: "21061:shadow:1", cardCode: "21061", lines: ["21061:A:2"], timing: "shadow", instructions: [{ verb: "DiscardEncounterTop", count: 1 }, { verb: "Pick", pick: LOOKED_ENEMY }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "canPick", pick: LOOKED_ENEMY } }] },

  // 21062 Narrow Opening (location). While it is the active location each player cannot play more than 1 card each round. Forced: when it leaves play each player discards 1 random card from his hand.
  { id: "21062:constant:1", cardCode: "21062", lines: ["21062:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "LimitPlaysPerRound", max: 1 }] },
  { id: "21062:forced:1", cardCode: "21062", lines: ["21062:A:2"], timing: "forced", trigger: "leftPlay", subject: "self", instructions: [{ verb: "DiscardRandomFromHand", who: "eachSeat" }] },

  // 21063 Crumbling Passage (location). When Revealed: it becomes the active location and any other active location returns to the staging area. Forced: when it leaves play 1 damage is dealt to each exhausted character.
  { id: "21063:whenRevealed:1", cardCode: "21063", lines: ["21063:A:1"], timing: "whenRevealed", instructions: [{ verb: "MakeActive", target: "self" }] },
  { id: "21063:forced:1", cardCode: "21063", lines: ["21063:A:2"], timing: "forced", trigger: "leftPlay", subject: "self", instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any", state: "exhausted" } }] },

  // 21064 Fearful Shadows (treachery, Doomed 1). When Revealed: until the end of the round the printed text box of each character is treated as blank, Traits kept. Shadow: the defending character cannot ready until the end of the round.
  { id: "21064:whenRevealed:1", cardCode: "21064", lines: ["21064:A:2"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfRound", holders: { type: "character", control: "any" } }] },
  { id: "21064:shadow:1", cardCode: "21064", lines: ["21064:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "defender" }] },

  // 21065 Lost in the Dark (encounter side quest). When Revealed: each player puts the top 10 cards of his deck facedown under his threat dial; when it is defeated each player shuffles them back (the family's settle sweep). Forced: after a player raises his threat by any amount he discards the top card from under his dial.
  { id: "21065:whenRevealed:1", cardCode: "21065", lines: ["21065:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "PutUnderDial", count: 10 }])] },
  { id: "21065:forced:1", cardCode: "21065", lines: ["21065:A:2"], timing: "forced", trigger: "threatRaised", instructions: [{ verb: "DiscardUnderDial" }] },

  // 21066 Khamûl the Easterling (Immune to player card effects is a keyword). He engages the first player; only the engaged player can declare attackers or defenders against him.
  { id: "21066:constant:1", cardCode: "21066", lines: ["21066:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagesFirstPlayer", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "21066:constant:2", cardCode: "21066", lines: ["21066:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attackOnlyByEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "defendOnlyByEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 21067 The Tower of Barad-dûr (location, Immune to player card effects). The players cannot travel here; each player's threat elimination level is reduced by 5.
  { id: "21067:constant:1", cardCode: "21067", lines: ["21067:A:2"], timing: "constant", instructions: [{ verb: "Restrict", what: "travel" }] },
  { id: "21067:constant:2", cardCode: "21067", lines: ["21067:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "eliminationReduction", amount: 5, until: "whileSourceInPlay", target: "eachSeat" }] },

  // 21068 Under the Watchful Eye (objective). When Revealed: each player with more than 5 cards in his hand discards down to 5. Forced: after a player draws any number of cards he raises his threat by 1.
  { id: "21068:whenRevealed:1", cardCode: "21068", lines: ["21068:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "DiscardFromHand", amount: { hand: true, plus: -5 }, when: { kind: "less", left: 5, right: { hand: true } } }])] },
  { id: "21068:forced:1", cardCode: "21068", lines: ["21068:A:2"], timing: "forced", trigger: "cardsDrawn", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eventSeat" }] },

  // 21069 The Armies of Mordor (objective). Forced: after a non-unique enemy engages a player it cannot take damage until the end of the round.
  {
    id: "21069:forced:1",
    cardCode: "21069",
    lines: ["21069:A:1"],
    timing: "forced",
    trigger: "engaged",
    subject: { ...AN_ENEMY, nonUnique: true },
    instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", target: "subject" }],
  },

  // 21070 Covered in Darkness (objective, Doomed 5). Each player's threat cannot be reduced by more than 1 each round by player card effects.
  { id: "21070:constant:1", cardCode: "21070", lines: ["21070:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "playerThreatReductionCap", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },

  // 21080 The Forgotten Temple (stage 1). Setup: the four stage 2 cards are shuffled under it, the Power of Mordor deck is shuffled and the encounter deck is shuffled (Thane Ulchor and Tribute to Mordor are dealt to the staging area). Side B: the quest phase is skipped; at the end of the
  // planning phase it gets 1 resource, and with 2 it is added to the victory display (it prints Victory) and the quest advances to the topmost stage 2A.
  { id: "21080:setup:1", cardCode: "21080", lines: ["21080:A:1"], timing: "setup", instructions: [{ verb: "ShuffleStagesUnder", codes: ["21081", "21083", "21084", "21085"] }, { verb: "ShufflePile", pile: "powerOfMordor" }, { verb: "ShuffleEncounterDeck" }] },
  { id: "21080:constant:1", cardCode: "21080", lines: ["21080:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "skipQuestPhase", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "21080:forced:1",
    cardCode: "21080",
    lines: ["21080:B:2"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "phase", is: "Planning" },
    instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }, { verb: "AdvanceStage", when: { kind: "tokens", code: "21080", min: 2 } }],
  },

  // 21081 The Legacy of Mordor (stage 2). A: reveal 1 encounter card per player. B: at the beginning of the quest phase each player deals 1 damage to a hero he controls and exhausts it; that hero cannot ready or be healed until the refresh phase. No progress with 4 quest stages in the victory display.
  STAGE_TWO_REVEAL("21081"),
  {
    id: "21081:forced:1",
    cardCode: "21081",
    lines: ["21081:B:1"],
    timing: "forced",
    ...QUEST_PHASE_BEGINS,
    instructions: [
      EACH_PLAYER([
        { verb: "Pick", pick: { type: "hero", control: "you" } },
        { verb: "DamageCard", amount: 1, target: "picked" },
        { verb: "Exhaust", target: { kind: "picked" } },
        { verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfCombat", target: "picked" },
        { verb: "ModifyStat", stat: "cannotBeHealed", amount: 1, until: "endOfCombat", target: "picked" },
      ]),
    ],
  },
  NO_PROGRESS_AT_FOUR("21081", "21081:B:2"),

  // 21083 Memory of the Dark Years (stage 2). B: at the beginning of the quest phase X cards (1 more than the quest stages in the victory display) are discarded from the top of the encounter deck and 2 is added to the staging area's total Threat for each different card type among them.
  STAGE_TWO_REVEAL("21083"),
  {
    id: "21083:forced:1",
    cardCode: "21083",
    lines: ["21083:B:1"],
    timing: "forced",
    ...QUEST_PHASE_BEGINS,
    instructions: [{ verb: "DiscardEncounterTop", count: X_STAGES }, { verb: "RaiseStagingThreat", amount: { discardedEncounterTypes: true, times: 2 }, until: "endOfPhase" }],
  },
  NO_PROGRESS_AT_FOUR("21083", "21083:B:2"),

  // 21084 Shrine to Sauron (stage 2). B: at the beginning of the quest phase each player discards the top X cards of his deck (X is 1 more than the quest stages in the victory display) and then each copy of those cards in his hand and among the cards he controls.
  STAGE_TWO_REVEAL("21084"),
  {
    id: "21084:forced:1",
    cardCode: "21084",
    lines: ["21084:B:1"],
    timing: "forced",
    ...QUEST_PHASE_BEGINS,
    instructions: [EACH_PLAYER([{ verb: "DiscardFromDeck", amount: X_STAGES }, { verb: "DiscardCopiesOfLooked" }])],
  },
  NO_PROGRESS_AT_FOUR("21084", "21084:B:2"),

  // 21085 The Lord of Middle-earth (stage 2). B: +4 quest points per player. At the beginning of the quest phase each player discards 1 card from his hand; until the end of the round no more than X progress can be placed on the stage, X the total printed cost of the cards discarded.
  STAGE_TWO_REVEAL("21085"),
  { id: "21085:constant:1", cardCode: "21085", lines: ["21085:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { players: true, times: 4 }, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "21085:forced:1",
    cardCode: "21085",
    lines: ["21085:B:2"],
    timing: "forced",
    ...QUEST_PHASE_BEGINS,
    instructions: [
      EACH_PLAYER([{ verb: "Pick", pick: { type: "card", control: "you", from: "hand" } }, { verb: "AddToX", amount: { stat: "cost", of: "picked", printed: true } }, { verb: "Discard", target: { kind: "picked" } }]),
      { verb: "ModifyStat", stat: "progressCap", amount: { x: true }, until: "endOfRound", target: "self" },
    ],
  },
  NO_PROGRESS_AT_FOUR("21085", "21085:B:3", 2),
];

export const AUTHORED_REPLACES: readonly string[] = [];
