// Rules: hrd.multiple-encounter-sets, hrd.removed-from-the-game, hrd.stage-number, rr.forced, rr.shadow-effects, rr.cancel, rr.first-player, rr.optional-engagement, rr.then, rr.quest-advancement, rr.active-location, rr.engaged, rr.destroy (data/rules/entries.json); ledger lines of The Crossings of Poros (data/printed/haradrim.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, count, damageOn, deckCount, defend, endPhase, exhausted, flag, handCount, notWon, progressOn, quest, resolve, respond, reveal, stat, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Crossings of Poros (haradrim part 9): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28. Lines the scene tests of lines.test.ts own (the random set aside cards, the Setup reveals, the stage 3A and 4A searches) are not repeated here.
const STAGE_1 = "17157";
const STAGE_2 = "17158";
const STAGE_2_OTHER = "17159";
const SERPENT = "17146";
const CAPTAIN = "16041";
const SOLDIER = "16042";

const ROWS: readonly Row[] = [
  // 17146 The Black Serpent (the printed text of 17094; X is the stage number of the main quest, hrd.stage-number).
  { line: "17146:A:2", name: "X is the stage number of the main quest: at stage 2 it gets +2 Threat, +2 Attack and +2 Defense", layout: { stage: STAGE_2, staging: [SERPENT] }, act: [], expect: [stat(SERPENT, "threat", 2), stat(SERPENT, "attack", 4), stat(SERPENT, "defense", 3)] },
  { line: "17146:A:3", name: "Forced at the end of the encounter phase: the first player removes X progress from the main quest", layout: { phase: "Encounter", progress: 4, stage: STAGE_2, staging: [SERPENT, "f0"] }, act: [announce("endOfPhase"), answer("progress")], expect: progressOn(STAGE_2, 2) },
  { line: "17146:A:3", name: "Forced at the end of the encounter phase: or The Black Serpent attacks the first player from the staging area", layout: { phase: "Encounter", progress: 4, staging: [SERPENT, "f0"] }, act: [announce("endOfPhase"), answer("attack")], expect: [{ expect: "window", kind: "defense", value: true }, progressOn(STAGE_1, 4)] },

  // 17147 Southron Outrider. Shadow: exhaust a character you control.
  { line: "17147:A:2", name: "Shadow: the defending player exhausts a character he controls", layout: { engaged: ["f0"] }, act: attack("f0", { shadow: "17147", undefended: true }), expect: exhausted("dh1") },

  // 17148 Uruk Prowler.
  { line: "17148:A:1", name: "When Revealed: the first player may place a random enemy of the set aside Mordor Orcs set into the encounter discard pile", layout: { setAside: ["16061", "16060"], staging: ["17148"] }, act: [resolve("17148", "whenRevealed"), answer("place")], expect: [zone("16061", "encounterDiscard"), zone("17148", "staging")] },
  { line: "17148:A:1", name: "When Revealed: or Uruk Prowler makes an immediate attack against the first player", layout: { setAside: ["16061"], staging: ["17148"] }, act: [resolve("17148", "whenRevealed"), answer("attack")], expect: [zone("16061", "setAside"), { expect: "window", kind: "defense", value: true }] },
  { line: "17148:A:2", name: "Shadow: the defending player discards a random card from his hand", layout: { engaged: ["f0"], hand: ["f0", "f0"] }, act: attack("f0", { shadow: "17148", undefended: true }), expect: handCount(1) },

  // 17149 Desert Warg.
  { line: "17149:A:1", name: "When Revealed: the first player may place a random enemy of the set aside Desert Creatures set into the encounter discard pile", layout: { setAside: ["16054", "16053"], deck: ["f0"] }, act: [reveal("17149"), answer("place")], expect: [zone("16054", "encounterDiscard"), deckCount(1)] },
  { line: "17149:A:1", name: "When Revealed: or Desert Warg gains surge", layout: { setAside: ["16054"], deck: ["f0"] }, act: [reveal("17149"), answer("surge")], expect: [zone("16054", "setAside"), zone("f0", "staging")] },
  { line: "17149:A:2", name: "Shadow: the attacking enemy makes an additional attack against the defending player after this one", layout: { engaged: ["f0"] }, act: attack("f0", { shadow: "17149", undefended: true }), expect: damageOn("dh1", 2) },

  // 17150 Desolate Land. Two players: seat 0 controls a hero and two allies, seat 1 a hero and an ally.
  { line: "17150:A:1", name: "X is the highest number of characters one player controls: Threat 4 for the player with two heroes and two allies", layout: { seats: 2, staging: ["17150"], play: ["ally", "ally", { code: "ally", seat: 1 }] }, act: [], expect: stat("17150", "threat", 4) },

  // 17154 Shadowy Vale.
  { line: "17154:A:1", name: "While a player has a threat of 35 or higher it gets +3 Threat", layout: { seats: 2, staging: ["17154"], threat: [28, 35] }, act: [], expect: stat("17154", "threat", 5) },
  { line: "17154:A:2", name: "Forced: after it becomes the active location the top card of the encounter deck is revealed", layout: { active: "17154", deck: ["f0", "f1"] }, act: announce("becameActive", "17154"), expect: [zone("f0", "staging"), deckCount(1)] },

  // 17152 Danger Close Behind. Shadow: if this attack destroys a character, a random card of the set aside set with the most cards is revealed (the Captain has 5 Attack, the ally 1 Defense and 2 hit points).
  { line: "17152:A:3", name: "Shadow: when the attack destroys a character a card of the set aside set with the most cards is revealed", layout: { engaged: [CAPTAIN], play: ["ally"], setAside: ["16054"] }, act: [attack(CAPTAIN, { shadow: "17152" }), defend("ally")], expect: [count("ally", "discard", 1), zone("16054", "staging")] },

  // 17153 Foothills of Mordor.
  { line: "17153:A:2", name: "Forced: after it becomes the active location each player raises his threat by 2", layout: { seats: 2, active: "17153" }, act: announce("becameActive", "17153"), expect: [threat(30), threat(30, 1)] },

  // 17155 Mountains of Shadow.
  { line: "17155:A:1", name: "When Revealed: each player raises his threat by the printed quest points of the active location", layout: { seats: 2, active: "17151", staging: ["17155"] }, act: resolve("17155", "whenRevealed"), expect: [threat(31), threat(31, 1)] },
  { line: "17155:A:1", name: "When Revealed: with no active location it gains surge and raises no threat", layout: { deck: ["f0"] }, act: reveal("17155"), expect: [threat(28), zone("f0", "staging")] },

  // 17156 Find a Way Down.
  { line: "17156:A:3", name: "Response: when it is defeated each player reduces his threat by 3", layout: { seats: 2, threat: [35, 35], staging: [{ code: "17156", progress: 6 }] }, act: [announce("questDefeated", "17156"), respond("17156")], expect: [threat(32), threat(32, 1)] },

  // 17157 Flight to Gondor.
  { line: "17157:B:2", name: "Forced: at the end of the planning phase the quest advances to a random stage 2 (seed 4: 17158)", layout: { stage: STAGE_1, phase: "Planning", seed: 4 }, act: endPhase, expect: [zone(STAGE_1, "setAside"), zone("17158", "questStage")] },
  { line: "17157:B:2", name: "Forced: at the end of the planning phase the quest advances to a random stage 2 (seed 1: 17159)", layout: { stage: STAGE_1, phase: "Planning", seed: 1 }, act: endPhase, expect: [zone(STAGE_1, "setAside"), zone("17159", "questStage")] },

  // 17158 The Desert Path.
  { line: "17158:A:1", name: "When Revealed: Desert Sands joins the deck, the Mountains of Shadow cards set aside and the other stage 2A are removed from the game", layout: { stage: STAGE_2, side: "A", setAside: ["16049", "17153"], deck: ["f0"] }, act: resolve(STAGE_2, "whenRevealed"), expect: [zone("16049", "encounterDeck"), zone("17153", "removed"), zone(STAGE_2_OTHER, "setAside")] },
  { line: "17158:B:1", name: "Forced: after a player plays an ally he exhausts that ally", layout: { stage: STAGE_2, play: ["ally"] }, act: [announce("played", "ally"), answer("exhaust")], expect: [exhausted("ally"), damageOn("ally", 0)] },
  { line: "17158:B:1", name: "Forced: or deals 1 damage to it", layout: { stage: STAGE_2, play: ["ally"] }, act: [announce("played", "ally"), answer("damage")], expect: [exhausted("ally", false), damageOn("ally", 1)] },
  { line: "17158:B:2", name: "Forced: when this stage is defeated the quest advances to a random stage 3 (seed 1: 17161)", layout: { stage: "17158", progress: 10, seed: 1 }, act: announce("questCardDefeated", "17158"), expect: [zone("17158", "setAside"), zone("17161", "questStage")] },
  { line: "17158:B:2", name: "Forced: when this stage is defeated the quest advances to a random stage 3 (seed 2: 17162)", layout: { stage: "17158", progress: 10, seed: 2 }, act: announce("questCardDefeated", "17158"), expect: [zone("17158", "setAside"), zone("17162", "questStage")] },

  // 17159 The Ephel Dúath.
  { line: "17159:A:1", name: "When Revealed: Mountains of Shadow joins the deck, the Desert Sands cards set aside and the other stage 2A are removed from the game", layout: { stage: STAGE_2_OTHER, side: "A", setAside: ["16049", "17153"], deck: ["f0"] }, act: resolve(STAGE_2_OTHER, "whenRevealed"), expect: [zone("17153", "encounterDeck"), zone("16049", "removed"), zone(STAGE_2, "setAside")] },
  { line: "17159:B:1", name: "Forced: after a player plays an ally he exhausts that ally", layout: { stage: STAGE_2_OTHER, play: ["ally"] }, act: [announce("played", "ally"), answer("exhaust")], expect: [exhausted("ally"), threat(28)] },
  { line: "17159:B:1", name: "Forced: or raises his threat by 1", layout: { stage: STAGE_2_OTHER, play: ["ally"] }, act: [announce("played", "ally"), answer("threat")], expect: [exhausted("ally", false), threat(29)] },
  { line: "17159:B:2", name: "Forced: when this stage is defeated the quest advances to a random stage 3 (seed 1: 17161)", layout: { stage: "17159", progress: 10, seed: 1 }, act: announce("questCardDefeated", "17159"), expect: [zone("17159", "setAside"), zone("17161", "questStage")] },
  { line: "17159:B:2", name: "Forced: when this stage is defeated the quest advances to a random stage 3 (seed 2: 17162)", layout: { stage: "17159", progress: 10, seed: 2 }, act: announce("questCardDefeated", "17159"), expect: [zone("17159", "setAside"), zone("17162", "questStage")] },

  // 17160 Deadly Creatures.
  { line: "17160:B:1", name: "Enemies in the staging area cannot take damage", layout: { stage: "17160", staging: [CAPTAIN] }, act: [], expect: flag(CAPTAIN, "cannotTakeDamage") },
  { line: "17160:B:2", name: "Forced: after an enemy engages a player 1 damage is dealt to a hero that player controls", layout: { stage: "17160", engaged: [CAPTAIN] }, act: announce("engaged", CAPTAIN, { seat: 0 }), expect: damageOn("dh1", 1) },

  // 17161 Southron Pursuit.
  { line: "17161:A:1", name: "When Revealed: the other stages 3A are set aside, the discard pile and Harad Soldiers are shuffled in and each player reveals a card", layout: { stage: "17161", side: "A", setAside: [CAPTAIN], discard: [SOLDIER] }, act: resolve("17161", "whenRevealed"), expect: [zone("17160", "setAside"), zone("17162", "setAside"), count(SOLDIER, "encounterDiscard", 0), deckCount(1)] },
  { line: "17161:B:1", name: "Each enemy in the staging area gets -10 engagement cost", layout: { stage: "17161", staging: [CAPTAIN] }, act: [], expect: stat(CAPTAIN, "engagementCost", 30) },
  { line: "17161:B:2", name: "Forced: after an enemy engages a player 1 progress is removed from this stage", layout: { stage: "17161", progress: 5, engaged: [CAPTAIN] }, act: announce("engaged", CAPTAIN, { seat: 0 }), expect: progressOn("17161", 4) },

  // 17162 Orc Patrols.
  { line: "17162:A:1", name: "When Revealed: the other stages 3A are set aside, the discard pile and Mordor Orcs are shuffled in and each player reveals a card", layout: { stage: "17162", side: "A", setAside: ["16061"], discard: ["16062"] }, act: resolve("17162", "whenRevealed"), expect: [zone("17160", "setAside"), zone("17161", "setAside"), count("16062", "encounterDiscard", 0), deckCount(1)] },
  { line: "17162:B:1", name: "It gets +2 quest points for each enemy in the staging area", layout: { stage: "17162", staging: [CAPTAIN, SOLDIER] }, act: [], expect: stat("17162", "questPoints", 19) },
  { line: "17162:B:2", name: "Forced: after an enemy engages a player that player raises his threat by 1", layout: { stage: "17162", engaged: [CAPTAIN] }, act: announce("engaged", CAPTAIN, { seat: 0 }), expect: threat(29) },

  // 17163 Battle at the Crossings. The Captain has 2 Threat and 5 Attack; the ally has 1 Defense and 2 hit points.
  { line: "17163:B:1", name: "Forced: after an enemy attacks and destroys a character X progress is removed from this stage, X the enemy's printed Threat", layout: { stage: "17163", progress: 10, engaged: [CAPTAIN], play: ["ally"] }, act: [attack(CAPTAIN), defend("ally")], expect: [count("ally", "discard", 1), progressOn("17163", 8)] },
  { line: "17163:B:2", name: "The stage keeps its progress and is not defeated when its quest points are reached in the quest phase", layout: { stage: "17163", progress: 19, phase: "Quest" }, act: quest("success"), expect: [notWon, progressOn("17163", 23)] },
];

if (ROWS.length > 0) cardSpecs("the-crossings-of-poros", ROWS);
else describe("the-crossings-of-poros card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
