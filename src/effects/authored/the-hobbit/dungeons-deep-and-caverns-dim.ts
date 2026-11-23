import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as STONE } from "../standalone-scenarios/the-stone-of-erech.ts";
import { AUTHORED_EFFECTS as HOBBIT } from "./the-hobbit.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for Dungeons Deep and Caverns Dim (The Hobbit, part 3, no campaign card): the riddle area and the two quest stages beside each other, the riddles encounter cards print and the first player answers, and Gollum's attack on Bilbo Baggins. The Misty Mountain Goblins set is the
// records of the scenario that owns it (set-misty-mountain-goblins.ts). The families' engine is src/rules/families/riddles/; the readings are in docs/scenarios/the-hobbit.md (Dungeons Deep and Caverns Dim).
// A riddle (hob.riddles) is a constant record with the marker `Riddle` (what the first player names, how many cards come off his deck), read by AnswerRiddle. A card revealed from the encounter deck that offers the choice has a second record: the When Revealed Choose between answering and resolving the card.
// Rules: hob.riddle-area, hob.riddles, hob.riddles-steps-2-and-3, hob.setup-dungeons-deep-and-caverns-dim, rr.forced, rr.cannot, rr.immune, mec109.immune-to-player-card-effects, rr.cancel, rr.travel, rr.damage, rr.first-player, rr.action, rr.encounter-deck, rr.staging (data/rules/entries.json).
const NOT_COMPLETE: Condition = { kind: "not", condition: { kind: "riddle", is: "complete" } };
const OFFERED: Condition = { kind: "riddle", is: "offered" };
const SHADOW_RIDDLE: Condition = { kind: "riddle", is: "shadow" };
const BILBO = "Bilbo Baggins";
/** Every card of the riddle area (stage 2, Gollum, Bilbo Baggins and the Ring on him). */
const AREA: PickSpec = { type: "card", control: "any", riddleArea: true };
/** Bilbo Baggins while he is in the riddle area. */
const AREA_BILBO: PickSpec = { type: "card", control: "any", riddleArea: true, cardType: "hero" };

const ANSWER_OR_RESOLVE: Instruction = {
  verb: "Choose",
  who: "firstPlayer",
  options: [
    { id: "answer", instructions: [{ verb: "AnswerRiddle" }] },
    { id: "resolve", instructions: [{ verb: "ResolveNormally" }] },
  ],
};

/** The offer a revealed riddle card makes: a When Revealed record that only holds while the card is revealed from the encounter deck (hob.riddles). */
const offer = (id: string, code: string, line: string): Effect => ({ id, cardCode: code, lines: [line], timing: "whenRevealed", condition: OFFERED, instructions: [ANSWER_OR_RESOLVE] });

const riddle = (code: string, line: string, names: readonly ("type" | "sphere" | "cost")[], discard: number): Effect => ({
  id: `${code}:constant:1`,
  cardCode: code,
  lines: [line],
  timing: "constant",
  instructions: [{ verb: "Riddle", names: [...names], discard }],
});

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 131029 Out of the Frying Pan (stage 1). Setup: Lake in the Cavern is staged by the scenario's piles; the riddle area is created with stage 2A, whose own Setup follows (131030:A:1).
    { id: "131029:setup:1", cardCode: "131029", lines: ["131029:A:1"], timing: "setup", instructions: [{ verb: "CreateRiddleArea", stage: "131030" }] },
    // Both 1B and 2B must be complete to advance: progress above the quest points stays on a stage that cannot advance (faq.progress-without-advancing), and the quest advances as soon as the second is complete (rr.quest-advancement).
    { id: "131029:constant:1", cardCode: "131029", lines: ["131029:B:1"], timing: "constant", condition: NOT_COMPLETE, instructions: [{ verb: "Restrict", what: "advance" }] },
    // The staging step reveals 1 more encounter card per player (rr.staging): each is revealed with its riddle choice.
    { id: "131029:forced:1", cardCode: "131029", lines: ["131029:B:2"], timing: "forced", trigger: "stagingStepBegins", instructions: [{ verb: "RevealMore", amount: 1, perPlayer: true }] },

    // 131030 Riddles in the Dark (stage 2, in the riddle area). Setup: Gollum and the Ring are found in the encounter deck; Gollum lies in the area, the Ring is attached to Bilbo Baggins, the deck is shuffled.
    {
      id: "131030:setup:1",
      cardCode: "131030",
      lines: ["131030:A:1"],
      timing: "setup",
      instructions: [{ verb: "PlaceInRiddleArea", code: "131074" }, { verb: "PlaceInRiddleArea", code: "131079", attachTo: BILBO }, { verb: "ShuffleEncounterDeck" }],
    },
    copyLine("131029:B:1", "131030:B:1"),
    // Progress goes on this stage only by answering a riddle (AnswerRiddle) and comes off only by Not Fair! Not Fair!: no card effect places or removes it (the current quest is stage 1).
    { id: "131030:constant:2", cardCode: "131030", lines: ["131030:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noEffectProgress", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    // The riddle area: its cards are immune to player card effects, and Bilbo Baggins (the first player still controls him) cannot quest, attack or take attachments played by the players; he defends only against Gollum (families/riddles/gollum.ts).
    {
      id: "131030:constant:3",
      cardCode: "131030",
      lines: ["131030:B:3"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: AREA },
        { verb: "ModifyStat", stat: "cannotQuest", amount: 1, until: "whileSourceInPlay", holders: AREA_BILBO },
        { verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay", holders: AREA_BILBO },
        { verb: "ModifyStat", stat: "noPlayerAttachments", amount: 1, until: "whileSourceInPlay", holders: AREA_BILBO },
      ],
    },

    // 131031 Into the Fire (stage 3). The first player has Bilbo Baggins (his own constant), stage 2 leaves the game, 1 encounter card per player is revealed; Gollum engages the first player and follows the token.
    {
      id: "131031:whenRevealed:1",
      cardCode: "131031",
      lines: ["131031:B:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "LeaveRiddleArea" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }],
    },
    { id: "131031:whenRevealed:2", cardCode: "131031", lines: ["131031:B:2"], timing: "whenRevealed", instructions: [{ verb: "GollumEngagesFirstPlayer" }] },
    { id: "131031:triggered:1", cardCode: "131031", lines: ["131031:B:2"], timing: "triggered", trigger: "firstPlayerTokenPassed", instructions: [{ verb: "GollumEngagesFirstPlayer" }] },
    { id: "131031:constant:1", cardCode: "131031", lines: ["131031:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "gollumDamageToBilbo", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "131031:constant:2", cardCode: "131031", lines: ["131031:B:3"], timing: "constant", instructions: [{ verb: "IgnoreRiddles" }, { verb: "TreacheriesGainSurge" }] },
    { id: "131031:constant:3", cardCode: "131031", lines: ["131031:B:4"], timing: "constant", instructions: [] },

    // 131074 Gollum. Forced: after the first player answers a riddle and finds no match, he attacks Bilbo Baggins from the riddle area (no shadow card).
    { id: "131074:forced:1", cardCode: "131074", lines: ["131074:A:1"], timing: "forced", trigger: "riddleFailed", instructions: [{ verb: "GollumAttacksBilbo" }] },

    // 131075 Great Gray Wolf. Forced: dealt a shadow card with a riddle, every Creature enemy returns to the staging area at the end of the combat phase, itself included (a delayed effect).
    {
      id: "131075:forced:1",
      cardCode: "131075",
      lines: ["131075:A:1"],
      timing: "forced",
      trigger: "shadowDealtTo",
      subject: "self",
      condition: SHADOW_RIDDLE,
      instructions: [{ verb: "Delay", until: "endOfPhase", instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", trait: "Creature", who: "each", pick: "all" } }] }],
    },
    riddle("131075", "131075:A:2", ["type", "sphere", "cost"], 3),
    offer("131075:whenRevealed:1", "131075", "131075:A:2"),

    // 131076 Wild Wargs. Forced: dealt a shadow card with a riddle, +2 Attack for that attack.
    {
      id: "131076:forced:1",
      cardCode: "131076",
      lines: ["131076:A:1"],
      timing: "forced",
      trigger: "shadowDealtTo",
      subject: "self",
      condition: SHADOW_RIDDLE,
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "self" }],
    },
    riddle("131076", "131076:A:2", ["type"], 2),
    offer("131076:whenRevealed:1", "131076", "131076:A:2"),

    // 131077 The Wargs' Glade. Forced: after a character takes damage from an attack by a Creature enemy, 1 progress comes off the current quest (stage 1; stage 2 takes no removal from it).
    {
      id: "131077:forced:1",
      cardCode: "131077",
      lines: ["131077:A:1"],
      timing: "forced",
      trigger: "damagedByAttack",
      subject: { type: "character", control: "any" },
      condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Creature" } },
      instructions: [{ verb: "RemoveProgressFromQuest", amount: 1 }],
    },
    riddle("131077", "131077:A:2", ["sphere"], 1),
    offer("131077:whenRevealed:1", "131077", "131077:A:2"),

    // 131078 Lake in the Cavern. X (its Threat) is twice the number of players; the players cannot travel here; Forced: after stage 3 is revealed, remove it from the game.
    copyLine("50306:A:1", "131078:A:1"),
    { id: "131078:constant:2", cardCode: "131078", lines: ["131078:A:2"], timing: "constant", instructions: [{ verb: "Restrict", what: "travel" }] },
    {
      id: "131078:forced:1",
      cardCode: "131078",
      lines: ["131078:A:4"],
      timing: "forced",
      trigger: "afterStageRevealed",
      condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", names: ["Into the Fire"] } },
      instructions: [{ verb: "RemoveSourceFromGame" }],
    },

    // 131079 Bilbo's Magic Ring (an objective on Bilbo Baggins). A:2 is used while answering a riddle (RiddleStep `ring`, families/riddles/answer.ts), which asks the first player after the top cards come off: Bilbo spends 1 Baggins resource and 1 more card is discarded. No other window offers it.
    copyLine("132019:A:1", "131079:A:1"),
    {
      id: "131079:action:1",
      cardCode: "131079",
      lines: ["131079:A:2"],
      timing: "action",
      condition: { kind: "riddle", is: "answering" },
      cost: { kind: "resources", amount: 1, sphere: "baggins", from: "host" },
      instructions: [{ verb: "DiscardFromDeck", amount: 1 }],
    },
    {
      id: "131079:action:2",
      cardCode: "131079",
      lines: ["131079:A:3"],
      timing: "action",
      cost: { kind: "exhaustSelf" },
      instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }, { verb: "AddResources", amount: 1, to: "host" }],
    },

    // 131080 Come Down Little Bird. Each player in turn (the first player first) searches for a Creature enemy and puts it into play engaged with him; the encounter deck is shuffled.
    {
      id: "131080:whenRevealed:1",
      cardCode: "131080",
      lines: ["131080:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", trait: "Creature", type: "enemy", to: "engaged" }] }, { verb: "ShuffleEncounterDeck" }],
    },
    riddle("131080", "131080:A:2", ["type", "cost"], 3),
    offer("131080:whenRevealed:2", "131080", "131080:A:2"),

    // 131081 It Likes Riddles? The first player must answer the riddle on this card. With at least 1 match, encounter cards are discarded until another card with a riddle is discarded, and he answers that riddle too (no match, no second riddle).
    {
      id: "131081:whenRevealed:1",
      cardCode: "131081",
      lines: ["131081:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "AnswerRiddle" }, { verb: "DiscardUntilRiddle", when: { kind: "x", min: 1 } }, { verb: "AnswerRiddle", card: "picked", when: { kind: "x", min: 1 } }],
    },
    riddle("131081", "131081:A:2", ["cost"], 2),

    // 131082 Hiding in the Trees. Characters get -1 Willpower and cannot attack until the end of the round.
    {
      id: "131082:whenRevealed:1",
      cardCode: "131082",
      lines: ["131082:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfRound", target: "characters" },
        { verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "endOfRound", target: "characters" },
      ],
    },
    riddle("131082", "131082:A:2", ["type", "sphere"], 3),
    offer("131082:whenRevealed:2", "131082", "131082:A:2"),

    // 131083 What's In My Pocket? The first player must answer the riddle on this card, and no card cancels that.
    { id: "131083:whenRevealed:1", cardCode: "131083", lines: ["131083:A:1"], timing: "whenRevealed", uncancelable: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "AnswerRiddle" }] },
    riddle("131083", "131083:A:2", ["sphere", "cost"], 2),

    // 131084 Not Fair! Not Fair! The first player names a card type and the top 3 cards of the encounter deck are discarded; each that is not of that type takes 1 progress off stage 2. No card cancels it.
    {
      id: "131084:whenRevealed:1",
      cardCode: "131084",
      lines: ["131084:A:1"],
      timing: "whenRevealed",
      uncancelable: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "NameEncounterType", types: ["enemy", "location", "treachery", "objective"] }, { verb: "DiscardEncounterTop", count: 3 }, { verb: "RemoveRiddleProgress" }],
    },
  ],
  { pool: [...HOBBIT, ...STONE] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
