// Rules: hob.setup-we-must-away-ere-break-of-day, hob.sack-deck, hob.sack-x, rr.forced, rr.response, rr.reveal, rr.shadow-effects, rr.quest-advancement, rr.doomed-x, rr.surge, rr.engaged, rr.attachment-cards (data/rules/entries.json); docs/scenarios/the-hobbit.md (We Must Away, Ere Break of Day).
import { announce, answer, attack, cardSpecs, count, damageOn, deckCount, flag, handCount, progressOn, quest, resolve, reveal, respond, stat, threat, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for We Must Away, Ere Break of Day (the-hobbit part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). The Sack cards, the claims of the Key and the Purse, Troll Cave and Troll Camp, the cancels and the
// empty encounter deck are in the files beside this one (sacks.test.ts, claims.test.ts, cancels.test.ts, empty-deck.test.ts). 131024:B:1 and 131024:B:2 are held by rows here and the tests of empty-deck.test.ts.
const SACKS = ["131044", "131045", "131046", "131047", "131048", "131049", "131050"];
const A = { stage: "131024", side: "A" } as const;
const B = { stage: "131024", side: "B" } as const;
const TROLLS = ["131032", "131033", "131034"];

const ROWS: readonly Row[] = [
  // 131023 An Unexpected Party.
  { line: "131023:A:1", name: "Setup: the set-aside Sack cards make the Sack deck and each player reveals a card", layout: { stage: "131023", side: "A", setAside: SACKS, deck: ["f0", "f0", "f0"] }, act: resolve("131023", "setup"), expect: [...SACKS.map((code) => count(code, "sackDeck", 1)), flag("table", "noteEncounterDiscards"), zone("f0", "staging"), deckCount(2)] },
  // 131024 Roast Mutton.
  { line: "131024:A:1", name: "When Revealed: the set-aside Trolls and Troll Cave join the staging area and the discard pile is shuffled into the deck", layout: { ...A, setAside: [...TROLLS, "131037"], discard: ["f0", "f3"] }, act: resolve("131024", "whenRevealed"), expect: [...[...TROLLS, "131037"].map((code) => zone(code, "staging")), count("f0", "encounterDeck", 1), count("f3", "encounterDeck", 1)] },
  { line: "131024:B:1", name: "Forced: the stage advances when the last Troll enemy is destroyed", layout: { ...B, victory: ["131032"], staging: ["f3"], deck: ["f0"] }, act: announce("enemyDestroyed", "131032"), expect: [zone("131025", "questStage")] },
  { line: "131024:B:2", name: "progress goes on the active location first and the quest's share discards that many cards from the encounter deck", layout: { ...B, active: "131039", deck: ["f0", "f0", "f0", "f0", "f0", "f0", "f0"], phase: "Quest" }, act: quest("success"), expect: [progressOn("131039", 2), progressOn("131024", 0), deckCount(4), count("f0", "encounterDiscard", 2)] },
  // 131025 Dawn Take You All.
  { line: "131025:B:1", name: "When Revealed: every Troll enemy and Sack card leaves the game, in play or not", layout: { stage: "131025", side: "B", staging: ["131032"], engaged: ["131033"], setAside: ["131034"], piles: { sackDeck: ["131044", "131045"] }, attached: [{ code: "131046", to: "dh1" }] }, act: resolve("131025", "whenRevealed"), expect: [zone("131032", "removed"), zone("131033", "removed"), zone("131034", "removed"), zone("131044", "removed"), zone("131045", "removed"), zone("131046", "removed")] },
  { line: "131025:B:2", name: "the players have won the game", layout: { stage: "131025", side: "B" }, act: resolve("131025", "whenRevealed"), expect: [won] },
  // 131032 William, 131033 Bert, 131034 Tom.
  { line: "131032:A:1", name: "Troll enemies in the staging area cannot take damage; an engaged one can", layout: { staging: ["131032", "131033", "f3"], engaged: ["131034"] }, act: [], expect: [flag("131032", "cannotTakeDamage"), flag("131033", "cannotTakeDamage"), flag("131034", "cannotTakeDamage", false), flag("f3", "cannotTakeDamage", false)] },
  { line: "131032:A:2", name: "Forced: after William engages a player, 2 Sack cards are drawn and attached", layout: { engaged: ["131032"], piles: { sackDeck: ["131045", "131045", "131045"] } }, act: [announce("engaged", "131032", { seat: 0 }), answer("dh1")], expect: [count("131045", "sackDeck", 1), count("131045", "attached", 2)] },
  { line: "131032:A:3", name: "Forced: at the end of the combat phase William returns to the staging area", layout: { engaged: ["131032"], phase: "Combat" }, act: [announce("endOfPhase", undefined, { phase: "Combat" }), answer("return")], expect: [zone("131032", "staging")] },
  { line: "131032:A:3", name: "the engaged player may raise his threat by 1 to cancel it", layout: { engaged: ["131032"], phase: "Combat" }, act: [announce("endOfPhase", undefined, { phase: "Combat" }), answer("raise")], expect: [zone("131032", "engaged"), threat(29)] },
  { line: "131033:A:1", name: "Troll enemies cannot have attachment cards played on them", layout: { staging: ["131033", "131032", "f3"], engaged: ["131034"] }, act: [], expect: [flag("131032", "noAttachmentPlays"), flag("131034", "noAttachmentPlays"), flag("f3", "noAttachmentPlays", false)] },
  { line: "131033:A:2", name: "Forced: after Bert engages a player, 1 Sack card is drawn and attached", layout: { engaged: ["131033"], piles: { sackDeck: ["131045", "131045"] } }, act: [announce("engaged", "131033", { seat: 0 }), answer("dh1")], expect: [count("131045", "sackDeck", 1), count("131045", "attached", 1)] },
  { line: "131033:A:3", name: "Forced: at the end of the combat phase Bert returns to the staging area", layout: { engaged: ["131033"], phase: "Combat" }, act: [announce("endOfPhase", undefined, { phase: "Combat" }), answer("return")], expect: [zone("131033", "staging")] },
  { line: "131034:A:1", name: "Troll enemies can be attacked by one character at a time", layout: { staging: ["131034", "131032", "f3"], engaged: ["131033"] }, act: [], expect: [flag("131032", "singleAttacker"), flag("131033", "singleAttacker"), flag("f3", "singleAttacker", false)] },
  { line: "131034:A:2", name: "Forced: after Tom engages a player, 1 Sack card is drawn and attached", layout: { engaged: ["131034"], piles: { sackDeck: ["131045", "131045"] } }, act: [announce("engaged", "131034", { seat: 0 }), answer("dh1")], expect: [count("131045", "sackDeck", 1), count("131045", "attached", 1)] },
  { line: "131034:A:3", name: "Forced: at the end of the combat phase Tom returns to the staging area", layout: { engaged: ["131034"], phase: "Combat" }, act: [announce("endOfPhase", undefined, { phase: "Combat" }), answer("return")], expect: [zone("131034", "staging")] },
  // 131036 Troll Camp.
  { line: "131036:A:1", name: "while in the staging area every Troll enemy gets +1 Threat for each player", layout: { staging: ["131036", "131032"], seats: 2 }, act: [], expect: [stat("131032", "threat", 5)] },
  // 131038 Hobbit-lands.
  { line: "131038:A:1", name: "Response: after progress is placed on Hobbit-lands the first player draws 1 card", layout: { active: "131038", deckOf: ["f0", "f0"], phase: "Quest" }, act: [quest("success"), respond("131038")], expect: [handCount(1)] },
  { line: "131038:A:2", name: "Shadow: the top card of the encounter discard pile goes on top of the encounter deck", layout: { discard: ["f0", "f3"], deck: ["f0", "f0", "f0"] }, act: attack("f3", { shadow: "131038", undefended: true }), expect: [zone("f3", "encounterDeck")] },
  // 131051 Lots or None at All.
  { line: "131051:A:1", name: "When Revealed: with a Troll in the staging area a Sack card is drawn", layout: { staging: ["131032"], piles: { sackDeck: ["131045"] } }, act: [resolve("131051", "whenRevealed"), answer("dh1")], expect: [count("131045", "attached", 1), threat(28)] },
  { line: "131051:A:1", name: "with no Troll in the staging area it gains Doomed 2 and no Sack card is drawn", layout: { staging: ["f3"], piles: { sackDeck: ["131045"] } }, act: reveal("131051"), expect: [count("131045", "sackDeck", 1), threat(30)] },
  // 131052 A Nice Pickle.
  { line: "131052:A:2", name: "When Revealed: twice the number of players cards go from the top of the discard pile to the bottom of the deck", layout: { discard: ["f0", "f0", "f3"], deck: ["f0"] }, act: resolve("131052", "whenRevealed"), expect: [deckCount(3), count("f3", "encounterDeck", 1)] },
  { line: "131052:A:3", name: "Shadow: this card is shuffled into the encounter deck", layout: { deck: ["f0", "f0"] }, act: attack("f3", { shadow: "131052", undefended: true }), expect: [zone("131052", "encounterDeck")] },
  // 131053 Roast 'Em or Boil 'Em?
  { line: "131053:A:1", name: "When Revealed: 1 damage to each ally", layout: { play: ["ally"], staging: ["f3"] }, act: resolve("131053", "whenRevealed"), expect: [damageOn("ally", 1)] },
  { line: "131053:A:1", name: "2 damage to each ally while a Troll enemy is in the staging area", layout: { play: ["ally"], staging: ["131032"] }, act: resolve("131053", "whenRevealed"), expect: [damageOn("ally", 2)] },
  { line: "131053:A:2", name: "Shadow: Troll Camp is searched for in the encounter deck and added to the staging area", layout: { deck: ["f0", "131036", "f0"] }, act: attack("f3", { shadow: "131053", undefended: true }), expect: [zone("131036", "staging")] },
  // 131054 Hungry Troll.
  { line: "131054:A:1", name: "When Revealed: the first player chooses a Troll enemy in the staging area and engages it", layout: { staging: ["131032", "131033"] }, act: [resolve("131054", "whenRevealed"), answer("131033")], expect: [zone("131033", "engaged"), zone("131032", "staging")] },
  { line: "131054:A:1", name: "with no Troll enemy in the staging area it gains Surge", layout: { staging: ["f3"], deck: ["f0", "f0"] }, act: reveal("131054"), expect: [zone("f0", "staging"), deckCount(1)] },
];

cardSpecs("we-must-away-ere-break-of-day", ROWS);
