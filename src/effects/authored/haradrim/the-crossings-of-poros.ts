import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";
import { copyLines, withCopies } from "../reprint.ts";
import { AUTHORED_EFFECTS as BLACK_SERPENT } from "./the-black-serpent.ts";

// Records for The Crossings of Poros (haradrim cycle part 9, no campaign card). Every line is read from the scan ledger (data/printed/haradrim.json). See docs/scenarios/haradrim/the-crossings-of-poros.md, Readings, for each reading.
// The piles set Poros Garrison and five encounter sets aside and put The Black Serpent in the staging area (the Setup sentences are theirs: 17157:A:1 has an empty record). A card of a set aside set is part of the encounter deck once it is revealed, placed in the
// discard pile or shuffled in (RandomSetAside, ShuffleSetAsideSet; hrd.multiple-encounter-sets); a set removed from the game has no card left set aside (RemoveEncounterSet `setAsideOnly`, hrd.removed-from-the-game).
// The quest branches: stage 1B and each stage 2B advance to a random stage (AdvanceToRandomStage with `stageSet`); a stage 2A removes the other; a stage 3A sets the other two aside, and stage 4A searches for the enemies of the sets of those two (SearchAsideStageSets).
// Rules: hrd.multiple-encounter-sets, hrd.removed-from-the-game, hrd.encounter-keyword, hrd.stage-number, rr.optional-engagement, rr.first-player, rr.forced, rr.printed, rr.cancel, rr.reveal
type Instruction = Effect["instructions"][number];
type Option = Extract<Instruction, { verb: "Choose" }>["options"][number];

const SETS = ["Mountains of Shadow", "Desert Sands", "Desert Creatures", "Harad Soldiers", "Mordor Orcs"];
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const PHASE_PLANNING: Condition = { kind: "phase", is: "Planning" };
const PHASE_COMBAT: Condition = { kind: "phase", is: "Combat" };
// The enemy RandomSetAside `pick` left as the last picked card is still set aside: the option that places it is offered only then.
const ASIDE_ENEMY_PICKED: Condition = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false };
const ANY_ENEMY: PickSpec = { type: "enemy", control: "any" };
const STAGED_ENEMIES: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
// "If this attack destroys a character": the attack's X is the characters it destroyed.
const DESTROYED_A_CHARACTER: Condition = { kind: "x", min: 1 };

// "Either place a random enemy from the set aside <set> set into the encounter discard pile, or <other>" (17147:A:1, 17148:A:1, 17149:A:1): the enemy is drawn first, and the option is offered only while one was left.
const placeOrElse = (set: string, who: "actor" | "firstPlayer", other: Option): Instruction[] => [
  { verb: "RandomSetAside", sets: [set], cardType: "enemy", to: "pick" },
  { verb: "Choose", who, options: [{ id: "place", requires: ASIDE_ENEMY_PICKED, instructions: [{ verb: "MoveEncounterCard", card: "picked", to: "discard" }] }, other] },
];

// "Shadow: Exhaust a character you control" (17147:A:2).
const EXHAUST_A_CHARACTER: Instruction[] = [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }];

// Each stage 3A: "Set each other stage 3A aside, out of play. Shuffle the encounter discard pile and the <set> encounter set into the encounter deck. Then, each player reveals an encounter card." (17160:A:1 to 17162:A:1)
const STAGE_THREES = ["17160", "17161", "17162"];
const stageThree = (code: string, set: string): Effect => ({
  id: `${code}:whenRevealed:1`,
  cardCode: code,
  lines: [`${code}:A:1`],
  timing: "whenRevealed",
  instructions: [
    { verb: "SetStagesAside", codes: STAGE_THREES.filter((other) => other !== code) },
    { verb: "ShuffleSetAsideSet", set },
    { verb: "ShuffleEncounterDiscard" },
    { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] },
  ],
});

// Each stage 2A: "Shuffle the <set> encounter set into the encounter deck. Remove the <other> encounter set and the other stage 2A from the game." (17158:A:1, 17159:A:1). Only the cards still set aside leave with the set.
const stageTwoA = (code: string, shuffled: string, removed: string, otherStage: string): Effect => ({
  id: `${code}:whenRevealed:1`,
  cardCode: code,
  lines: [`${code}:A:1`],
  timing: "whenRevealed",
  instructions: [{ verb: "ShuffleSetAsideSet", set: shuffled }, { verb: "ShuffleEncounterDeck" }, { verb: "RemoveEncounterSet", set: removed, setAsideOnly: true }, { verb: "RemoveStage", code: otherStage }],
});
// "Forced: When this stage is defeated, advance to a random stage 3." (17158:B:2, 17159:B:2)
const stageTwoB = (code: string): Effect => ({ id: `${code}:forced:2`, cardCode: code, lines: [`${code}:B:2`], timing: "forced", trigger: "questCardDefeated", subject: "self", instructions: [{ verb: "AdvanceToRandomStage", codes: STAGE_THREES, stageSet: true }] });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 17145 Poros Garrison. A:1: the first player controls it, and control passes with the first player token (Calphon's ControlledBy). A:3: the controller may engage one more enemy in the optional engagement step. A:2 and A:4 are the templates'.
    { id: "17145:constant:1", cardCode: "17145", lines: ["17145:A:1"], timing: "constant", instructions: [{ verb: "ControlledBy", who: "firstPlayer", card: "self" }] },
    { id: "17145:constant:2", cardCode: "17145", lines: ["17145:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "extraOptionalEngage", amount: 1, until: "whileSourceInPlay", target: "actorSeat" }] },

    // 17146 The Black Serpent: the printed text of 17094 (the same X, the same Forced choice).
    copyLines("17094", "17146", "A:1", "A:2", "A:3"),

    // 17147 Southron Outrider. Forced: after it engages you, either a random Harad Soldiers enemy goes to the encounter discard pile (while one is set aside), or it gets +3 Attack this round. Shadow: exhaust a character you control.
    {
      id: "17147:forced:1",
      cardCode: "17147",
      lines: ["17147:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: placeOrElse("Harad Soldiers", "actor", { id: "attack", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfRound", target: "self" }] }),
    },
    { id: "17147:shadow:1", cardCode: "17147", lines: ["17147:A:2"], timing: "shadow", instructions: EXHAUST_A_CHARACTER },

    // 17148 Uruk Prowler. When Revealed: the first player chooses to place a random Mordor Orcs enemy in the discard pile, or the Prowler attacks the first player from the staging area. Shadow: discard a random card from your hand.
    {
      id: "17148:whenRevealed:1",
      cardCode: "17148",
      lines: ["17148:A:1"],
      timing: "whenRevealed",
      instructions: placeOrElse("Mordor Orcs", "firstPlayer", { id: "attack", instructions: [{ verb: "AttackFromStaging", target: "self", who: "firstPlayer" }] }),
    },
    { id: "17148:shadow:1", cardCode: "17148", lines: ["17148:A:2"], timing: "shadow", instructions: [{ verb: "DiscardRandomFromHand" }] },

    // 17149 Desert Warg. When Revealed: the first player chooses to place a random Desert Creatures enemy in the discard pile, or the Warg gains surge. Shadow: the attacking enemy makes an additional attack against you after this one.
    {
      id: "17149:whenRevealed:1",
      cardCode: "17149",
      lines: ["17149:A:1"],
      timing: "whenRevealed",
      instructions: placeOrElse("Desert Creatures", "firstPlayer", { id: "surge", instructions: [{ verb: "GainSurge" }] }),
    },
    { id: "17149:shadow:1", cardCode: "17149", lines: ["17149:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true }] },

    // 17150 Desolate Land. A:1: X, its Threat, is the most characters one player controls. A:2: after it becomes the active location, a random card of the set aside set with the most cards left is revealed.
    {
      id: "17150:constant:1",
      cardCode: "17150",
      lines: ["17150:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: { mostPerPlayer: { type: "character", control: "you" } }, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "17150:forced:1", cardCode: "17150", lines: ["17150:A:2"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "RandomSetAside", sets: SETS, to: "reveal" }] },

    // 17151 Harondor Waste. Forced: after it becomes the active location, a random card of the set aside set with the most cards left goes to the encounter discard pile, then the discard pile is shuffled into the deck. (A:2, the Shadow, is the templates'.)
    {
      id: "17151:forced:1",
      cardCode: "17151",
      lines: ["17151:A:1"],
      timing: "forced",
      trigger: "becameActive",
      subject: "self",
      instructions: [{ verb: "RandomSetAside", sets: SETS, to: "discard" }, { verb: "ShuffleEncounterDiscard" }],
    },

    // 17152 Danger Close Behind. When Revealed: a random card of the set aside set with the most cards left is revealed. Shadow: if the attack destroys a character, resolve that effect (Doomed is not applied: the card is not revealed).
    { id: "17152:whenRevealed:1", cardCode: "17152", lines: ["17152:A:2"], timing: "whenRevealed", instructions: [{ verb: "RandomSetAside", sets: SETS, to: "reveal" }] },
    {
      id: "17152:shadow:1",
      cardCode: "17152",
      lines: ["17152:A:3"],
      timing: "shadow",
      instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RandomSetAside", sets: SETS, to: "reveal", when: DESTROYED_A_CHARACTER }] }],
    },

    // 17153 Foothills of Mordor. While in the staging area the When Revealed effects of every encounter card cannot be canceled. Forced: after it becomes the active location each player raises their threat by 2.
    { id: "17153:constant:1", cardCode: "17153", lines: ["17153:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "UncancelableWhenRevealed" }] },
    { id: "17153:forced:1", cardCode: "17153", lines: ["17153:A:2"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },

    // 17154 Shadowy Vale. +3 Threat while any player has a threat of 35 or higher (the count of such players, at most 1, times 3). Forced: after it becomes the active location, reveal the top card of the encounter deck.
    {
      id: "17154:constant:1",
      cardCode: "17154",
      lines: ["17154:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: { playersAtThreat: 35, times: 3, limit: 3 }, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "17154:forced:1", cardCode: "17154", lines: ["17154:A:2"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "RevealEncounter" }] },

    // 17155 Mountains of Shadow. When Revealed: each player raises their threat by the printed quest points of the active location; with no active location the card gains surge. (A:2, the Shadow, is the templates'.)
    {
      id: "17155:whenRevealed:1",
      cardCode: "17155",
      lines: ["17155:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "RaiseThreat", amount: { stat: "questPoints", of: "activeLocation", printed: true }, who: "eachSeat" },
        { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: { type: "location", control: "any", active: true } } } },
      ],
    },

    // 17156 Find a Way Down (encounter side quest). While it is in the staging area no player's threat can be reduced; once defeated it no longer is, and each player reduces their threat by 3. (Surge is the keyword's.)
    { id: "17156:constant:1", cardCode: "17156", lines: ["17156:A:2"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "threatReductionBarred", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
    { id: "17156:response:1", cardCode: "17156", lines: ["17156:A:3"], timing: "response", trigger: "questDefeated", instructions: [{ verb: "LowerThreat", amount: 3, who: "eachSeat" }] },

    // 17157 Flight to Gondor (stage 1). Setup: the piles do it. Side B: allies enter play exhausted; at the end of the planning phase the quest advances to a random stage 2.
    { id: "17157:setup:1", cardCode: "17157", lines: ["17157:A:1"], timing: "setup", instructions: [] },
    { id: "17157:constant:1", cardCode: "17157", lines: ["17157:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "alliesEnterExhausted", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    {
      id: "17157:forced:1",
      cardCode: "17157",
      lines: ["17157:B:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: PHASE_PLANNING,
      instructions: [{ verb: "AdvanceToRandomStage", codes: ["17158", "17159"], stageSet: true }],
    },

    // 17158 The Desert Path (stage 2). Desert Sands joins the deck, Mountains of Shadow and the other stage 2A are removed. Side B: a player who plays an ally exhausts it or deals 1 damage to it; when defeated, a random stage 3.
    stageTwoA("17158", "Desert Sands", "Mountains of Shadow", "17159"),
    {
      id: "17158:forced:1",
      cardCode: "17158",
      lines: ["17158:B:1"],
      timing: "forced",
      trigger: "played",
      subject: { type: "card", control: "any", cardType: "ally" },
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "exhaust", instructions: [{ verb: "Exhaust", target: { kind: "ref", ref: "subject" } }] }, { id: "damage", instructions: [{ verb: "DamageCard", amount: 1, target: "subject" }] }] }],
    },
    stageTwoB("17158"),

    // 17159 The Ephel Dúath (stage 2). Mountains of Shadow joins the deck, Desert Sands and the other stage 2A are removed. Side B: a player who plays an ally exhausts it or raises their threat by 1; when defeated, a random stage 3.
    stageTwoA("17159", "Mountains of Shadow", "Desert Sands", "17158"),
    {
      id: "17159:forced:1",
      cardCode: "17159",
      lines: ["17159:B:1"],
      timing: "forced",
      trigger: "played",
      subject: { type: "card", control: "any", cardType: "ally" },
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "exhaust", instructions: [{ verb: "Exhaust", target: { kind: "ref", ref: "subject" } }] }, { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 1, who: "actor" }] }] }],
    },
    stageTwoB("17159"),

    // 17160 Deadly Creatures (stage 3). Side B: enemies in the staging area cannot take damage; after an enemy engages a player that player chooses a hero they control, which takes 1 damage.
    stageThree("17160", "Desert Creatures"),
    { id: "17160:constant:1", cardCode: "17160", lines: ["17160:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: STAGED_ENEMIES }] },
    {
      id: "17160:forced:1",
      cardCode: "17160",
      lines: ["17160:B:2"],
      timing: "forced",
      trigger: "engaged",
      subject: ANY_ENEMY,
      instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "DamageCard", amount: 1, target: "picked" }],
    },

    // 17161 Southron Pursuit (stage 3). Side B: each enemy in the staging area gets -10 engagement cost; after an enemy engages a player, 1 progress is removed from this stage.
    stageThree("17161", "Harad Soldiers"),
    { id: "17161:constant:1", cardCode: "17161", lines: ["17161:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "whileSourceInPlay", holders: STAGED_ENEMIES }] },
    { id: "17161:forced:1", cardCode: "17161", lines: ["17161:B:2"], timing: "forced", trigger: "engaged", subject: ANY_ENEMY, instructions: [{ verb: "RemoveProgressFromQuest", amount: 1 }] },

    // 17162 Orc Patrols (stage 3). Side B: +2 quest points for each enemy in the staging area; after an enemy engages a player that player raises their threat by 1. (The scan's "Mordor Uruks" is the set the ledger calls Mordor Orcs.)
    stageThree("17162", "Mordor Orcs"),
    {
      id: "17162:constant:1",
      cardCode: "17162",
      lines: ["17162:B:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { count: STAGED_ENEMIES, times: 2 }, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "17162:forced:1", cardCode: "17162", lines: ["17162:B:2"], timing: "forced", trigger: "engaged", subject: ANY_ENEMY, instructions: [{ verb: "RaiseThreat", amount: 1, who: "eventSeat" }] },

    // 17163 Battle at the Crossings (stage 4). When Revealed: the first player takes control of Poros Garrison and the enemies of the sets of the two set aside stages 3 join the staging area from the deck and discard pile, then the deck is shuffled.
    // Side B: after an enemy attacks and destroys a character, remove progress equal to its printed Threat; the stage is defeated only at the end of the combat phase (its progress stays until then) and defeating it wins the game.
    {
      id: "17163:whenRevealed:1",
      cardCode: "17163",
      lines: ["17163:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ActAs", who: "firstPlayer" },
        { verb: "TakeObjectiveAlly", codes: ["17145"] },
        { verb: "SearchAsideStageSets", stages: [{ code: "17160", set: "Desert Creatures" }, { code: "17161", set: "Harad Soldiers" }, { code: "17162", set: "Mordor Orcs" }] },
        { verb: "ShuffleEncounterDeck" },
      ],
    },
    {
      id: "17163:forced:1",
      cardCode: "17163",
      lines: ["17163:B:1"],
      timing: "forced",
      trigger: "characterDestroyedByAttack",
      subject: { type: "character", control: "any" },
      condition: { kind: "matches", card: "other", pick: ANY_ENEMY },
      instructions: [{ verb: "RemoveProgressFromQuest", amount: { stat: "threat", of: "other", printed: true } }],
    },
    { id: "17163:constant:1", cardCode: "17163", lines: ["17163:B:2"], timing: "constant", condition: { kind: "flag", stat: "combatPhaseEnding", holder: "table", is: false }, instructions: [{ verb: "Restrict", what: "advance" }] },
    {
      id: "17163:forced:2",
      cardCode: "17163",
      lines: ["17163:B:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: PHASE_COMBAT,
      instructions: [{ verb: "ModifyStat", stat: "combatPhaseEnding", amount: 1, until: "endOfPhase", target: "table" }],
    },
  ],
  { pool: BLACK_SERPENT },
);

export const AUTHORED_REPLACES: readonly string[] = [];
