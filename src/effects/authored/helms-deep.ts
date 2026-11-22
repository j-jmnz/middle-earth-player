import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as THE_FATE_OF_WILDERLAND } from "./the-fate-of-wilderland.ts";
import { AUTHORED_EFFECTS as THE_URUK_HAI } from "./the-uruk-hai.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for Helm's Deep (the-two-towers part 2, campaign card 143077, whose records are in the-two-towers.ts): the Defense keyword (mec112.defense: the fortress family), The Defense of Helm's Deep, the
// Poisoned Counsels burden (a card that functions like a player card: the burden family) and the encounter cards no template reads. Every line is read from the scan ledger (data/printed/the-two-towers.json); a
// line a template already writes (pnpm data build) or another card prints word for word needs no record here. The piles place The Defense of Helm's Deep, Deeping Wall and the Soldiers of Isengard aside (the
// first two sentences of 143072:A:1); its record makes the choice that follows. See docs/scenarios/the-two-towers.md, The Two Towers, for each reading.
// Rules: mec112.defense, mec112.poisoned-counsels-searching-eye, rr.active-location, rr.lasting-effects, rr.neutral-cards, rr.unique-cards, rr.forced, rr.explored, rr.victory, faq.additional-attacks (data/rules/entries.json).
const DEFENSE = "143033";
const SOLDIER = "143036";
const DEEPING_WALL = "143038";
const HELMS_GATE = "143041";
const POISONED_COUNSELS = "143021";
const STAGE_2 = "143073";
const STAGE_5 = "143076";
// "Forced: When X is explored" (the location leaves play explored): the record hears it from the card itself, as Hills of Hollin's does (142032:A:2).
const WHEN_EXPLORED = { trigger: "leftPlay", subject: "self", condition: { kind: "subjectExplored" } } as const;
const STAGING_ENEMIES: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
// "The enemy that attacked" is the card whose record this is: one of several copies of Soldier of Isengard or Warrior of Dunland.
const THIS_ENEMY: PickSpec = { type: "enemy", control: "any", isSource: true };
const A_CHARACTER: PickSpec = { type: "character", control: "any" };
const ATTACKING_ENEMY_PLUS_ONE: Instruction = { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
// "After ~ attacks and destroys a character": the character's destruction by the attack names the attacking enemy as the other card, and `isSource` keeps it to the copy that attacked.
const DESTROYS_A_CHARACTER = { trigger: "characterDestroyedByAttack", subject: A_CHARACTER, condition: { kind: "matches", card: "other", pick: THIS_ENEMY } } as const satisfies Partial<Effect>;
const ACTIVE_LOCATION: PickSpec = { type: "location", control: "any", active: true };
const HELMS_GATE_STAGED: PickSpec = { type: "location", control: "any", stagingOnly: true, names: ["Helm's Gate"] };
const TOKENS_AT_LIMIT: Condition = { kind: "tokens", code: DEFENSE, min: 8 };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 143021 Poisoned Counsels (burden, Helm's Deep). It functions like a player card (a marker: it sits in a deck, is drawn, held, discarded from the hand or the deck, and prints no cost, so it is never
    // played; mec112.poisoned-counsels-searching-eye). Forced: after it is drawn the rest of the hand is discarded.
    { id: "143021:constant:1", cardCode: "143021", lines: ["143021:A:1"], timing: "constant", instructions: [] },
    { id: "143021:forced:1", cardCode: "143021", lines: ["143021:A:2"], timing: "forced", trigger: "enteredHand", subject: "self", instructions: [{ verb: "DiscardEach", pick: { type: "card", control: "you", from: "hand" } }] },

    // 143033 The Defense of Helm's Deep (objective). Its tokens add to the total Threat in the staging area, read live. At the end of the quest phase it gains a token; with 8 it goes to the victory display and
    // the players advance to stage 5A, from whichever stage they are on (the tokens change only here, so the check follows the placing).
    {
      id: "143033:constant:1",
      cardCode: DEFENSE,
      lines: ["143033:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "moreStagingThreat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "table" }],
    },
    {
      id: "143033:forced:1",
      cardCode: DEFENSE,
      lines: ["143033:A:2", "143033:A:3"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Quest" },
      instructions: [
        { verb: "PlaceToken", amount: 1 },
        { verb: "AddSourceToVictory", when: TOKENS_AT_LIMIT },
        { verb: "AdvanceToStage", code: STAGE_5, when: { kind: "inVictory", code: DEFENSE, is: true } },
      ],
    },

    // 143034 Wild Hillman, 143035 Warrior of Dunland, 143036 Soldier of Isengard: progress on the active location after an attack or a kill; the Soldier's shadow exhausts a character.
    { id: "143034:forced:1", cardCode: "143034", lines: ["143034:A:1"], timing: "forced", trigger: "attackResolved", subject: "self", instructions: [{ verb: "PlaceProgressOn", amount: 1, target: "activeLocation" }] },
    {
      id: "143034:shadow:1",
      cardCode: "143034",
      lines: ["143034:A:2"],
      timing: "shadow",
      // The progress can explore the location, whose Forced effects then wait for a frame: the Pick makes the Shadow run in one.
      instructions: [
        { verb: "Pick", pick: ACTIVE_LOCATION, when: { kind: "canPick", pick: ACTIVE_LOCATION } },
        { verb: "PlaceProgressOn", amount: 1, target: "picked", when: { kind: "canPick", pick: ACTIVE_LOCATION } },
        { verb: "ModifyStat", stat: "attack", amount: { stat: "progress", of: "activeLocation" }, until: "endOfAttack", target: "attacker" },
      ],
    },
    { id: "143035:whenRevealed:1", cardCode: "143035", lines: ["143035:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttackFromStaging", target: "self" }] },
    { id: "143035:forced:1", cardCode: "143035", lines: ["143035:A:3"], timing: "forced", ...DESTROYS_A_CHARACTER, instructions: [{ verb: "PlaceProgressOn", amount: 3, target: "activeLocation" }] },
    { id: "143036:forced:1", cardCode: SOLDIER, lines: ["143036:A:2"], timing: "forced", ...DESTROYS_A_CHARACTER, instructions: [{ verb: "ProgressQuest", amount: 1 }] },
    copyLine("19158:A:2", "143036:A:3"),

    // 143037 The Hornburg: the archery total is 1 lower for each player while it is the active location; when it is explored the first player assigns as much damage as there are enemies in play among any characters.
    {
      id: "143037:constant:1",
      cardCode: "143037",
      lines: ["143037:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "archeryBonus", amount: { players: true, negative: true }, until: "whileSourceInPlay" }],
    },
    {
      id: "143037:forced:1",
      cardCode: "143037",
      lines: ["143037:A:2"],
      timing: "forced",
      ...WHEN_EXPLORED,
      instructions: [{ verb: "AssignDamage", amount: { count: { type: "enemy", control: "any", staging: true } }, pick: A_CHARACTER }],
    },

    // 143038 Deeping Wall: +1 Defense for each hero while it is the active location (the same line as Dwarven Watchtower); each player raises their threat by 4 when it is explored.
    copyLine("19163:A:1", "143038:A:1"),
    { id: "143038:forced:1", cardCode: DEEPING_WALL, lines: ["143038:A:2"], timing: "forced", ...WHEN_EXPLORED, instructions: [{ verb: "RaiseThreat", amount: 4, who: "eachSeat" }] },

    // 143039 Deeping Culvert: its Threat X is 1 more than the allies the first player controls (the printed Threat is X, which the data reads as 0); each player searches for an enemy when it is explored.
    {
      id: "143039:constant:1",
      cardCode: "143039",
      lines: ["143039:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: { type: "ally", control: "you", who: "firstPlayer" }, plus: 1 }, until: "whileSourceInPlay", target: "self" }],
    },
    {
      id: "143039:forced:1",
      cardCode: "143039",
      lines: ["143039:A:2"],
      timing: "forced",
      ...WHEN_EXPLORED,
      instructions: [EACH_PLAYER([{ verb: "SearchReveal", type: "enemy", who: "actor" }]), { verb: "ShuffleEncounterDeck" }],
    },

    // 143040 Postern Door: +1 Attack for each hero while it is the active location; when it is explored players cannot declare attacks until the end of the round (the table holds it, so a character that enters play later is barred too).
    {
      id: "143040:constant:1",
      cardCode: "143040",
      lines: ["143040:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "heroes" }],
    },
    {
      id: "143040:forced:1",
      cardCode: "143040",
      lines: ["143040:A:2"],
      timing: "forced",
      ...WHEN_EXPLORED,
      instructions: [{ verb: "ModifyStat", stat: "cannotDeclareAttacks", amount: 1, until: "endOfRound", target: "table" }],
    },

    // 143041 Helm's Gate: while it is the active location the first player reveals an encounter card at the end of each staging step if a player is unengaged; when it is explored each enemy, now and arriving
    // later (an encounter card's lasting effect), gets -20 engagement cost and +2 Attack until the end of the round.
    {
      id: "143041:forced:1",
      cardCode: HELMS_GATE,
      lines: ["143041:A:1"],
      timing: "forced",
      trigger: "stagingStepEnds",
      condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "activeLocation" }, { kind: "playerUnengaged" }] },
      instructions: [{ verb: "RevealEncounter" }],
    },
    {
      id: "143041:forced:2",
      cardCode: HELMS_GATE,
      lines: ["143041:A:2"],
      timing: "forced",
      ...WHEN_EXPLORED,
      instructions: [
        { verb: "ModifyStat", stat: "engagementCost", amount: -20, until: "endOfRound", target: "enemies" },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfRound", target: "enemies" },
      ],
    },

    // 143042 Scaling Ladders (Siege attachment on the active location: each enemy gets +1 Threat); the shadow also places progress on the current quest when the attack destroys a character.
    { id: "143042:whenRevealed:1", cardCode: "143042", lines: ["143042:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachToActiveLocation" }] },
    { id: "143042:constant:1", cardCode: "143042", lines: ["143042:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", target: "enemies" }] },
    {
      id: "143042:shadow:1",
      cardCode: "143042",
      lines: ["143042:A:3"],
      timing: "shadow",
      instructions: [ATTACKING_ENEMY_PLUS_ONE, { verb: "AfterAttack", instructions: [{ verb: "ProgressQuest", amount: 1, when: { kind: "x", min: 1 } }] }],
    },

    // 143043 Devilry of Saruman: 3 progress on the main quest bypassing the active location, and the text box of every character, in play now and entering later, blank until the end of the round.
    {
      id: "143043:whenRevealed:1",
      cardCode: "143043",
      lines: ["143043:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "AddStageProgress", amount: 3 },
        { verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfRound", target: "characters" },
      ],
    },
    {
      id: "143043:shadow:1",
      cardCode: "143043",
      lines: ["143043:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfRound", target: "attacker" },
        { verb: "ModifyStat", stat: "toughness", amount: 2, until: "endOfRound", target: "attacker" },
      ],
    },

    // 143044 Reckless Hate: the staged enemy with the highest Attack attacks the revealing player, else it gains surge; the shadow's additional attack is dealt a new shadow card (faq.additional-attacks).
    {
      id: "143044:whenRevealed:1",
      cardCode: "143044",
      lines: ["143044:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true, highestAttack: true } },
        { verb: "AttackFromStaging", when: { kind: "canPick", pick: STAGING_ENEMIES } },
        { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: STAGING_ENEMIES } } },
      ],
    },
    copyLine("143031:A:2", "143044:A:3"),

    // 143045 Night Without End: either remove a token from The Defense of Helm's Deep (offered only while it holds one) or reveal 2 additional encounter cards.
    {
      id: "143045:whenRevealed:1",
      cardCode: "143045",
      lines: ["143045:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "remove", requires: { kind: "tokens", code: DEFENSE, min: 1 }, instructions: [{ verb: "RemoveResourceTokens", code: DEFENSE, amount: 1 }] },
            { id: "reveal", instructions: [{ verb: "RevealEncounter" }, { verb: "RevealEncounter" }] },
          ],
        },
      ],
    },

    // 143072 The King of the Golden Hall. Setup: the piles set The Defense of Helm's Deep, a Deeping Wall and a Soldier of Isengard for each player aside; the first player answers for the players: Poisoned Counsels
    // into each deck (after the starting hands), or advance to stage 2A bypassing stage 1B. Side B: each player puts an ally from their hand that matches the sphere of one of their heroes into play (a neutral
    // ally and a Fellowship hero match none); the quest phase and the combat phase are skipped; the round's end advances to 2A.
    {
      id: "143072:setup:1",
      cardCode: "143072",
      lines: ["143072:A:1"],
      timing: "setup",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "counsels", instructions: [{ verb: "ShuffleCopyIntoEachDeck", code: POISONED_COUNSELS }] },
            { id: "bypass", instructions: [{ verb: "AdvanceToStage", code: STAGE_2 }] },
          ],
        },
      ],
    },
    {
      id: "143072:whenRevealed:1",
      cardCode: "143072",
      lines: ["143072:B:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "PutIntoPlayFromHand", pick: { type: "ally", control: "you", heroSphere: true }, required: true }])],
    },
    {
      id: "143072:constant:1",
      cardCode: "143072",
      lines: ["143072:B:2"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "skipQuestPhase", amount: 1, until: "whileSourceInPlay", target: "table" },
        { verb: "ModifyStat", stat: "skipCombat", amount: 1, until: "whileSourceInPlay", target: "table" },
      ],
    },
    { id: "143072:forced:1", cardCode: "143072", lines: ["143072:B:3"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "AdvanceToStage", code: STAGE_2 }] },

    // 143073 Assault on Helm's Deep. When revealed: The Defense of Helm's Deep and each set aside Soldier of Isengard join the staging area, Deeping Wall becomes the active location, the encounter deck is shuffled and
    // each player reveals 1 encounter card. Side B has Defense (the fortress family). At the end of the combat phase the first player reveals a card when fewer enemies are staged than there are players;
    // at the end of the round each staged enemy places 1 progress on this stage, bypassing the active location.
    {
      id: "143073:whenRevealed:1",
      cardCode: STAGE_2,
      lines: ["143073:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "AddSetAsideToStaging", code: DEFENSE },
        { verb: "AddSetAsideToStaging", code: SOLDIER, all: true },
        { verb: "MakeSetAsideActive", code: DEEPING_WALL },
        { verb: "ShuffleEncounterDeck" },
        EACH_PLAYER([{ verb: "RevealEncounter" }]),
      ],
    },
    { id: "143073:constant:1", cardCode: STAGE_2, lines: ["143073:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "defenseKeyword", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "143073:forced:1",
      cardCode: STAGE_2,
      lines: ["143073:B:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "less", left: { count: STAGING_ENEMIES }, right: { players: true } }] },
      instructions: [{ verb: "RevealEncounter" }],
    },
    { id: "143073:forced:2", cardCode: STAGE_2, lines: ["143073:B:3"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "AddStageProgress", amount: { count: STAGING_ENEMIES } }] },
    copyLine("143073:B:1", "143074:B:1"),

    // 143074 The Hosts of Isengard. When revealed: Helm's Gate is searched for in the encounter deck, its discard pile and the victory display and added to the staging area (a copy already staged stays), the encounter
    // deck is shuffled and Helm's Gate becomes the active location, the previous one going back to staging. Side B has Defense; after the quest resolves, if the encounter deck placed no progress on this stage as the result
    // of questing (progress the active location took does not count), the first player reveals 1 encounter card.
    {
      id: "143074:whenRevealed:1",
      cardCode: "143074",
      lines: ["143074:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "SearchToStaging", code: HELMS_GATE },
        { verb: "ShuffleEncounterDeck" },
        { verb: "Pick", pick: HELMS_GATE_STAGED, when: { kind: "canPick", pick: HELMS_GATE_STAGED } },
        { verb: "MakeActive", when: { kind: "canPick", pick: HELMS_GATE_STAGED } },
      ],
    },
    {
      id: "143074:forced:1",
      cardCode: "143074",
      lines: ["143074:B:2"],
      timing: "forced",
      trigger: "defenseQuestResolved",
      subject: "self",
      condition: { kind: "not", condition: { kind: "encounterPlacedOnStage" } },
      instructions: [{ verb: "RevealEncounter" }],
    },

    // 143075 The Wall is Breached!. When revealed: the encounter discard pile is shuffled in and cards are discarded until as many enemies as there are players are discarded, which join the staging area. Side B has Defense;
    // each destroyed character places 1 progress on this stage, bypassing the active location; the stage defeated, whoever placed the last progress, loses the game.
    {
      id: "143075:whenRevealed:1",
      cardCode: "143075",
      lines: ["143075:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, to: "staging" }],
    },
    copyLine("143073:B:1", "143075:B:1"),
    { id: "143075:forced:1", cardCode: "143075", lines: ["143075:B:2"], timing: "forced", trigger: "characterDestroyed", instructions: [{ verb: "AddStageProgress", amount: 1 }] },
    {
      id: "143075:forced:2",
      cardCode: "143075",
      lines: ["143075:B:3"],
      timing: "forced",
      trigger: "questCardDefeated",
      subject: "self",
      instructions: [{ verb: "LoseGame", reason: "The Wall is Breached!: Saruman's army captured Helm's Deep" }],
    },

    // 143076 The King Rides Out. Side B: the quest phase is skipped and players cannot reduce their threat; the players win once no enemy is in play.
    copyLine("143075:A:1", "143076:A:1"),
    {
      id: "143076:constant:1",
      cardCode: STAGE_5,
      lines: ["143076:B:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "skipQuestPhase", amount: 1, until: "whileSourceInPlay", target: "table" },
        { verb: "ModifyStat", stat: "noThreatReduction", amount: 1, until: "whileSourceInPlay", target: "eachSeat" },
      ],
    },
    { id: "143076:constant:2", cardCode: STAGE_5, lines: ["143076:B:2"], timing: "constant", condition: { kind: "enemyInPlay", is: false }, instructions: [{ verb: "WinGame" }] },
  ],
  { pool: [...THE_FATE_OF_WILDERLAND, ...THE_URUK_HAI] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
