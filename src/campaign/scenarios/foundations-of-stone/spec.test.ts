// Rules: dwd.setup-foundations-of-stone, dwd.setup-foundations-of-stone-cave-torch, dwd.encounter-card-actions, rr.forced, rr.reveal, rr.shadow-effects, rr.attachment-cards, rr.objective-cards, rr.explored, rr.active-location, rr.ranged (data/rules/entries.json).
import { describe, it } from "vitest";

import {
  announce,
  answer,
  attack,
  cardSpecs,
  count,
  damageOn,
  deckCount,
  drew,
  exhausted,
  flag,
  handCount,
  progressOn,
  quest,
  resolve,
  reveal,
  resourcesOn,
  stat,
  threat,
  travel,
  zone,
  type Row,
} from "../../../../test/harness/card-spec.ts";

// Card specs for Foundations of Stone (dwarrowdelf part 8): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The rows here are the lines a table and one action show; the flows of several steps (Washed Away!, the separate stage 4 areas and their
// join, the Nameless enemies' attachments and Nest of Horrors, Lost and Alone, the Centipede, Chill of the Roots, the Nightmare setup, the commit limit) are tests titled with their line id in lines.test.ts. The stand-in heroes dh1 and dh2 are the first player's, dh3 the second's.
const ROWS: readonly Row[] = [
  // 04111 The Dripping Walls. Setup: the first player attaches Cave Torch to a hero. B:1: one card per player.
  { line: "04111:A:1", name: "the setup attaches Cave Torch to a hero of the first player", layout: { stage: "04111", side: "A" }, act: resolve("04111", "setup"), expect: zone("03041", "play") },
  { line: "04111:B:1", name: "one player reveals 1 card", layout: { stage: "04111", deck: ["f0", "f3"] }, act: resolve("04111", "whenRevealed"), expect: [zone("f0", "staging"), zone("f3", "encounterDeck")] },
  { line: "04111:B:1", name: "two players reveal 2 cards", layout: { seats: 2, stage: "04111", deck: ["f0", "f3", "f0"] }, act: resolve("04111", "whenRevealed"), expect: [zone("f3", "staging"), count("f0", "staging", 1), deckCount(1)] },

  // 04112 The Water's Edge. B:1: each player who committed characters discards the top 2 cards of his deck.
  { line: "04112:B:1", name: "a player who committed characters discards the top 2 cards of his deck", layout: { stage: "04112", deckOf: ["c1", "c1", "c1"] }, act: quest("success"), expect: count("c1", "discard", 2) },
  { line: "04112:B:1", name: "a player who committed none discards nothing", layout: { seats: 2, stage: "04112", deckOf: [{ code: "c1", seat: 0 }, { code: "c1", seat: 0 }, { code: "c2", seat: 1 }, { code: "c2", seat: 1 }] }, act: quest("success"), expect: [count("c1", "discard", 2), count("c2", "discard", 0)] },

  // 04114 to 04117 Below the Mines. B:1: the player's own reveals and discards.
  { line: "04114:B:1", name: "reveals 2 cards", layout: { stage: "04114", deck: ["f0", "f3", "f0"] }, act: resolve("04114", "whenRevealed"), expect: [zone("f0", "staging"), zone("f3", "staging"), deckCount(1)] },
  { line: "04115:B:1", name: "discards all resources from his heroes", layout: { stage: "04115", heroResources: 3 }, act: resolve("04115", "whenRevealed"), expect: [resourcesOn("dh1", 0), resourcesOn("dh2", 0)] },
  { line: "04116:B:1", name: "discards his hand, then reveals 2 cards", layout: { stage: "04116", hand: ["filler", "filler"], deck: ["f0", "f3", "f0"] }, act: resolve("04116", "whenRevealed"), expect: [handCount(0), zone("f0", "staging"), zone("f3", "staging"), deckCount(1)] },
  { line: "04117:B:1", name: "reveals 4 cards", layout: { stage: "04117", deck: ["f0", "f0", "f0", "f0", "f3"] }, act: resolve("04117", "whenRevealed"), expect: [count("f0", "staging", 4), zone("f3", "encounterDeck")] },

  // 04118 Out of the Depths. B:1: one card per player.
  { line: "04118:B:1", name: "one player reveals 1 card", layout: { stage: "04118", deck: ["f0", "f3"] }, act: resolve("04118", "whenRevealed"), expect: [zone("f0", "staging"), zone("f3", "encounterDeck")] },

  // 04119 Durin's Axe, 04120 Durin's Helm. A:2: the attached hero gets +3 Attack (+1 Defense); an attachment on any other card gives nothing. A:3 Action: a ready hero exhausts to claim it from the staging area.
  { line: "04119:A:2", name: "the attached hero gets +3 Attack", layout: { attached: [{ code: "04119", to: "dh1" }] }, act: [], expect: stat("dh1", "attack", 5) },
  { line: "04120:A:2", name: "the attached hero gets +1 Defense", layout: { attached: [{ code: "04120", to: "dh1" }] }, act: [], expect: stat("dh1", "defense", 3) },
  { line: "04119:A:3", name: "a ready hero exhausts to claim it from the staging area and it attaches to that hero", layout: { staging: ["04119"] }, act: [resolve("04119", "action"), answer("dh1")], expect: [zone("04119", "attached"), exhausted("dh1")] },
  { line: "04120:A:3", name: "a ready hero exhausts to claim it from the staging area and it attaches to that hero", layout: { staging: ["04120"] }, act: [resolve("04120", "action"), answer("dh2")], expect: [zone("04120", "attached"), exhausted("dh2")] },

  // 04121 Drowned Treasury. A:1: at the end of the quest phase each player discards a character he controls, a hero included. A:2: once explored each player may draw 2 cards or claim an objective.
  { line: "04121:A:1", name: "at the end of the quest phase the player discards a character of his choice, a hero included", layout: { active: "04121", phase: "Quest" }, act: [announce("endOfPhase"), answer("dh2")], expect: [zone("dh2", "discard"), zone("dh1", "heroes")] },
  { line: "04121:A:2", name: "explored: the player draws 2 cards", layout: { active: { code: "04121", progress: 2 }, deckOf: ["filler", "filler", "filler"] }, act: [quest("success"), { act: "respond", code: "04121" }, answer("draw")], expect: drew(2) },

  // 04122 Mithril Lode. A:2: the active location's Refresh Action places the Willpower of an exhausted character as progress on the quest, bypassing the location.
  { line: "04122:A:2", name: "exhausting a character places its Willpower as progress on the quest card, not on the location", layout: { stage: "04112", active: "04122", phase: "Refresh" }, act: [resolve("04122", "action"), answer("dh1")], expect: [exhausted("dh1"), progressOn("04112", 2), progressOn("04122", 0)] },

  // 04123 Deep Deep Dark. A:2: every Nameless enemy at the staging area gets the top card of the first player's deck. A:3 (Shadow): a Nameless attacker makes the defending player discard his hand.
  { line: "04123:A:2", name: "a Nameless enemy in the staging area gets the top card of the first player's deck", layout: { staging: ["04125"], deckOf: ["c3", "c1"], deck: ["f0"] }, act: reveal("04123"), expect: [zone("c3", "attached"), count("c1", "deck", 1)] },
  { line: "04123:A:2", name: "an engaged Nameless enemy gets one too", layout: { engaged: ["04126"], deckOf: ["c3", "c1"], deck: ["f0"] }, act: reveal("04123"), expect: [zone("c3", "attached"), count("c1", "deck", 1)] },
  { line: "04123:A:3", name: "Shadow: the defending player discards his hand when the attacker is Nameless", layout: { engaged: [{ code: "04125", seat: 0 }], hand: ["filler", "filler"] }, act: attack("04125", { shadow: "04123", undefended: true }), expect: handCount(0) },

  // 04124 Lost and Alone. A:1: each player chooses a hero and shuffles it into his deck. A:2 (Shadow): as Deep Deep Dark's.
  { line: "04124:A:1", name: "the chosen hero leaves play for its owner's deck", layout: { deckOf: ["c1"] }, act: [reveal("04124"), answer("dh1")], expect: [zone("dh1", "deck"), zone("dh2", "heroes")] },
  { line: "04124:A:2", name: "Shadow: the defending player discards his hand when the attacker is Nameless", layout: { engaged: [{ code: "04126", seat: 0 }], hand: ["filler", "filler"] }, act: attack("04126", { shadow: "04124", undefended: true }), expect: handCount(0) },

  // 04125 Nameless Thing, 04126 Elder Nameless Thing. A:1: after it engages a player it gets the top 2 (3) cards of that player's deck. A:2: X, its Attack and hit points, is the printed cost of the attached cards (3, 4 with none).
  { line: "04125:A:1", name: "after it engages it gets the top 2 cards of the player's deck", layout: { engaged: ["04125"], deckOf: ["c2", "c3", "c1"] }, act: announce("engaged", "04125"), expect: [zone("c2", "attached"), zone("c3", "attached"), count("c1", "deck", 1)] },
  { line: "04125:A:2", name: "with nothing attached X is 3", layout: { engaged: ["04125"] }, act: [], expect: [stat("04125", "attack", 3), stat("04125", "hitPoints", 3)] },
  { line: "04125:A:2", name: "X is the printed cost of the attached cards", layout: { engaged: ["04125"], deckOf: ["c2", "c3", "c1"] }, act: announce("engaged", "04125"), expect: [stat("04125", "attack", 5), stat("04125", "hitPoints", 5)] },
  { line: "04126:A:1", name: "after it engages it gets the top 3 cards of the player's deck", layout: { engaged: ["04126"], deckOf: ["c2", "c3", "c1", "c1"] }, act: announce("engaged", "04126"), expect: [zone("c2", "attached"), zone("c3", "attached"), count("c1", "attached", 1), count("c1", "deck", 1)] },
  { line: "04126:A:2", name: "with nothing attached X is 4", layout: { engaged: ["04126"] }, act: [], expect: [stat("04126", "attack", 4), stat("04126", "hitPoints", 4)] },
  { line: "04126:A:2", name: "X is the printed cost of the attached cards", layout: { engaged: ["04126"], deckOf: ["c2", "c3", "c1", "c1"] }, act: announce("engaged", "04126"), expect: [stat("04126", "attack", 6), stat("04126", "hitPoints", 6)] },

  // 04127 Moria Bats. A:1: only characters with Ranged can attack or defend against it. A:2: +1 Attack for each other enemy engaged with that player.
  { line: "04127:A:1", name: "only characters with ranged can attack or defend against it", layout: { engaged: ["04127"] }, act: [], expect: flag("04127", "onlyRangedCombat") },
  { line: "04127:A:2", name: "engaged with a player who has 2 other enemies it gets +2 Attack", layout: { engaged: ["04127", "f0", "f3"] }, act: [], expect: stat("04127", "attack", 3) },
  // 901701 to 901708, the Nightmare deck. 901702 Mithril Seeker: +1 Attack for each resource on it; when it attacks it takes 1 resource from each of the defending player's heroes.
  { line: "901702:A:1", name: "+1 Attack for each resource on it", layout: { engaged: [{ code: "901702", resources: 2 }] }, act: [], expect: stat("901702", "attack", 4) },
  { line: "901702:A:2", name: "when it attacks 1 resource moves from each hero that has one to it", layout: { heroResources: 2, engaged: [{ code: "901702", seat: 0 }] }, act: attack("901702", { undefended: true }), expect: [resourcesOn("dh1", 1), resourcesOn("dh2", 1), resourcesOn("901702", 2)] },

  // 901703 Giant Cave Centipede. A:1: each player shuffles the card in his hand with the highest printed cost into his deck. A:2: at the end of the combat phase it goes to another player's staging area.
  { line: "901703:A:1", name: "the highest printed cost card in hand goes back into the deck", layout: { hand: ["c1", "c3", "c2"], deckOf: ["c0"] }, act: reveal("901703"), expect: [count("c3", "hand", 0), count("c3", "deck", 1), handCount(2)] },
  { line: "901703:A:1", name: "the player picks among cards tied for the highest cost", layout: { hand: ["c2", "c2", "c1"] }, act: [reveal("901703"), answer("c2")], expect: [count("c2", "hand", 1), count("c2", "deck", 1), count("c1", "hand", 1)] },
  { line: "901703:A:2", name: "players who share a staging area send it to that area as a staging card", layout: { seats: 2, phase: "Combat", engaged: [{ code: "901703", seat: 0 }] }, act: announce("endOfPhase"), expect: zone("901703", "staging") },

  // 901704 Unspeakable Thing. A:1: when it engages a player or attacks one it gets the top card of that player's deck. A:2: X, its Attack and hit points (5 with nothing attached).
  { line: "901704:A:1", name: "after it engages a player it gets the top card of his deck", layout: { engaged: ["901704"], deckOf: ["c3", "c1"] }, act: announce("engaged", "901704"), expect: [zone("c3", "attached"), count("c1", "deck", 1)] },
  { line: "901704:A:1", name: "when it attacks a player it gets the top card of his deck", layout: { engaged: [{ code: "901704", seat: 0 }], deckOf: ["c3", "c1"] }, act: attack("901704", { undefended: true }), expect: [zone("c3", "attached"), count("c1", "deck", 1)] },
  { line: "901704:A:2", name: "with nothing attached X is 5", layout: { engaged: ["901704"] }, act: [], expect: [stat("901704", "attack", 5), stat("901704", "hitPoints", 5)] },
  { line: "901704:A:2", name: "X is the printed cost of the attached card", layout: { engaged: ["901704"], deckOf: ["c3", "c1"] }, act: announce("engaged", "901704"), expect: [stat("901704", "attack", 3), stat("901704", "hitPoints", 3)] },

  // 901705 Primeval Thing. A:1: when it enters play it gets cards from the first player's deck until they cost 6 or more in all. A:2: X (6 with nothing attached).
  { line: "901705:A:1", name: "when it is revealed it gets cards from the first player's deck until they cost 6 or more", layout: { deckOf: ["c3", "c2", "c1", "c1"], deck: ["f0"] }, act: reveal("901705"), expect: [zone("c3", "attached"), zone("c2", "attached"), count("c1", "attached", 1), count("c1", "deck", 1)] },
  { line: "901705:A:2", name: "with nothing attached X is 6", layout: { staging: ["901705"] }, act: [], expect: [stat("901705", "attack", 6), stat("901705", "hitPoints", 6)] },
  { line: "901705:A:2", name: "X is the printed cost of the attached cards", layout: { deckOf: ["c3", "c3"], deck: ["f0"] }, act: reveal("901705"), expect: [stat("901705", "attack", 6), stat("901705", "hitPoints", 6)] },

  // 901706 Nest of Horrors. A:1: in the staging area it attaches one more card when cards are attached to a Nameless enemy from a deck. A:2 (Travel): each player discards the top encounter card; each Nameless enemy so discarded is revealed.
  { line: "901706:A:1", name: "in the staging area it adds one more card from the same deck to the Nameless enemy, once", layout: { staging: ["901706"], engaged: ["901704"], deckOf: ["c1", "c1", "c1", "c1"] }, act: announce("engaged", "901704"), expect: [count("c1", "attached", 2), count("c1", "deck", 2)] },
  { line: "901706:A:2", name: "travelling discards the top encounter card and reveals a Nameless enemy discarded", layout: { phase: "Travel", staging: ["901706"], deck: ["901704", "f0"] }, act: travel("901706"), expect: [zone("901704", "staging"), zone("f0", "encounterDeck")] },

  // 901707 Shivering River. A:2 (Shadow): +1 Attack to the attacking enemy, +3 when more than one player is at this staging area.
  { line: "901707:A:2", name: "Shadow: +1 Attack for a player alone at the staging area", layout: { engaged: [{ code: "f3", seat: 0 }] }, act: attack("f3", { shadow: "901707", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "901707:A:2", name: "Shadow: +3 Attack when two players share the staging area", layout: { seats: 2, engaged: [{ code: "f3", seat: 0 }] }, act: attack("f3", { shadow: "901707", undefended: true }), expect: damageOn("dh1", 4) },

  // 901708 Chill of the Roots. A:1: each player discards his hand or raises his threat by its size; with no card discarded it gains surge. A:2 (Shadow): a Nameless attacker gets the top card of the defending player's deck.
  { line: "901708:A:1", name: "a player who discards his hand has none, and the card does not gain surge", layout: { hand: ["filler", "filler"], deck: ["f0", "f3"] }, act: [reveal("901708"), answer("discard")], expect: [handCount(0), zone("f3", "encounterDeck")] },
  { line: "901708:A:1", name: "a player who raises his threat by his hand size keeps his hand, and with no card discarded the card gains surge", layout: { hand: ["filler", "filler"], deck: ["f0", "f3"] }, act: [reveal("901708"), answer("raise")], expect: [handCount(2), threat(30), zone("f0", "staging")] },
  { line: "901708:A:2", name: "Shadow: a Nameless attacker gets the top card of the defending player's deck", layout: { engaged: [{ code: "04125", seat: 0 }], deckOf: ["c3", "c1"] }, act: attack("04125", { shadow: "901708", undefended: true }), expect: zone("c3", "attached") },
];

if (ROWS.length > 0) cardSpecs("foundations-of-stone", ROWS);
else describe("foundations-of-stone card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
