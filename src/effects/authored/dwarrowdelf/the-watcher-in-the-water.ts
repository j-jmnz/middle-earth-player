import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Watcher in the Water (Dwarrowdelf part 6, no campaign card). Every line is read from the scan ledger (data/printed/dwarrowdelf.json). Regenerate is a keyword (the build reads it from the printed line, src/rules/families/encounter/regenerate.ts), so the
// line that prints only it has no record. The Tentacle enemies that attach to a character (Grasping, Writhing and Choking Tentacle) hold the discard check ("has a shadow effect or is a Tentacle enemy": the condition `discardedHasShadowOrTentacle` reads the card the effect's
// MoveEncounterCard discarded) and attach as `AttachEnemyToPicked` with `returns: "discard"`: while they lie there they are no enemy and they are discarded with their host. Doors of Durin sends its progress to the stage (`progressToQuest`); its Action lets each player
// discard from his hand, then compares the first letters of the titles. The Nightmare deck's records are in ../nightmare/the-watcher-in-the-water.ts. The readings are in docs/brief.md (The Watcher in the Water).
// Rules: dwd.setup-the-watcher-in-the-water, dwd.setup-the-watcher-in-the-water-set-aside, dwd.doors-of-durin, dwd.regenerate, dwd.encounter-card-actions, rr.first-player, rr.active-location, rr.travel, rr.reveal, rr.running-out-of-cards, faq.last-encounter-card, rr.limits,
// rr.cannot, rr.attachment-cards, rr.victory, rr.shadow-effects, rr.encounter-deck (data/rules/entries.json).
const DOORS = "04065";
const WATCHER = "04072";

const ATTACHED = { kind: "sourceIn", zone: "attached" } as const;
/** "Attached character", "attached hero": the host is that card type now. */
const HOST_IS = (type: "character" | "hero") => ({ kind: "matches", card: "host", pick: { type, control: "any" } }) as const;
/** "If that card has a shadow effect or is a Tentacle enemy": the card the effect discarded last (the picked card in the encounter discard pile). */
const CHECK: Condition = { kind: "discardedHasShadowOrTentacle" };
const DISCARD_TOP = { verb: "MoveEncounterCard", card: "deckTop", to: "discard" } as const;
/** The picked (just discarded) card is a Tentacle enemy: Stagnant Creek puts it into the staging area. */
const DISCARDED_TENTACLE_ENEMY: Condition = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", trait: "Tentacle" } };
/** Wrapped!: a hero its controller has, that is ready, able to exhaust and has no Tentacle attachment of any kind. */
const FREE_READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready", canExhaust: true, hasAttachment: { trait: "Tentacle", none: true } };
const FIRST_PLAYER_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready", who: "firstPlayer" };
/** The characters that attacked the enemy the effect answers; the first player chooses among them. */
const ATTACKERS: PickSpec = { type: "character", control: "any", participating: true, who: "firstPlayer" };

export const AUTHORED_EFFECTS: readonly Effect[] = [
    // 040076 Wrapped!. When Revealed: the first player attaches it to a hero he controls that has no Wrapped! (it is discarded with no effect when none can take it, as Shadow of Fear). Counts as a Tentacle attachment: the hero cannot exhaust or ready; at the end of the round it
    // is discarded from play (not destroyed). Combat Action, any player's: exhaust a ready hero he controls that has no Tentacle attachment to discard Wrapped!.
    { id: "040076:whenRevealed:1", cardCode: "040076", lines: ["040076:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "firstPlayer" } }] },
    {
      id: "040076:constant:1",
      cardCode: "040076",
      lines: ["040076:A:1"],
      timing: "constant",
      instructions: [
        { verb: "CountsAs", cardType: "attachment", trait: "Tentacle" },
        { verb: "AttachesTo", host: { kind: "hero" }, limitPerHost: true },
        { verb: "ModifyStat", stat: "cannotExhaust", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "whileSourceInPlay", target: "host" },
      ],
    },
    { id: "040076:triggered:1", cardCode: "040076", lines: ["040076:A:1"], timing: "triggered", trigger: "endOfRound", condition: ATTACHED, instructions: [{ verb: "Discard", target: { kind: "host" } }] },
    {
      id: "040076:action:1",
      cardCode: "040076",
      lines: ["040076:A:1"],
      timing: "action",
      anyPlayer: true,
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "canPick", pick: FREE_READY_HERO }] },
      instructions: [{ verb: "Pick", pick: FREE_READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "Discard", target: { kind: "self" } }],
    },

    // 04063 To the West-door. Setup: The Watcher and Doors of Durin are set aside by the data (dwd.setup-the-watcher-in-the-water-set-aside); the record shuffles the deck. B:1: the first player reveals until the staging area holds at least X Threat, X twice the players
    // (the same effect as 142021:A:1, with no player named: the first player, rr.first-player).
    { id: "04063:setup:1", cardCode: "04063", lines: ["04063:A:1"], timing: "setup", instructions: [{ verb: "ShuffleEncounterDeck" }] },
    { id: "04063:whenRevealed:1", cardCode: "04063", lines: ["04063:B:1"], timing: "whenRevealed", instructions: [{ verb: "RevealUntilThreat", threat: { players: true, times: 2 } }] },

    // 04064 The Seething Lake. B:1: The Watcher (04072, or the Nightmare Watcher in its place) joins the staging area, Doors of Durin becomes the active location (the one it replaces goes to the staging area), and every Tentacle card of the encounter discard pile
    // is shuffled into the deck. B:2: the stage cannot be defeated with fewer than 3 victory points, and when it is the game is won (as 04013:B:3 and B:4).
    {
      id: "04064:whenRevealed:1",
      cardCode: "04064",
      lines: ["04064:B:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "AddSetAsideToStaging", code: WATCHER }, { verb: "MakeSetAsideActive", code: DOORS }, { verb: "ShuffleEncounterDiscard", trait: "Tentacle" }],
    },
    { id: "04064:constant:1", cardCode: "04064", lines: ["04064:B:2"], timing: "constant", condition: { kind: "less", left: { victoryPoints: true }, right: 3 }, instructions: [{ verb: "Restrict", what: "advance" }] },
    { id: "04064:constant:2", cardCode: "04064", lines: ["04064:B:2"], timing: "constant", instructions: [] },

    // 04065 Doors of Durin. A:1: the progress that would be placed on it goes on the main quest stage. A:2: any player's Action, once per round: each player in turn, the first player first, discards any number of cards from his hand; then the top card of the encounter
    // deck is discarded (nothing resolves); when its title starts with the letter a discarded player card's title starts with, Doors of Durin goes to the victory display.
    { id: "04065:constant:1", cardCode: DOORS, lines: ["04065:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressToQuest", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "04065:action:1",
      cardCode: DOORS,
      lines: ["04065:A:2"],
      timing: "action",
      anyPlayer: true,
      limit: "oncePerRound",
      instructions: [
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Each", pick: { type: "card", control: "you", from: "hand" }, upTo: "any", instructions: [{ verb: "DiscardPicked" }] }] },
        DISCARD_TOP,
        { verb: "AddSourceToVictory", when: { kind: "firstLetterMatches" } },
      ],
    },

    // 04066 Stair Falls. Travel: the first player exhausts 2 ready characters he controls (the players cannot travel here with fewer). Shadow: 1 progress token is removed from the main quest (as 04067:A:2).
    {
      id: "04066:travel:1",
      cardCode: "04066",
      lines: ["04066:A:1"],
      timing: "travel",
      instructions: [{ verb: "Pick", pick: FIRST_PLAYER_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "Pick", pick: FIRST_PLAYER_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }],
    },
    { id: "04066:shadow:1", cardCode: "04066", lines: ["04066:A:2"], timing: "shadow", instructions: [{ verb: "RemoveProgressFromQuest", amount: 1 }] },

    // 04067 Perilous Swamp. A:1: no more than 1 progress token can be placed on it each round (the cap of Snowdrifts); what the cap leaves out from questing goes on the quest stage. A:2: Stair Falls' Shadow.
    { id: "04067:constant:1", cardCode: "04067", lines: ["04067:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressCap", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "04067:shadow:1", cardCode: "04067", lines: ["04067:A:2"], timing: "shadow", instructions: [{ verb: "RemoveProgressFromQuest", amount: 1 }] },

    // 04068 Makeshift Passage. Forced: after the players travel here, 2 progress go on the main quest stage, not on the location.
    { id: "04068:forced:1", cardCode: "04068", lines: ["04068:A:1"], timing: "forced", trigger: "traveled", subject: "self", instructions: [{ verb: "AddStageProgress", amount: 2 }] },

    // 04069 Stagnant Creek. When Revealed: the top card of the encounter deck is discarded; a Tentacle enemy so discarded is added to the staging area (not revealed), and then each player raises his threat by 5.
    {
      id: "04069:whenRevealed:1",
      cardCode: "04069",
      lines: ["04069:A:1"],
      timing: "whenRevealed",
      instructions: [DISCARD_TOP, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: DISCARDED_TENTACLE_ENEMY }, { verb: "RaiseThreat", amount: 5, who: "eachSeat", when: DISCARDED_TENTACLE_ENEMY }],
    },

    // 04070 Ill Purpose. When Revealed: every enemy in the staging area engages the player with the highest threat (the first player chooses among tied players); then each player raises his threat by the total Threat of the staging area as it stands. Shadow: the
    // attacking enemy gets +1 Attack, or +3 instead when it is a Tentacle.
    {
      id: "04070:whenRevealed:1",
      cardCode: "04070",
      lines: ["04070:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "PickHighestThreat" }, { verb: "SwitchActor", to: "picked" }, { verb: "EngageAll", who: "actor" }, { verb: "RaiseThreat", amount: { stagingThreat: true }, who: "eachSeat" }],
    },
    {
      id: "04070:shadow:1",
      cardCode: "04070",
      lines: ["04070:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Tentacle" } } } },
        { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Tentacle" } } },
      ],
    },

    // 04072 The Watcher. A:1 Regenerate 2 is a keyword. A:2: it cannot be optionally engaged while another Tentacle enemy is in play (a Tentacle lying as an attachment is no enemy). A:3: at the end of the combat phase, with it in the staging area, each player in turn
    // assigns 3 damage to 1 character he controls.
    {
      id: "04072:constant:1",
      cardCode: WATCHER,
      lines: ["04072:A:2"],
      timing: "constant",
      condition: { kind: "enemyInPlay", trait: "Tentacle", other: true, is: true },
      instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    {
      id: "04072:forced:1",
      cardCode: WATCHER,
      lines: ["04072:A:3"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "sourceIn", zone: "staging" }] },
      instructions: [{ verb: "AssignDamage", amount: 3, pick: { type: "character", control: "you" }, who: "eachSeat" }],
    },

    // 04073 Grasping Tentacle. Forced: when it is attacked (the attackers are declared) the top card of the encounter deck is discarded; on a match it attaches to an attacking character the first player chooses as a Tentacle attachment and the attack is over (no damage
    // is dealt to it: it is no enemy). Attached, the character's Attack and Defense are 0.
    {
      id: "04073:forced:1",
      cardCode: "04073",
      lines: ["04073:A:1"],
      timing: "forced",
      trigger: "enemyAttacked",
      subject: "self",
      instructions: [DISCARD_TOP, { verb: "Pick", pick: ATTACKERS, when: CHECK }, { verb: "AttachEnemyToPicked", returns: "discard", when: CHECK }, { verb: "CancelStrike", when: CHECK }],
    },
    { id: "04073:constant:1", cardCode: "04073", lines: ["04073:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Tentacle" }] },
    {
      id: "04073:constant:2",
      cardCode: "04073",
      lines: ["04073:A:1"],
      timing: "constant",
      condition: { kind: "all", conditions: [ATTACHED, HOST_IS("character")] },
      instructions: [{ verb: "SetStat", stat: "attack", value: 0, target: "host" }, { verb: "SetStat", stat: "defense", value: 0, target: "host" }],
    },

    // 04074 Thrashing Tentacle. Forced: when it is attacked the top card is discarded; on a match the damage of the attack (the attackers' total Attack less its Defense) is dealt to 1 character an attacking player controls, the first player choosing, ignoring that
    // character's defense, and the attack deals none to it.
    {
      id: "04074:forced:1",
      cardCode: "04074",
      lines: ["04074:A:1"],
      timing: "forced",
      trigger: "enemyAttacked",
      subject: "self",
      instructions: [
        DISCARD_TOP,
        { verb: "Pick", pick: { type: "character", control: "any", who: "firstPlayer", controlledBy: "attackers" }, when: CHECK },
        { verb: "DamageCard", amount: { attackDamage: true }, target: "picked", when: CHECK },
        { verb: "CancelStrike", when: CHECK },
      ],
    },

    // 04075 Striking Tentacle. Forced: when it attacks (before the defender is declared) the top card is discarded; on a match the attack is considered undefended.
    { id: "04075:forced:1", cardCode: "04075", lines: ["04075:A:1"], timing: "forced", trigger: "attacks", subject: "self", instructions: [DISCARD_TOP, { verb: "ConsiderUndefended", when: CHECK }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
