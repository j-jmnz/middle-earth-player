import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { ALWAYS } from "../conditions.ts";
import { AUTHORED_EFFECTS as ESCAPE_FROM_DOL_GULDUR } from "../escape-from-dol-guldur.ts";
import { mayBypass, whenDefeated } from "../mount-gundabad.ts";
import { copyLine, withCopies } from "../reprint.ts";
import { AUTHORED_EFFECTS as INTO_THE_PIT } from "./into-the-pit.ts";

// Records for Flight from Moria (Dwarrowdelf part 3, no campaign card). Every line is read from the scan ledger (data/printed/dwarrowdelf.json); the Nightmare deck's records are in ../nightmare/flight-from-moria.ts. The readings are in docs/brief.md (Flight from Moria).
// The quest deck is Mount Gundabad's shape (mount-gundabad.ts): the stage 2s are shuffled with side A up beneath stage 1, each is flipped at the beginning of the staging step (FlipCurrentQuest `resolve`, which also marks it a stage of a quest deck and resolves its side B's When Revealed)
// and may be bypassed at the end of the combat phase (families/wilderland/gundabad.ts, moria.ts). The Great Cave-troll prints the Nazgûl of Dol Guldur's "No attachments can be played" (01102:A:1) and Goblin Spearman's twin lines are Into the Pit's.
// Rules: dwd.creating-the-quest-deck, dwd.bypassing-a-quest-card, dwd.the-nameless-fear, dwd.immune-to-ranged-damage, dwd.last-player, dwd.encounter-card-actions, rr.reveal, rr.first-player, rr.guarded, rr.blank, rr.attachment-cards, rr.search, rr.cancel (data/rules/entries.json).
const NAMELESS = "The Nameless Fear";
const FEAR_ATTACK = { stat: "attack", ofNamed: NAMELESS } as const;
const FEAR_THREAT = { stat: "threat", ofNamed: NAMELESS } as const;
const VICTORY_POINTS = { victoryPoints: true } as const;
const TOOLS = "03029";
const A_FOE_BEYOND = "03028";
const HEADING_UP = "03071";
const UNDEFENDED: Condition = { kind: "undefended" };
const NOT_UNDEFENDED: Condition = { kind: "not", condition: UNDEFENDED };
const NOT_STAGE_ONE: Condition = { kind: "not", condition: { kind: "onStage", stage: 1 } };
const STAGE_ONE: Condition = { kind: "onStage", stage: 1 };
const FIRST_PLAYER: Condition = { kind: "firstPlayer" };
const NOT_FIRST_PLAYER: Condition = { kind: "not", condition: FIRST_PLAYER };
const QUESTING_CHARACTER: PickSpec = { type: "character", control: "you", committed: true };
// A hero any player controls that carries Abandoned Tools.
const HERO_WITH_TOOLS: PickSpec = { type: "hero", control: "any", hasAttachment: { names: ["Abandoned Tools"] }, state: "ready", canExhaust: true };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]) => ({ verb: "ForEachPlayer" as const, order: "firstFirst" as const, instructions });
// "Each player reveals 1 card" for the line printed as 03064:B:1 is a copy; this is the same record where a card prints it with its own wording.
const REVEAL_ONE_EACH = EACH_PLAYER([{ verb: "RevealEncounter" }]);

// "While Search for an Exit is the active quest card, only flip it to side 2B at the beginning of the staging step" (A:1 of every stage 2): the stage is a stage of the quest deck, flipped as the staging step begins, which resolves its side B's When Revealed.
export const flipAtStagingStep = (code: string): Effect => ({
  id: `${code}:forced:1`,
  cardCode: code,
  lines: [`${code}:A:1`],
  timing: "forced",
  trigger: "stagingStepBegins",
  instructions: [{ verb: "FlipCurrentQuest", resolve: true }],
});

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 03025 The Nameless Fear (Immune to player card effects is a keyword). It cannot engage or be engaged. Its Threat, Attack and Defense are X, X the Victory points of the victory display, read live.
    {
      id: "03025:constant:1",
      cardCode: "03025",
      lines: ["03025:A:2"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "noEngagementChecks", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    {
      id: "03025:constant:2",
      cardCode: "03025",
      lines: ["03025:A:3"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: VICTORY_POINTS, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "attack", amount: VICTORY_POINTS, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "defense", amount: VICTORY_POINTS, until: "whileSourceInPlay", target: "self" },
      ],
    },

    // 03026 New Devilry. When Revealed: after stage 1 the current stage is shuffled into the quest deck and the top stage is revealed; on stage 1 it gains surge. Shadow: an undefended attack raises the defender's threat by The Nameless Fear's Threat.
    {
      id: "03026:whenRevealed:1",
      cardCode: "03026",
      lines: ["03026:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "RevealNewStage", when: NOT_STAGE_ONE }, { verb: "GainSurge", when: STAGE_ONE }],
    },
    { id: "03026:shadow:1", cardCode: "03026", lines: ["03026:A:2"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: FEAR_THREAT, who: "actor", when: UNDEFENDED }] },

    // 03027 Shadow of Fear. When Revealed: the first player attaches it to one of his heroes without one, else it is discarded. As a Condition attachment the hero cannot exhaust or ready and its text box is blank; any player may take the Action
    // (dwd.encounter-card-actions): 3 resources from the attached hero's pool discard it.
    { id: "03027:whenRevealed:1", cardCode: "03027", lines: ["03027:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "firstPlayer" } }] },
    {
      id: "03027:constant:1",
      cardCode: "03027",
      lines: ["03027:A:1"],
      timing: "constant",
      instructions: [
        { verb: "CountsAs", cardType: "attachment", trait: "Condition" },
        { verb: "AttachesTo", host: { kind: "hero" }, limitPerHost: true },
        { verb: "ModifyStat", stat: "cannotExhaust", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", target: "host" },
      ],
    },
    { id: "03027:action:1", cardCode: "03027", lines: ["03027:A:1"], timing: "action", anyPlayer: true, cost: { kind: "resources", amount: 3, from: "host" }, instructions: [{ verb: "Discard", target: { kind: "self" } }] },

    // 03028 A Foe Beyond. When Revealed (nothing cancels it): the last player's hero takes damage equal to The Nameless Fear's Attack, which no ability cancels (redirecting it is not a cancel). Shadow: the defending character takes the same damage.
    {
      id: "03028:whenRevealed:1",
      cardCode: A_FOE_BEYOND,
      lines: ["03028:A:1"],
      timing: "whenRevealed",
      uncancelable: ALWAYS,
      instructions: [
        EACH_PLAYER([
          { verb: "Pick", pick: { type: "hero", control: "you" }, when: { kind: "lastPlayer" } },
          { verb: "DamageCard", amount: FEAR_ATTACK, uncancelable: true, when: { kind: "lastPlayer" } },
        ]),
      ],
    },
    { id: "03028:shadow:1", cardCode: A_FOE_BEYOND, lines: ["03028:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: FEAR_ATTACK, target: "defender", when: NOT_UNDEFENDED }] },

    // 03029 Abandoned Tools. Guarded when it is revealed. Action: any player exhausts a ready hero to claim it while it lies in the staging area with no encounter card attached; it attaches to that hero.
    { id: "03029:whenRevealed:1", cardCode: TOOLS, lines: ["03029:A:1"], timing: "whenRevealed", instructions: [{ verb: "GuardObjective" }] },
    {
      id: "03029:action:1",
      cardCode: TOOLS,
      lines: ["03029:A:2"],
      timing: "action",
      anyPlayer: true,
      condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, { kind: "freeOfEncounters" }, { kind: "canPick", pick: { type: "hero", control: "you", state: "ready", canExhaust: true } }] },
      instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", state: "ready", canExhaust: true } }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "ClaimObjective" }],
    },

    // 03042 Great Cave-troll (Victory 3). A:1: characters that attack it by the ranged keyword deal it no damage (dwd.immune-to-ranged-damage). A:2: the Nazgûl of Dol Guldur's line.
    { id: "03042:constant:1", cardCode: "03042", lines: ["03042:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToRangedDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    copyLine("01102:A:1", "03042:A:2"),

    // 03043 Orc Drummer: while it is in the staging area each enemy in play gets +X Threat, X the players; it is an enemy too.
    {
      id: "03043:constant:1",
      cardCode: "03043",
      lines: ["03043:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true } }],
    },

    // 03044 Stray Goblin: Threat and Attack are X, X the players. Shadow: the attacker gets +X Attack (the same line on 03046 and 03047).
    {
      id: "03044:constant:1",
      cardCode: "03044",
      lines: ["03044:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "attack", amount: { players: true }, until: "whileSourceInPlay" }],
    },
    { id: "03044:shadow:1", cardCode: "03044", lines: ["03044:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { players: true }, until: "endOfAttack", target: "attacker" }] },

    // 03045 Chance Encounter. When Revealed: the top enemy of the encounter discard pile is put into play engaged with the first player, not revealed; with no enemy there it gains surge. Shadow: +1 Attack, +3 when the defending player is the first player.
    {
      id: "03045:whenRevealed:1",
      cardCode: "03045",
      lines: ["03045:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "GainSurge", when: { kind: "not", condition: { kind: "encounterHas", piles: "discard", cardType: "enemy" } } },
        { verb: "ActAs", who: "firstPlayer" },
        { verb: "PickDiscardTop", types: ["enemy"] },
        { verb: "MoveEncounterCard", card: "picked", to: "engaged", when: { kind: "encounterHas", piles: "discard", cardType: "enemy" } },
      ],
    },
    {
      id: "03045:shadow:1",
      cardCode: "03045",
      lines: ["03045:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: NOT_FIRST_PLAYER },
        { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: FIRST_PLAYER },
      ],
    },

    // 03046 Massing in the Deep (Doomed 1 is a keyword). When Revealed: X additional cards are revealed one after another, X the players.
    { id: "03046:whenRevealed:1", cardCode: "03046", lines: ["03046:A:2"], timing: "whenRevealed", instructions: [REVEAL_ONE_EACH] },
    copyLine("03044:A:2", "03046:A:3"),

    // 03047 The Mountains' Roots: Threat and quest points are X, X the players.
    {
      id: "03047:constant:1",
      cardCode: "03047",
      lines: ["03047:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "questPoints", amount: { players: true }, until: "whileSourceInPlay" }],
    },
    copyLine("03044:A:2", "03047:A:2"),

    // 03069 A Presence in the Dark (stage 1). Setup: the stage 2s are shuffled into the quest deck with side A up (the Nightmare stages too), The Nameless Fear is in the staging area (the piles) and each player shuffles 1 set aside copy of A Foe Beyond into the encounter deck.
    // Side B: each player reveals a card, then the stage goes to the victory display and the quest advances to the top stage 2A. The Nameless Fear's X is 0 until then.
    {
      id: "03069:setup:1",
      cardCode: "03069",
      lines: ["03069:A:1"],
      timing: "setup",
      instructions: [
        { verb: "ShuffleStages", codes: ["03070", "03071", "03072", "03073", "03074", "03075", "03076", "901202", "901203", "901204"] },
        EACH_PLAYER([{ verb: "ShuffleSetAsideIntoEncounterDeck", code: A_FOE_BEYOND }]),
        { verb: "ShuffleEncounterDeck" },
      ],
    },
    { id: "03069:whenRevealed:1", cardCode: "03069", lines: ["03069:B:1"], timing: "whenRevealed", instructions: [REVEAL_ONE_EACH, { verb: "AdvanceStage" }] },

    // 03070 Heading Down and 03071 Heading Up (stage 2). Forced: at the end of a quest phase in which the other is in the victory display, the other is shuffled back into the quest deck.
    flipAtStagingStep("03070"),
    {
      id: "03070:forced:2",
      cardCode: "03070",
      lines: ["03070:B:1"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "inVictory", code: HEADING_UP, is: true }] },
      instructions: [{ verb: "ShuffleStageFromVictory", code: HEADING_UP }],
    },
    mayBypass("03070:forced:3", "03070", "03070:B:2"),
    flipAtStagingStep("03071"),
    {
      id: "03071:forced:2",
      cardCode: "03071",
      lines: ["03071:B:1"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "inVictory", code: "03070", is: true }] },
      instructions: [{ verb: "ShuffleStageFromVictory", code: "03070" }],
    },
    mayBypass("03071:forced:3", "03071", "03071:B:2"),

    // 03072 Search for an Exit (1 quest point): each player reveals a card; bypass.
    flipAtStagingStep("03072"),
    copyLine("03064:B:1", "03072:B:1"),
    mayBypass("03072:forced:2", "03072", "03072:B:2"),

    // 03073 Narrow Paths. When Revealed: each player chooses 1 questing character he controls; the other questing characters do not count their Willpower until the end of the round. Forced: after the 1st progress token is placed on it the encounter deck and discard pile are searched for
    // Abandoned Tools, which joins the staging area (unguarded), and the deck is shuffled.
    flipAtStagingStep("03073"),
    {
      id: "03073:whenRevealed:1",
      cardCode: "03073",
      lines: ["03073:B:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ModifyStat", stat: "ignoresWillpower", amount: 1, until: "endOfRound", target: "table" },
        EACH_PLAYER([
          { verb: "Pick", pick: QUESTING_CHARACTER, when: { kind: "canPick", pick: QUESTING_CHARACTER } },
          { verb: "ModifyStat", stat: "countsWillpower", amount: 1, until: "endOfRound", target: "picked", when: { kind: "canPick", pick: QUESTING_CHARACTER } },
        ]),
      ],
    },
    {
      id: "03073:forced:2",
      cardCode: "03073",
      lines: ["03073:B:2"],
      timing: "forced",
      trigger: "progressPlaced",
      subject: "self",
      instructions: [
        // The first progress placed: the stage holds only what this placement added.
        { verb: "SearchMove", code: TOOLS, to: "staging", when: { kind: "not", condition: { kind: "less", left: { x: true }, right: { stat: "progress", of: "self" } } } },
        { verb: "ShuffleEncounterDeck", when: { kind: "not", condition: { kind: "less", left: { x: true }, right: { stat: "progress", of: "self" } } } },
      ],
    },
    mayBypass("03073:forced:3", "03073", "03073:B:3"),

    // 03074 Hasty Council (no quest points, Victory 2). When Revealed: every A Foe Beyond in the encounter discard pile is shuffled into the encounter deck; the first player looks at the top 2 stages and chooses 1 to become the current quest, flipped at once, the other going to the bottom of the
    // quest deck; then Hasty Council goes to the victory display.
    flipAtStagingStep("03074"),
    {
      id: "03074:whenRevealed:1",
      cardCode: "03074",
      lines: ["03074:B:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ShuffleEncounterDiscard", name: "A Foe Beyond" }, { verb: "ChooseStageToFlip", count: 2 }, { verb: "AddSourceToVictory" }],
    },

    // 03075 Blocked by Shadow (9 quest points). When Revealed: the first player chooses: each player discards the top card of the encounter deck and is eliminated if it is a treachery, or the stage goes to the bottom of the quest deck and the next stage is revealed (not a bypass). Bypass; defeating it wins.
    flipAtStagingStep("03075"),
    {
      id: "03075:whenRevealed:1",
      cardCode: "03075",
      lines: ["03075:B:1", "03075:B:2", "03075:B:3"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            {
              id: "discard",
              instructions: [{ verb: "DiscardTopEliminating", type: "treachery" }],
            },
            { id: "next", requires: { kind: "questDeck" }, instructions: [{ verb: "RevealNewStage", bottom: true }] },
          ],
        },
      ],
    },
    mayBypass("03075:forced:2", "03075", "03075:B:4"),
    whenDefeated("03075:forced:3", "03075", "03075:B:5", [{ verb: "WinGame" }]),

    // 03076 Escape from Darkness (4 quest points). Abandoned Tools gains a Refresh Action: exhaust the attached hero to put 1 progress on this stage. Progress can be placed on it by nothing else. Bypass; defeating it wins.
    flipAtStagingStep("03076"),
    // The Action, once for each use the Nightmare setup card allows: with it in play (the table holds refreshOnce) a use this round (refreshUsed) bars the next.
    ...[0, 1].map((nightmare): Effect => ({
      id: `03076:action:${nightmare + 1}`,
      cardCode: "03076",
      lines: ["03076:B:1"],
      timing: "action",
      condition: {
        kind: "all",
        conditions: [
          { kind: "phase", is: "Refresh" },
          { kind: "canPick", pick: HERO_WITH_TOOLS },
          { kind: "flag", stat: "refreshOnce", holder: "table", is: nightmare === 1 },
          ...(nightmare === 1 ? [{ kind: "flag" as const, stat: "refreshUsed", holder: "table" as const, is: false }] : []),
        ],
      },
      instructions: [
        { verb: "Pick", pick: HERO_WITH_TOOLS },
        { verb: "Exhaust", target: { kind: "picked" } },
        { verb: "AddStageProgress", amount: 1 },
        { verb: "ModifyStat", stat: "refreshUsed", amount: 1, until: "endOfRound", target: "table" },
      ],
    })),
    mayBypass("03076:forced:2", "03076", "03076:B:2"),
    { id: "03076:constant:1", cardCode: "03076", lines: ["03076:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    whenDefeated("03076:forced:3", "03076", "03076:B:4", [{ verb: "WinGame" }]),
  ],
  { pool: [...INTO_THE_PIT, ...ESCAPE_FROM_DOL_GULDUR] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
