import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for Trouble in Tharbad (The Ring-maker part 6, no campaign card): the two quest stages (Time X, the threat elimination level, progress that is canceled or sent to The Crossing), Nalir, Bellach and The Crossing, the Spy From Mordor and Bellach's Marauder, the City locations and the encounter
// cards no template reads. Every line is read from the scan ledger (data/printed/the-ring-maker.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. Time X is the angmar family's; the verbs, flags and the trigger the box adds are in
// src/catalog/families/ring-maker.ts (AttackNalir, EliminateAtLevel, allThreatZero, progressCanceled, progressToCrossing, timeBarred).
// Rules: rm.time-x, rm.threat-elimination-level, rm.attacks-against-nalir, rm.setup-trouble-in-tharbad, rr.active-location, rr.cancel, rr.cannot, rr.destroy, rr.engaged, rr.explored, rr.first-player, rr.forced, rr.in-play-and-out-of-play, rr.lasting-effects, rr.modifiers, rr.ownership-and-control, rr.running-out-of-cards, rr.search, rr.setup, rr.shadow-effects, rr.step-6-2, rr.step-6-4-2, rr.step-6-4-3, rr.travel, faq.victory-display (data/rules/entries.json).
const STAGE_1 = "08066";
const STAGE_2 = "08067";
const NALIR = "08068";
const MUG = "08069";
const BELLACH = "08070";
const CROSSING = "08071";
const SPY = "08072";
const MARAUDER = "08073";
const HIDEOUT = "08075";
const RUINS = "08076";

// "Remove 1 time counter from the current quest" (rm.time-x).
const REMOVE_TIME = { verb: "RemoveTimeFromQuest", amount: 1 } as const;
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const SELF_ENGAGED: Condition = { kind: "sourceIn", zone: "engaged" };
// Every enemy in play, staged or engaged (rr.in-play-and-out-of-play).
const ENEMY: PickSpec = { type: "enemy", control: "any", staging: true };
const ENGAGED_ENEMY: PickSpec = { type: "enemy", control: "any" };
const ENEMY_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
const BELLACH_IN_PLAY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Bellach"] };
const OWN_ALLY: PickSpec = { type: "ally", control: "you" };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
// "Remove 1 time counter from the current quest" as a choice option: offered only while a counter is there and none is barred (rm.time-x, 08075:A:2).
const TIME_OPTION: Extract<Instruction, { verb: "Choose" }>["options"][number] = { id: "time", requires: { kind: "all", conditions: [{ kind: "less", left: 0, right: { stat: "resources", of: "questStage" } }, { kind: "flag", stat: "timeBarred", holder: "table", is: false }] }, instructions: [REMOVE_TIME] };
const DEFENDER_THREAT_LOW: Condition = { kind: "threat", max: 20 };
const attackPlus = (amount: number, when: Condition): Instruction => ({ verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker", when });
// "+1 Attack (+2 Attack instead if the defending player's threat is 20 or less)" (08081:A:2, 08082:A:2): the defending player is the actor of a Shadow effect.
const ATTACK_BONUS: Instruction[] = [attackPlus(1, { kind: "not", condition: DEFENDER_THREAT_LOW }), attackPlus(2, DEFENDER_THREAT_LOW)];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 08066 Double Dealings. Setup: Nalir comes under the first player's control (Bellach and The Crossing are set aside, the Spy From Mordor copies, one for each player, are staged and The Empty Mug is the active location: the piles); the encounter deck is shuffled. 1B: Time 4; after the last counter
  // the threat elimination level of each player goes down by 10 for the rest of the game (a player at or above the new level is out) and 4 counters go on the stage; progress is canceled and each player lowers threat by the amount; when every player is at 0 threat the quest advances.
  { id: "08066:setup:1", cardCode: STAGE_1, lines: ["08066:A:1"], timing: "setup", instructions: [{ verb: "TakeControlOfSetAside", code: NALIR }, { verb: "ShuffleEncounterDeck" }] },
  { id: "08066:constant:1", cardCode: STAGE_1, lines: ["08066:B:1"], timing: "constant", instructions: [{ verb: "Time", amount: 4 }] },
  {
    id: "08066:forced:1",
    cardCode: STAGE_1,
    lines: ["08066:B:2"],
    timing: "forced",
    trigger: "lastTimeCounterRemoved",
    subject: "self",
    instructions: [EACH_PLAYER([{ verb: "ModifyStat", stat: "eliminationReduction", amount: 10, until: "endOfGame", target: "actorSeat" }]), { verb: "EliminateAtLevel" }, { verb: "PlaceResourceTokens", amount: 4, on: "self" }],
  },
  { id: "08066:constant:2", cardCode: STAGE_1, lines: ["08066:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressCanceled", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "08066:forced:2", cardCode: STAGE_1, lines: ["08066:B:3"], timing: "forced", trigger: "progressReplaced", instructions: [{ verb: "LowerThreat", amount: { x: true }, who: "eachSeat" }] },
  { id: "08066:triggered:1", cardCode: STAGE_1, lines: ["08066:B:4"], timing: "triggered", trigger: "allThreatZero", instructions: [{ verb: "AdvanceStage" }] },

  // 08067 Escape from Tharbad. A: Bellach and The Crossing join the staging area; the discard pile is shuffled into the encounter deck and cards are discarded from its top until X Orc enemies (X the players) are discarded, each of them added to the staging area (a deck that runs out ends the
  // search). 2B: Time 3; after the last counter the first player chooses to raise each player's threat by 3 or, with Bellach in play, to have him attack Nalir, and 3 counters go on the stage. Progress from questing goes to The Crossing. A character that leaves play raises its controller's threat by 2.
  {
    id: "08067:whenRevealed:1",
    cardCode: STAGE_2,
    lines: ["08067:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "AddSetAsideToStaging", code: BELLACH }, { verb: "AddSetAsideToStaging", code: CROSSING }, { verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, trait: "Orc", to: "staging" }],
  },
  { id: "08067:constant:1", cardCode: STAGE_2, lines: ["08067:B:1"], timing: "constant", instructions: [{ verb: "Time", amount: 3 }] },
  {
    id: "08067:forced:1",
    cardCode: STAGE_2,
    lines: ["08067:B:2"],
    timing: "forced",
    trigger: "lastTimeCounterRemoved",
    subject: "self",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 3, who: "eachSeat" }] },
          { id: "attack", requires: { kind: "canPick", pick: BELLACH_IN_PLAY }, instructions: [{ verb: "Pick", pick: BELLACH_IN_PLAY }, { verb: "AttackNalir" }] },
        ],
      },
      { verb: "PlaceResourceTokens", amount: 3, on: "self" },
    ],
  },
  { id: "08067:constant:2", cardCode: STAGE_2, lines: ["08067:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressToCrossing", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "08067:forced:2", cardCode: STAGE_2, lines: ["08067:B:3"], timing: "forced", trigger: "progressReplaced", instructions: [{ verb: "PlaceProgressOnNamed", name: "The Crossing at Tharbad", amount: { x: true } }] },
  { id: "08067:forced:3", cardCode: STAGE_2, lines: ["08067:B:4"], timing: "forced", trigger: "leftPlay", subject: { type: "character", control: "any" }, instructions: [{ verb: "RaiseThreat", amount: 2, who: "eventSeat" }] },

  // 08068 Nalir (objective ally). The first player controls him, and control follows the first player token (the Gríma pattern, 07016:A:1). Forced: at the beginning of the refresh phase his controller raises his own threat by the players in the game. If he leaves play the players lose (the build writes it).
  { id: "08068:constant:1", cardCode: NALIR, lines: ["08068:A:1"], timing: "constant", instructions: [{ verb: "GainControlWhenFree", who: "firstPlayer" }] },
  { id: "08068:forced:1", cardCode: NALIR, lines: ["08068:A:2"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Refresh" }, instructions: [{ verb: "RaiseThreat", amount: { players: true }, who: "actor" }] },

  // 08069 The Empty Mug. While it is in play no player lowers his threat, by any effect. In the victory display it gives the current quest a Forced effect: after a player card effect lowers a player's threat, that card is removed from the game.
  { id: "08069:constant:1", cardCode: MUG, lines: ["08069:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threatReductionBarred", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  {
    id: "08069:forced:1",
    cardCode: MUG,
    lines: ["08069:A:2"],
    timing: "forced",
    trigger: "threatLowered",
    subject: { type: "card", control: "any", playerCard: true },
    fromVictory: true,
    condition: { kind: "sourceIn", zone: "victory" },
    instructions: [{ verb: "RemoveFromGame", card: "subject" }],
  },

  // 08070 Bellach. Threat X, X the players in the game. While he is in play (staged or engaged) Orc and Creature enemies get -30 engagement cost and +1 Threat. When he is destroyed he is shuffled into the encounter deck, not discarded.
  { id: "08070:constant:1", cardCode: BELLACH, lines: ["08070:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "08070:constant:2",
    cardCode: BELLACH,
    lines: ["08070:A:2"],
    timing: "constant",
    instructions: ["Orc", "Creature"].flatMap((trait): Instruction[] => [
      { verb: "ModifyStat", stat: "engagementCost", amount: -30, until: "whileSourceInPlay", holders: { ...ENEMY, trait } },
      { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { ...ENEMY, trait } },
    ]),
  },
  { id: "08070:forced:1", cardCode: BELLACH, lines: ["08070:A:3"], timing: "forced", trigger: "enemyDestroyed", subject: "self", instructions: [{ verb: "ShuffleSelfIntoEncounterDeck" }] },

  // 08071 The Crossing at Tharbad. Immune to player card effects (the keyword). It cannot leave the staging area (`cannotLeaveStaging`: the players cannot travel to it). By FFG's answer a location that cannot leave play cannot be explored, but this card's own text answers its exploring, so `exploresWhileHeld` lets it be explored in place, once, and win. +2 quest points for each player; explored in the staging area, the players win.
  { id: "08071:constant:1", cardCode: CROSSING, lines: ["08071:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "exploresWhileHeld", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "08071:constant:2", cardCode: CROSSING, lines: ["08071:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { players: true, times: 2 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "08071:triggered:1", cardCode: CROSSING, lines: ["08071:A:3"], timing: "triggered", trigger: "locationExplored", subject: "self", instructions: [{ verb: "WinGame" }] },

  // 08072 Spy From Mordor. Forced: when it attacks (step 6.4.1, before the defender is declared) a time counter comes off the current quest.
  { id: "08072:forced:1", cardCode: SPY, lines: ["08072:A:1"], timing: "forced", trigger: "attacks", subject: "self", instructions: [REMOVE_TIME] },

  // 08073 Bellach's Marauder. Engaged, it hears each time counter removed from the current quest and is dealt 2 shadow cards. Shadow: a time counter comes off the current quest.
  { id: "08073:forced:1", cardCode: MARAUDER, lines: ["08073:A:1"], timing: "forced", trigger: "timeCounterRemoved", condition: SELF_ENGAGED, instructions: [{ verb: "DealShadow", additional: true }, { verb: "DealShadow", additional: true }] },
  { id: "08073:shadow:1", cardCode: MARAUDER, lines: ["08073:A:2"], timing: "shadow", instructions: [REMOVE_TIME] },

  // 08074 Streets of Tharbad. No progress on it in the staging area. While it is the active location each enemy gets -20 engagement cost.
  { id: "08074:constant:1", cardCode: "08074", lines: ["08074:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "08074:constant:2", cardCode: "08074", lines: ["08074:A:2"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -20, until: "whileSourceInPlay", holders: ENEMY }] },

  // 08075 Tharbad Hideout. Surge (keyword). While it is the active location no time counter can be removed from the current quest. Forced: at the beginning of each quest phase 1 progress goes on it, in the staging area or as the active location.
  { id: "08075:constant:1", cardCode: HIDEOUT, lines: ["08075:A:2"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "timeBarred", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "08075:forced:1", cardCode: HIDEOUT, lines: ["08075:A:3"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Quest" }, instructions: [{ verb: "PlaceProgressOn", amount: 1, target: "self" }] },

  // 08076 Ruins of the Second Age. In the staging area each City location in the staging area (itself too) gets +1 Threat; copies add up. While active, each engaged enemy is dealt 1 more shadow card at the beginning of the combat phase.
  { id: "08076:constant:1", cardCode: RUINS, lines: ["08076:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", staging: true, trait: "City" } }] },
  {
    id: "08076:forced:1",
    cardCode: RUINS,
    lines: ["08076:A:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "all", conditions: [ACTIVE, { kind: "phase", is: "Combat" }] },
    instructions: [{ verb: "Each", pick: ENGAGED_ENEMY, instructions: [{ verb: "DealShadowTo", target: "picked" }] }],
  },

  // 08077 Seedy Inn. Shadow: the defending player raises his threat by the damage this attack dealt (the build reads the Travel line).
  { id: "08077:shadow:1", cardCode: "08077", lines: ["08077:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: { dealt: true }, who: "actor" }] }] },

  // 08078 Hidden Alleyway. Travel: each player raises his threat by the enemies in play. Forced: after the players travel here a time counter goes on the current quest.
  { id: "08078:travel:1", cardCode: "08078", lines: ["08078:A:1"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: { count: ENEMY }, who: "eachSeat" }] },
  { id: "08078:forced:1", cardCode: "08078", lines: ["08078:A:2"], timing: "forced", trigger: "traveled", subject: "self", instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "questStage" }] },

  // 08079 Decrepit Rooftops. While active each enemy gets +1 Threat and no engagement checks are made. Forced: after the players travel here every engaged enemy returns to the staging area.
  {
    id: "08079:constant:1",
    cardCode: "08079",
    lines: ["08079:A:1"],
    timing: "constant",
    condition: ACTIVE,
    instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: ENEMY }, { verb: "ModifyStat", stat: "noEngagementChecks", amount: 1, until: "whileSourceInPlay", target: "table" }],
  },
  { id: "08079:forced:1", cardCode: "08079", lines: ["08079:A:2"], timing: "forced", trigger: "traveled", subject: "self", instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "each", pick: "all" } }] },

  // 08080 Constant Tail. Every engaged enemy returns to the staging area; then the first player removes a time counter or each Spy enemy in the staging area gets +2 Threat until the end of the phase (one that enters the staging area later in the phase too).
  {
    id: "08080:whenRevealed:1",
    cardCode: "08080",
    lines: ["08080:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "each", pick: "all" } },
      { verb: "Choose", who: "firstPlayer", options: [TIME_OPTION, { id: "threat", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "endOfPhase", target: "stagingCards", trait: "Spy" }] }] },
    ],
  },

  // 08081 Conspicuous Lot. Each player raises his threat by the allies he controls (Nalir counts for his controller); then, with any player at 20 or less, it gains surge. Shadow: +1 Attack, +2 instead when the defending player's threat is 20 or less.
  {
    id: "08081:whenRevealed:1",
    cardCode: "08081",
    lines: ["08081:A:1"],
    timing: "whenRevealed",
    instructions: [EACH_PLAYER([{ verb: "RaiseThreat", amount: { count: OWN_ALLY }, who: "actor" }]), { verb: "GainSurge", when: { kind: "anyThreat", max: 20 } }],
  },
  { id: "08081:shadow:1", cardCode: "08081", lines: ["08081:A:2"], timing: "shadow", instructions: ATTACK_BONUS },

  // 08082 Cornered. The first player removes a time counter, or each enemy gets -20 engagement cost and +1 Attack until the end of the round (one that enters play later this round too). Shadow: as Conspicuous Lot.
  {
    id: "08082:whenRevealed:1",
    cardCode: "08082",
    lines: ["08082:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          TIME_OPTION,
          {
            id: "enemies",
            instructions: [
              { verb: "ModifyStat", stat: "engagementCost", amount: -20, until: "endOfRound", target: "enemies" },
              { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", target: "enemies" },
            ],
          },
        ],
      },
    ],
  },
  { id: "08082:shadow:1", cardCode: "08082", lines: ["08082:A:2"], timing: "shadow", instructions: ATTACK_BONUS },

  // 08083 Get That Dwarf! The staging enemy with the highest Attack (the first player chooses among ties) engages the first player and makes an immediate attack against Nalir; with no enemy in the staging area it gains surge. Shadow: an undefended attack deals 2 damage to Nalir as well.
  {
    id: "08083:whenRevealed:1",
    cardCode: "08083",
    lines: ["08083:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: ENEMY_IN_STAGING } } },
      { verb: "Pick", pick: { ...ENEMY_IN_STAGING, highestAttack: true, who: "firstPlayer" } },
      { verb: "EngageFirstPlayer", target: "picked" },
      { verb: "AttackNalir" },
    ],
  },
  {
    id: "08083:shadow:1",
    cardCode: "08083",
    lines: ["08083:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Pick", pick: { type: "character", control: "any", names: ["Nalir"] }, when: { kind: "undefended" } }, { verb: "DamageCard", amount: 2, target: "picked", when: { kind: "undefended" } }],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
