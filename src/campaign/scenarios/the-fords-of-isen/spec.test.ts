// Rules: rr.forced, rr.drawing-cards, rr.constant-ability, rr.travel, rr.shadow-effects, rr.attachment-cards, rm.time-x, rr.quest-advancement, rr.search (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, attack, cardSpecs, count, damageOn, defend, drew, handCount, notWon, offers, quest, resourcesOn, reveal, resolve, stat, flag, threat, window, zone, type Row } from "../../../../test/harness/card-spec.ts";
import type { Dealt } from "../../../../test/harness/layout.ts";

// Card specs for The Fords of Isen (the-ring-maker part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// What a row cannot express is a test titled with its line id in lines.test.ts (the draw triggers over several players, Gríma's controller, Down from the Hills and Pillaging and Burning over a round), and the engine moments
// of the family are in src/rules/families/ring-maker/index.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28; `f0` has 1 Attack.
const GRIMA = "07016";
const ISLET = "07017";
const FORDS = "07018";
const KINGS_ROAD = "07019";
const GAP = "07020";
const PROWLER = "07042";
const BANDIT = "07043";
const RAIDER = "07044";
const TRIBESMAN = "07046";
const BERSERKER = "07048";
const STAGE_1 = "07059";
const STAGE_2 = "07060";
const STAGE_3 = "07061";
// `n` cards of a seat's hand, and the decks the draws take from.
const hand = (n: number, seat: number): Dealt[] => Array.from({ length: n }, () => ({ code: "filler", seat }));
const DECKS: Dealt[] = Array.from({ length: 12 }, () => "filler");

const ROWS: readonly Row[] = [
  // 07016:A:2 Action: Exhaust Gríma to draw a card. His controller uses it, and draws.
  { line: "07016:A:2", name: "Action: Exhaust Gríma to draw a card", layout: { play: [GRIMA], deckOf: DECKS, hand: hand(1, 0) }, act: [{ act: "respond", code: GRIMA }], expect: [drew(1), { expect: "exhausted", code: GRIMA, value: true }] },

  // 07017:A:2 While The Islet is the active location each Dunland enemy in play gets +1 Threat, staged or engaged.
  { line: "07017:A:2", name: "While The Islet is active each Dunland enemy in play gets +1 Threat", layout: { active: ISLET, staging: [PROWLER], engaged: [BANDIT] }, act: [], expect: [stat(PROWLER, "threat", 2), stat(BANDIT, "threat", 3)] },

  // 07018:A:2 Forced: after it becomes the active location each player with fewer than 5 cards draws until he holds 5.
  { line: "07018:A:2", name: "Forced: each player with fewer than 5 cards draws up to 5", layout: { seats: 2, staging: [FORDS], deckOf: DECKS, hand: [...hand(2, 0), ...hand(5, 1)] }, act: announce("becameActive", FORDS), expect: [handCount(5, 0), handCount(5, 1), drew(3, 0), drew(0, 1)] },

  // 07019 The King's Road: +3 quest points with 3 cards in any hand; at 5 the players must travel to it.
  { line: "07019:A:1", name: "While any player has 3 or more cards in hand it gets +3 quest points", layout: { seats: 2, staging: [KINGS_ROAD], hand: hand(3, 1) }, act: [], expect: stat(KINGS_ROAD, "questPoints", 5) },
  { line: "07019:A:2", name: "While any player has 5 or more cards in hand the players cannot decline to travel to it", layout: { seats: 2, phase: "Travel", staging: [KINGS_ROAD, "place"], hand: hand(5, 1) }, act: [], expect: offers("DeclineTravel", undefined, false) },

  // 07020:A:1 While Gap of Rohan is in the staging area Dunland enemies get +1 Attack.
  { line: "07020:A:1", name: "While Gap of Rohan is in the staging area Dunland enemies get +1 Attack", layout: { staging: [GAP, PROWLER] }, act: [], expect: stat(PROWLER, "attack", 3) },
  // 07021 Pillaging and Burning: every player draws a card, then each raises his threat by the cards in his hand.
  { line: "07021:A:1", name: "When Revealed: each player draws a card and raises his threat by the cards in his hand", layout: { seats: 2, deckOf: DECKS, hand: [...hand(1, 0), ...hand(2, 1)], deck: ["f0", "f0", "f0"] }, act: reveal("07021"), expect: [drew(1, 0), drew(1, 1), threat(30, 0), threat(31, 1)] },
  { line: "07021:A:2", name: "Shadow: the defending player discards an attachment he controls", layout: { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh1" }] }, act: [attack("f0", { shadow: "07021" }), defend("dh1")], expect: count("attachment", "discard", 1) },
  { line: "07021:A:2", name: "Shadow: an undefended attack discards each attachment he controls", layout: { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh1" }] }, act: attack("f0", { shadow: "07021", undefended: true }), expect: count("attachment", "discard", 2) },

  // 07042 Dunland Prowler: surge at 3 cards in any hand, +1 Threat at 5.
  { line: "07042:A:1", name: "While any player has 3 or more cards in hand it gains surge", layout: { seats: 2, staging: [PROWLER], hand: hand(3, 1) }, act: [], expect: flag(PROWLER, "gainsSurge") },
  { line: "07042:A:2", name: "While any player has 5 or more cards in hand it gets +1 Threat", layout: { seats: 2, staging: [PROWLER], hand: hand(5, 1) }, act: [], expect: stat(PROWLER, "threat", 2) },

  // 07043 Dunlending Bandit: +1 Attack for each card in the engaged player's hand (not the other player's); the Shadow gives +1, +2 at 3 cards.
  { line: "07043:A:1", name: "While engaged it gets +1 Attack for each card in that player's hand", layout: { seats: 2, engaged: [{ code: BANDIT, seat: 0 }], hand: [...hand(2, 0), ...hand(4, 1)] }, act: [], expect: stat(BANDIT, "attack", 3) },
  { line: "07043:A:2", name: "Shadow: the attacker gets +1 Attack while the defender has fewer than 3 cards", layout: { hand: hand(2, 0) }, act: attack("f0", { shadow: BANDIT, undefended: true }), expect: damageOn("dh1", 2) },
  { line: "07043:A:2", name: "Shadow: the attacker gets +2 Attack instead when the defender has 3 cards", layout: { hand: hand(3, 0) }, act: attack("f0", { shadow: BANDIT, undefended: true }), expect: damageOn("dh1", 3) },
  // 07044 Dunland Raider: when it engages a player he deals X damage among his characters, X the cards in his hand.
  { line: "07044:A:1", name: "Forced: after it engages a player he assigns damage equal to the cards in his hand", layout: { seats: 2, engaged: [{ code: RAIDER, seat: 0 }], hand: [...hand(2, 0), ...hand(4, 1)] }, act: announce("engaged", RAIDER), expect: damageOn("dh1", 2) },
  { line: "07044:A:2", name: "Shadow: discard an attachment you control", layout: { attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f0", { shadow: RAIDER, undefended: true }), expect: count("attachment", "discard", 1) },

  // 07045 Old Hatreds and 07049 Wild Men of Dunland: Conditions on the current quest; the Forced effect answers to the player who drew.
  { line: "07045:A:2", name: "When Revealed: it attaches to the current quest, and a draw raises that player's threat by 1", layout: { seats: 2, stage: STAGE_1, deckOf: DECKS, deck: ["f0", "f0", "f0"] }, act: [reveal("07045"), announce("cardsDrawn", undefined, { seat: 1, amount: 1 })], expect: [zone("07045", "attached"), threat(28, 0), threat(29, 1)] },
  { line: "07049:A:2", name: "When Revealed: it attaches to the current quest, and a draw deals 1 damage to a character of that player", layout: { seats: 2, stage: STAGE_1, deckOf: DECKS, deck: ["f0", "f0", "f0"] }, act: [reveal("07049"), announce("cardsDrawn", undefined, { seat: 1, amount: 1 })], expect: [zone("07049", "attached"), damageOn("dh3", 1), damageOn("dh1", 0)] },

  // 07046 Dunland Tribesman: each player draws when it is revealed; after any draw it gets +1 Threat until the end of the round.
  { line: "07046:A:1", name: "When Revealed: each player draws a card", layout: { seats: 2, deckOf: DECKS, deck: ["f0", "f0", "f0"] }, act: reveal(TRIBESMAN), expect: [drew(1, 0), drew(1, 1)] },
  { line: "07046:A:2", name: "Forced: after a player draws it gets +1 Threat", layout: { seats: 2, staging: [TRIBESMAN] }, act: announce("cardsDrawn", undefined, { seat: 1, amount: 2 }), expect: stat(TRIBESMAN, "threat", 1) },

  // 07048 Dunland Berserker: after the player it is engaged with draws, it makes an attack.
  { line: "07048:A:1", name: "Forced: after the engaged player draws it makes an attack", layout: { seats: 2, engaged: [{ code: BERSERKER, seat: 0 }], deck: ["f0", "f0", "f0", "f0"] }, act: announce("cardsDrawn", undefined, { seat: 0, amount: 1 }), expect: window("defense") },
  // 07059 Fight at the Fords, 07060 Dunlending Attack and 07061 Hold the Fords: the Time counters, the searches and the Forced effects of the last counter.
  { line: "07060:B:2", name: "Time 2: the stage the players advance to holds 2 time counters", layout: { stage: STAGE_1, progress: 6, play: [GRIMA], deck: [PROWLER, "f0", "f0"], discard: [BANDIT] }, act: quest("success"), expect: resourcesOn(STAGE_2, 2) },
  { line: "07061:B:1", name: "Time 3: the stage the players advance to holds 3 time counters", layout: { stage: STAGE_2, progress: 14, deck: [PROWLER, "f0", "f0"], discard: [BANDIT] }, act: quest("success"), expect: resourcesOn(STAGE_3, 3) },
  { line: "07060:B:1", name: "When Revealed: each player adds a different Dunland enemy from the deck or the discard pile to the staging area", layout: { seats: 2, stage: STAGE_2, deck: [PROWLER, "f0"], discard: [BANDIT] }, act: resolve(STAGE_2, "whenRevealed"), expect: [zone(PROWLER, "staging"), zone(BANDIT, "staging")] },
  { line: "07060:B:3", name: "Forced: after the last counter each player assigns damage equal to the cards in his hand and 2 counters go on the stage", layout: { seats: 2, stage: STAGE_2, hand: [...hand(2, 0), ...hand(3, 1)] }, act: announce("lastTimeCounterRemoved", STAGE_2), expect: [damageOn("dh1", 2), damageOn("dh3", 3), resourcesOn(STAGE_2, 2)] },
  { line: "07061:A:1", name: "When Revealed: each player adds a different Dunland enemy from the deck or the discard pile to the staging area", layout: { seats: 2, stage: STAGE_3, side: "A", deck: [PROWLER, "f0"], discard: [BANDIT] }, act: resolve(STAGE_3, "whenRevealed"), expect: [zone(PROWLER, "staging"), zone(BANDIT, "staging")] },
  { line: "07061:B:2", name: "Forced: after the last counter the top cards are discarded, one for each card in the first player's hand, the enemies among them join the staging area and 3 counters go on the stage", layout: { seats: 2, stage: STAGE_3, hand: [...hand(2, 0), ...hand(4, 1)], deck: [PROWLER, "place", BANDIT] }, act: announce("lastTimeCounterRemoved", STAGE_3), expect: [zone(PROWLER, "staging"), zone(BANDIT, "encounterDeck"), resourcesOn(STAGE_3, 3)] },
  { line: "07061:B:3", name: "While an enemy is in play the players cannot defeat the stage", layout: { stage: STAGE_3, progress: 16, staging: [PROWLER] }, act: quest("success"), expect: notWon },
];

if (ROWS.length > 0) cardSpecs("the-fords-of-isen", ROWS);
else describe("the-fords-of-isen card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
