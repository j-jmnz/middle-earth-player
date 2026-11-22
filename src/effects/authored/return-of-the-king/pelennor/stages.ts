import type { Effect } from "../../../../catalog/boundary.ts";

import { ANDURIL, ARAGORN, BANNER, DISCARD_UNTIL_ENEMY, EACH_PLAYER, ESQUIRE_OF_GONDOR, ESQUIRE_OF_ROHAN, FIVE_BURDEN_SETS, FLEET, GROND, MINAS_TIRITH, NOT_FIRST_PLAYER, QUEST_PHASE, STAGED_ALLIES, STAGED_ENEMIES, STAGE_4, STAGE_5, WITCH_KING, WITCH_KING_CAPTAIN, WITCH_KING_SORCERER, WRAITH } from "./shared.ts";

// Records for the quest stages of The Battle of the Pelennor Fields (145073 to 145077), the campaign card's Setup and Forced (145078; its Resolution is in ../the-return-of-the-king.ts) and the Witch-king's two sides (145079, 145080). The cards the quest card's piles set aside
// (Minas Tirith, Grond, the Wraiths on Wings, the Witch-king, the Esquires) are dealt by the data; no record places them. Every line is read from the scan ledger (data/printed/the-return-of-the-king.json). See docs/scenarios/the-return-of-the-king.md, The Return of the King, for each reading.
// Rules: mec113.assault, mec113.minas-tirith, mec113.setting-up-the-game, mec113.aragorn, rr.search, rr.active-location, rr.quest-advancement, rr.first-player, rr.in-play-and-out-of-play, rr.ownership-and-control, faq.progress-without-advancing, faq.next-player (data/rules/entries.json).
export const STAGE_RECORDS: readonly Effect[] = [
    // 145073 The Garrison of Gondor (stage 1). Setup: Minas Tirith, Grond, The Witch-king and each Wraith on Wings are set aside and Pelennor Field is the active location (the piles); the first player may attach Esquire of Rohan and Esquire of Gondor, set aside, to
    // different heroes of any seat, each optionally, Rohan's first. Side B: the quest phase and the combat phase are skipped (so no beginning-of-quest-phase Forced effect runs). Forced: at the end of the planning phase 1 progress is placed here.
    {
      id: "145073:setup:1",
      cardCode: "145073",
      lines: ["145073:A:1"],
      timing: "setup",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "rohan", requires: { kind: "canPick", pick: { type: "hero", control: "any", who: "firstPlayer", attachable: ESQUIRE_OF_ROHAN } }, instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", who: "firstPlayer", attachable: ESQUIRE_OF_ROHAN } }, { verb: "AttachSetAside", code: ESQUIRE_OF_ROHAN }] },
            { id: "none", instructions: [] },
          ],
        },
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            {
              id: "gondor",
              requires: { kind: "canPick", pick: { type: "hero", control: "any", who: "firstPlayer", attachable: ESQUIRE_OF_GONDOR, hasAttachment: { names: ["Esquire of Rohan"], none: true } } },
              instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", who: "firstPlayer", attachable: ESQUIRE_OF_GONDOR, hasAttachment: { names: ["Esquire of Rohan"], none: true } } }, { verb: "AttachSetAside", code: ESQUIRE_OF_GONDOR }],
            },
            { id: "none", instructions: [] },
          ],
        },
      ],
    },
    {
      id: "145073:constant:1",
      cardCode: "145073",
      lines: ["145073:B:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "skipQuestPhase", amount: 1, until: "whileSourceInPlay", target: "table" }, { verb: "ModifyStat", stat: "skipCombat", amount: 1, until: "whileSourceInPlay", target: "table" }],
    },
    { id: "145073:forced:1", cardCode: "145073", lines: ["145073:B:2"], timing: "forced", trigger: "endOfPhase", condition: { kind: "phase", is: "Planning" }, instructions: [{ verb: "AddStageProgress", amount: 1 }] },

    // 145074 Retreat from Osgiliath (stage 2). When Revealed: each player adds 1 set aside Wraith on Wings to the staging area (if one is left) and reveals an encounter card; then, the first player first, each player discards from the top of their deck until they discard an
    // ally that is not in play, which enters the staging area, blank until the end of the phase. X, the quest points, is the total printed cost of the allies in the staging area. Those allies are blank, immune to player card effects and under no player's control; at
    // the end of the round damage equal to the enemies in the staging area is assigned among them by the first player; a destroyed one goes to its owner's discard pile.
    {
      id: "145074:whenRevealed:1",
      cardCode: "145074",
      lines: ["145074:A:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "AddSetAsideToStaging", code: WRAITH }, { verb: "RevealEncounter" }]), EACH_PLAYER([{ verb: "DiscardAllyToStaging" }])],
    },
    { id: "145074:constant:1", cardCode: "145074", lines: ["145074:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { stagedAlliesCost: true }, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "145074:constant:2",
      cardCode: "145074",
      lines: ["145074:B:2"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", holders: STAGED_ALLIES }, { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: STAGED_ALLIES }],
    },
    { id: "145074:forced:1", cardCode: "145074", lines: ["145074:B:3"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "AssignDamage", amount: { count: STAGED_ENEMIES }, pick: { ...STAGED_ALLIES, who: "firstPlayer" } }] },

    // 145075 The White City Besieged (stage 3). When Revealed: each player takes control of the allies they own in the staging area, exhausted; the first player adds Minas Tirith, Grond and The Witch-king (Captain side faceup) to the staging area; each other player searches the encounter
    // deck and discard pile for a different enemy and adds it; the deck is shuffled. Side B has Assault (the flag assault: no stage progress from questing or player cards, a failed quest damages Minas Tirith instead of raising threat). It gets +4 quest points for each player; the
    // players cannot travel to Pelennor locations. Forced: when an enemy is destroyed, progress equal to its total Threat is placed, on the active location first and the rest on this stage.
    {
      id: "145075:whenRevealed:1",
      cardCode: "145075",
      lines: ["145075:A:1"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([{ verb: "TakeControlOfStagedAllies" }]),
        { verb: "AddSetAsideToStaging", code: MINAS_TIRITH },
        { verb: "AddSetAsideToStaging", code: GROND },
        { verb: "AddSetAsideToStaging", code: WITCH_KING_CAPTAIN },
        EACH_PLAYER([{ verb: "SearchMove", type: "enemy", to: "staging", different: true, when: NOT_FIRST_PLAYER }]),
        { verb: "ShuffleEncounterDeck" },
      ],
    },
    { id: "145075:constant:1", cardCode: "145075", lines: ["145075:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "assault", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "145075:constant:2", cardCode: "145075", lines: ["145075:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { players: true, times: 4 }, until: "whileSourceInPlay", target: "self" }] },
    { id: "145075:constant:3", cardCode: "145075", lines: ["145075:B:3"], timing: "constant", instructions: [{ verb: "Restrict", what: "travel", trait: "Pelennor" }] },
    { id: "145075:forced:1", cardCode: "145075", lines: ["145075:B:4"], timing: "forced", trigger: "enemyDestroyed", instructions: [{ verb: "PlaceProgressActiveFirst", amount: { x: true } }] },

    // 145076 Rohan has Come! (stage 4). When Revealed: The Witch-king is set aside, out of play, wherever he is in play; each player searches the top 10 cards of their deck for an ally matching the sphere of a hero they control (a neutral ally or a Fellowship hero matches none) and puts it into
    // play under their control, then shuffles. Side B: progress that questing successfully would place on this stage (the active location took its share) is assigned as damage among the enemies in play, the first player assigning. Forced: at the end of the quest phase the players advance to stage 5A.
    {
      id: "145076:whenRevealed:1",
      cardCode: STAGE_4,
      lines: ["145076:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "SetAsideInPlay", code: WITCH_KING_CAPTAIN },
        EACH_PLAYER([{ verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: 10, cardType: "ally", heroSphere: true, intoPlay: true } }, { verb: "PutIntoPlay", card: "picked", who: "actor" }, { verb: "ShuffleDeck" }]),
      ],
    },
    { id: "145076:constant:1", cardCode: STAGE_4, lines: ["145076:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressAsDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "145076:triggered:1",
      cardCode: STAGE_4,
      lines: ["145076:B:1"],
      timing: "triggered",
      trigger: "progressReplaced",
      instructions: [{ verb: "AssignDamage", amount: { x: true }, pick: { type: "enemy", control: "any", staging: true, who: "firstPlayer" } }],
    },
    { id: "145076:forced:1", cardCode: STAGE_4, lines: ["145076:B:2"], timing: "forced", trigger: "endOfPhase", condition: QUEST_PHASE, instructions: [{ verb: "AdvanceToStage", code: STAGE_5 }] },

    // 145077 Fighting in the Fields (stage 5). When Revealed: the first player adds The Witch-king (Sorcerer side faceup) to the staging area, searches the encounter deck and discard pile for a Fell Beast and attaches it to him, if able, and the deck is shuffled; each other
    // player reveals an encounter card. Side B: the Witch-king and the shadow cards dealt to him are immune to player card effects. Forced: when an enemy attacks and destroys a character, 1 damage to Minas Tirith. The stage cannot be defeated unless Aragorn is in play
    // and the Witch-king is in the victory display (progress piles up meanwhile, faq.progress-without-advancing); defeating it wins the game.
    {
      id: "145077:whenRevealed:1",
      cardCode: STAGE_5,
      lines: ["145077:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "AddToStaging", code: WITCH_KING_SORCERER },
        { verb: "AttachSearched", type: "treachery", trait: "Morgul", to: "The Witch-king", name: "Fell Beast" },
        { verb: "ShuffleEncounterDeck" },
        EACH_PLAYER([{ verb: "RevealEncounter", when: NOT_FIRST_PLAYER }]),
      ],
    },
    {
      id: "145077:constant:1",
      cardCode: STAGE_5,
      lines: ["145077:B:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: WITCH_KING }, { verb: "ModifyStat", stat: "shadowsImmune", amount: 1, until: "whileSourceInPlay", holders: WITCH_KING }],
    },
    { id: "145077:forced:1", cardCode: STAGE_5, lines: ["145077:B:2"], timing: "forced", trigger: "characterDestroyedByAttack", instructions: [{ verb: "DamageMinasTirith", amount: 1 }] },
    {
      id: "145077:constant:2",
      cardCode: STAGE_5,
      lines: ["145077:B:3"],
      timing: "constant",
      condition: { kind: "any", conditions: [{ kind: "inPlay", code: ARAGORN, is: false }, { kind: "inVictory", code: WITCH_KING_SORCERER, is: false }] },
      instructions: [{ verb: "Restrict", what: "advance" }],
    },

    // 145078 The Battle of the Pelennor Fields (campaign card; its Resolution is in the-return-of-the-king.ts). Setup, in printed order: each Harad enemy the log records under The Black Gate is set aside, one copy for each recorded; the first player attaches Andúril and Banner of
    // Elendil, from the supply, to Aragorn and sets him aside, out of play (nothing in play left, so his Forced loss does not fire); The Corsair Fleet (Gondor side) is added to the staging area with the number the log records for its resources (0 with none); the five
    // burden sets of the earlier boxes are left out of the encounter deck. Forced: when the players advance to stage 5, each set aside Harad enemy is added to the staging area, not revealed.
    {
      id: "145078:campaignSetup:1",
      cardCode: "145078",
      lines: ["145078:A:1"],
      timing: "campaignSetup",
      instructions: [
        { verb: "SetAsideLogged", trait: "Harad" },
        { verb: "SetAsideHeroWithAttachments", hero: ARAGORN, attach: [ANDURIL, BANNER] },
        { verb: "AddToStagingWithResources", code: FLEET, amount: { recorded: "corsairFleet" } },
        { verb: "RemoveBurdenSets", sets: FIVE_BURDEN_SETS },
      ],
    },
    {
      id: "145078:forced:1",
      cardCode: "145078",
      lines: ["145078:B:1"],
      timing: "forced",
      trigger: "afterStageRevealed",
      condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", names: ["Fighting in the Fields"] } },
      instructions: [{ verb: "AddSetAsideToStaging", trait: "Harad", all: true }],
    },

    // 145079 The Witch-king (Captain side; Immune is a keyword). Cannot be optionally engaged or take damage. Forced: at the beginning of the quest phase cards are discarded from the encounter deck until an enemy is discarded, and that enemy is added to the staging area
    // (not revealed: no When Revealed, no surge); with none left nothing is added.
    { id: "145079:constant:1", cardCode: WITCH_KING_CAPTAIN, lines: ["145079:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "145079:forced:1", cardCode: WITCH_KING_CAPTAIN, lines: ["145079:A:3"], timing: "forced", trigger: "beginningOfPhase", condition: QUEST_PHASE, instructions: DISCARD_UNTIL_ENEMY },

    // 145080 The Witch-king (Sorcerer side). Only the engaged player can declare attackers against him (the flag attackOnlyByEngaged). Forced: at the beginning of the encounter phase he engages the first player and then makes an immediate attack against them (if he engaged).
    { id: "145080:constant:1", cardCode: WITCH_KING_SORCERER, lines: ["145080:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attackOnlyByEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "145080:forced:1",
      cardCode: WITCH_KING_SORCERER,
      lines: ["145080:A:2"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "phase", is: "Encounter" },
      instructions: [{ verb: "EngageFirstPlayer" }, { verb: "ImmediateAttack", when: { kind: "sourceIn", zone: "engaged" } }],
    },
];

export const AUTHORED_REPLACES: readonly string[] = [];
