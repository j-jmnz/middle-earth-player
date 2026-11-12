import type { Copy } from "../../reprint.ts";
import type { Effect } from "../../../../catalog/boundary.ts";

import { EACH_PLAYER, PICKED_ENEMY_OUT_OF_PLAY } from "../black-gate/shared.ts";
import { A_PLAYER_FAILED_THIS_ROUND, EACH_PLAYER_TESTS, IN_STAGING, LAST_FORTITUDE_FAILED } from "./shared.ts";

// Records for the locations of Mount Doom (146042 to 146048; Mount Doom itself, its Immune an override of the data). Every line is read from the scan ledger (data/printed/the-return-of-the-king.json). See docs/brief.md, The Return of the King, for each reading.
// Rules: mec113.fortitude-tests, mec113.player-actions-during-fortitude-tests, mec113.dire, rr.step-7-3, rr.active-location, rr.travel, rr.first-player, rr.in-player-order (data/rules/entries.json).
export const LOCATION_RECORDS: readonly (Effect | Copy)[] = [
  // 146042 The Tower of Barad-dûr (an objective). While it is in the staging area no player raises his threat in the refresh phase (step 7.3). Forced: at the end of the round each player raises his threat by 1 for each non-Fellowship character he controls (heroes and allies; the Ring-bearer is a Fellowship hero).
  { id: "146042:constant:1", cardCode: "146042", lines: ["146042:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noRefreshThreat", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "146042:forced:1",
    cardCode: "146042",
    lines: ["146042:A:2"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [EACH_PLAYER([{ verb: "RaiseThreat", amount: { count: { type: "character", control: "you", exceptSphere: "fellowship" } }, who: "actor" }])],
  },

  // 146043 Mount Doom (Immune is a keyword). Its Threat is the tens digit of the first player's threat dial, read live. The players cannot travel here unless stage 3B holds at least 20 progress (two restrictions: not on stage 3, and fewer than 20 progress).
  // Travel: each player, in player order, makes a Fortitude test, and raises his own threat by 9 if he fails it.
  { id: "146043:constant:1", cardCode: "146043", lines: ["146043:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { firstPlayerTens: true }, until: "whileSourceInPlay", target: "self" }] },
  { id: "146043:constant:2", cardCode: "146043", lines: ["146043:A:2"], timing: "constant", condition: { kind: "not", condition: { kind: "onStage", stage: 3 } }, instructions: [{ verb: "Restrict", what: "travel" }] },
  { id: "146043:constant:3", cardCode: "146043", lines: ["146043:A:2"], timing: "constant", condition: { kind: "not", condition: { kind: "stageProgress", min: 20 } }, instructions: [{ verb: "Restrict", what: "travel" }] },
  { id: "146043:travel:1", cardCode: "146043", lines: ["146043:A:3"], timing: "travel", instructions: [EACH_PLAYER_TESTS([{ verb: "RaiseThreat", amount: 9, who: "actor", when: LAST_FORTITUDE_FAILED }])] },

  // 146044 Orc-hold. While it is in the staging area no progress can be placed on the other locations there (it takes progress itself). Forced: after it becomes the active location the encounter discard pile is shuffled into the deck, cards are discarded from the top until an Orc enemy is discarded,
  // and that enemy comes into play engaged with the first player (not revealed; with no Orc in the deck nothing is engaged).
  { id: "146044:constant:1", cardCode: "146044", lines: ["146044:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true, other: true } }] },
  {
    id: "146044:forced:1",
    cardCode: "146044",
    lines: ["146044:A:2"],
    timing: "forced",
    trigger: "becameActive",
    subject: "self",
    instructions: [
      { verb: "ShuffleEncounterDiscard" },
      { verb: "DiscardUntil", type: "enemy", trait: "Orc" },
      EACH_PLAYER([{ verb: "MoveEncounterCard", card: "picked", to: "engaged", when: { kind: "all", conditions: [PICKED_ENEMY_OUT_OF_PLAY, { kind: "firstPlayer" }] } }]),
    ],
  },

  // 146045 Mordor Road. +1 Threat for each ally controlled by the player who controls the most allies, read live. Forced: after it becomes the active location each player, in player order, discards the top card of the encounter deck and each enemy so discarded is added to the staging area (not revealed).
  { id: "146045:constant:1", cardCode: "146045", lines: ["146045:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { mostPerPlayer: { type: "ally", control: "you" } }, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "146045:forced:1",
    cardCode: "146045",
    lines: ["146045:A:2"],
    timing: "forced",
    trigger: "becameActive",
    subject: "self",
    instructions: [EACH_PLAYER([{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false } }])],
  },

  // 146046 Plain of Gorgoroth. +2 Threat while any player has failed a Fortitude test this round, read live. Travel: the first player makes a Fortitude test; if he fails it each player raises his threat by 4 (the travel is made either way).
  { id: "146046:constant:1", cardCode: "146046", lines: ["146046:A:1"], timing: "constant", condition: A_PLAYER_FAILED_THIS_ROUND, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "self" }] },
  { id: "146046:travel:1", cardCode: "146046", lines: ["146046:A:2"], timing: "travel", instructions: [{ verb: "FortitudeTest", who: "firstPlayer" }, { verb: "RaiseThreat", amount: 4, who: "eachSeat", when: LAST_FORTITUDE_FAILED }] },

  // 146047 Brake of Thorns. While it is in the staging area each Fortitude test counts one more Sauron's Eye icon (once for the test, not for each card). Forced: after it becomes the active location (at Setup, stage 1A makes it active) each player assigns X damage among the characters he controls, X the tens digit of his own threat.
  { id: "146047:constant:1", cardCode: "146047", lines: ["146047:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "fortitudeEyes", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "146047:forced:1", cardCode: "146047", lines: ["146047:A:2"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "AssignDamage", amount: { threat: "tens" }, pick: { type: "character", control: "you" }, who: "eachSeat" }] },

  // 146048 Old Water-course. While it is the active location it gains the Response "When Old Water-course is explored, each player's threat is reduced by 5" (an encounter card's effect: Dire's cap on threat reduction counts player card effects only). Travel: each player must exhaust a hero he controls
  // (a player with no ready hero cannot pay, so the players cannot travel here).
  { id: "146048:response:1", cardCode: "146048", lines: ["146048:A:1"], timing: "response", trigger: "activeExplored", subject: "self", instructions: [{ verb: "LowerThreat", amount: 5, who: "eachSeat" }] },
  { id: "146048:travel:1", cardCode: "146048", lines: ["146048:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "hero", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }])] },
];
