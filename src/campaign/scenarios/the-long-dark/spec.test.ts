// Rules: dwd.lost-effects, dwd.locate-test, dwd.cave-torch-the-long-dark, rr.forced, rr.reveal, rr.shadow-effects, rr.first-player, rr.then, rr.attachment-cards, rr.defending-player (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, exhausted, handCount, progressOn, quest, resolve, reveal, stagingThreat, threat, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Long Dark (dwarrowdelf part 7): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). The rows here are the lines a table and one action show; the flows of several steps (the locate test and its
// results, the Lost choices, Twisting Passage, Eastern Mines, Gathering Ground, the Shadows that need an attack with a second seat) are tests titled with their line id in lines.test.ts. The stand-in heroes dh1 and dh2 are the first player's; PASS is printed on the box's locations 04089, 04090, 04091 and 04092.
const ROWS: readonly Row[] = [
  // 04086 Journey in the Black Pit. Setup: the first player attaches Cave Torch to a hero. B:1: cards are discarded until X locations lie in the discard pile; they go to the staging area and the other cards go back. B:2: +1 Threat for each location.
  { line: "04086:A:1", name: "the setup attaches Cave Torch to a hero of the first player", layout: { stage: "04086", side: "A" }, act: resolve("04086", "setup"), expect: zone("03041", "play") },
  { line: "04086:B:1", name: "one player: the cards are discarded until 1 location, which joins the staging area; the others go back into the deck", layout: { stage: "04086", deck: ["f0", "04090", "04091"] }, act: resolve("04086", "whenRevealed"), expect: [zone("04090", "staging"), zone("f0", "encounterDeck"), zone("04091", "encounterDeck")] },
  { line: "04086:B:1", name: "two players: still 1 location (the players less one, at least 1)", layout: { seats: 2, stage: "04086", deck: ["04090", "04091", "f0"] }, act: resolve("04086", "whenRevealed"), expect: [zone("04090", "staging"), zone("04091", "encounterDeck")] },
  { line: "04086:B:2", name: "each location has 1 more Threat", layout: { stage: "04086", staging: ["04091"] }, act: resolve("04086", "whenRevealed"), expect: stagingThreat(2) },
  { line: "04086:B:2", name: "after the players quest unsuccessfully the Lost effects trigger", layout: { stage: "04086", staging: ["04091"] }, act: announce("questFailed"), expect: exhausted("dh1") },

  // 04087 Continuing Eastward. B:1: the first player makes a locate test; failed, as many cards are revealed as there are players, then the Lost effects trigger; passed, none of it. B:2: Lost after an unsuccessful quest. B:3: defeating the stage wins the game.
  { line: "04087:B:1", name: "a failed test reveals a card for each player and triggers the Lost effects", layout: { stage: "04087", staging: ["04091"], hand: ["filler"], deck: ["f3", "f0", "f0"] }, act: [resolve("04087", "whenRevealed"), answer("stop")], expect: [zone("f3", "staging"), exhausted("dh1")] },
  { line: "04087:B:1", name: "a passed test (a PASS card discarded) reveals nothing and triggers nothing", layout: { stage: "04087", staging: ["04091"], hand: ["filler"], deck: ["04089", "f3", "f0"] }, act: [resolve("04087", "whenRevealed"), answer("filler")], expect: [zone("04089", "encounterDiscard"), zone("f3", "encounterDeck"), exhausted("dh1", false)] },
  { line: "04087:B:2", name: "after the players quest unsuccessfully the Lost effects trigger", layout: { stage: "04087", staging: ["04091"] }, act: announce("questFailed"), expect: exhausted("dh1") },

  // 04088 Durin's Greaves: the first player attaches it to a hero.
  { line: "04088:A:1", name: "revealed, it attaches to a hero", layout: { deck: ["f0"] }, act: reveal("04088"), expect: zone("04088", "attached") },

  // 04089 Abandoned Mine, 04090 Dwarven Forge, 04091 Silent Caverns: their Lost lines.
  { line: "04089:A:1", name: "Lost: the two Goblin enemies most recently discarded return to the staging area", layout: { staging: ["04089"], discard: ["f0", "04098", "04099"] }, act: announce("lost", "04089"), expect: [zone("04098", "staging"), zone("04099", "staging"), zone("f0", "encounterDiscard")] },
  { line: "04090:A:1", name: "Lost: each player discards 1 card from his hand", layout: { staging: ["04090"], hand: ["filler", "filler"] }, act: announce("lost", "04090"), expect: handCount(1) },
  { line: "04091:A:1", name: "Lost: every character is exhausted", layout: { staging: ["04091"] }, act: announce("lost", "04091"), expect: [exhausted("dh1"), exhausted("dh2")] },

  // 04093 Fatigue: each player exhausts a ready character; it gains surge when a player has no unexhausted character. Shadow: the defending player exhausts a character.
  { line: "04093:A:1", name: "each player exhausts a character", layout: { deck: ["f0"] }, act: reveal("04093"), expect: exhausted("dh1") },
  { line: "04093:A:1", name: "with a second player who has one character the card gains surge: the next card is revealed", layout: { seats: 2, deck: ["f3", "f0"] }, act: reveal("04093"), expect: [exhausted("dh3"), zone("f3", "staging")] },

  // 04094 Foul Air and 04096 Vast and Intricate: a failed test has the effect and triggers the Lost effects.
  { line: "04094:A:1", name: "a failed test deals 2 damage to every character", layout: { hand: ["filler"], deck: ["f0", "f0"] }, act: [reveal("04094"), answer("stop")], expect: [damageOn("dh1", 2), damageOn("dh2", 2)] },
  { line: "04094:A:1", name: "a passed test deals none", layout: { hand: ["filler"], deck: ["04089", "f0"] }, act: [reveal("04094"), answer("filler")], expect: [zone("04089", "encounterDiscard"), damageOn("dh1", 0)] },
  { line: "04096:A:1", name: "a failed test raises every player's threat by 7 and removes every progress token", layout: { stage: "04087", progress: 3, hand: ["filler"], staging: [{ code: "place", progress: 1 }], deck: ["f0", "f0"] }, act: [reveal("04096"), answer("stop")], expect: [threat(35), progressOn("04087", 0), progressOn("place", 0)] },
  { line: "04096:A:1", name: "a passed test changes nothing", layout: { stage: "04087", progress: 3, hand: ["filler"], deck: ["04089", "f0"] }, act: [reveal("04096"), answer("filler")], expect: [threat(28), progressOn("04087", 3), zone("04089", "encounterDiscard")] },

  // 04097 Cave Spider. A:1: the first player draws 1 card, then discards 4 (only if he drew). A:2: the player it engages discards 1 card.
  { line: "04097:A:1", name: "the first player draws 1 and discards 4 cards", layout: { hand: ["filler", "filler", "filler", "filler", "filler"], deckOf: ["filler"], deck: ["f0"] }, act: reveal("04097"), expect: handCount(2) },
  { line: "04097:A:2", name: "the player it engages discards 1 card from his hand", layout: { hand: ["filler", "filler"], engaged: ["04097"] }, act: announce("engaged", "04097"), expect: handCount(1) },

  // 04098 Goblin Sneak. A:1: after it engages a player the top encounter card is discarded, and when it is a treachery the Sneak engages the next player. A:2: the shadow card goes to the staging area.
  { line: "04098:A:1", name: "after it engages, the top card of the encounter deck is discarded (not revealed)", layout: { engaged: ["04098"], deck: ["f0", "f3"] }, act: announce("engaged", "04098"), expect: [zone("f0", "encounterDiscard"), zone("f3", "encounterDeck")] },
  { line: "04098:A:2", name: "its Shadow adds it to the staging area", layout: { phase: "Encounter" }, act: attack("f0", { shadow: "04098" }), expect: zone("04098", "staging") },

  // 04099 Goblin Warlord. Lost: each player discards an ally he controls. Shadow: the Lost effects trigger.
  { line: "04099:A:1", name: "Lost: each player discards an ally he controls from play", layout: { staging: ["04099"], play: ["ally"] }, act: announce("lost", "04099"), expect: zone("ally", "discard") },
  { line: "04099:A:2", name: "its Shadow triggers the Lost effects in play", layout: { phase: "Encounter", staging: ["04090"], hand: ["filler", "filler"] }, act: attack("f0", { shadow: "04099" }), expect: handCount(1) },

  // 04100 Rock Adder. A:2: when the attack is undefended the defending player discards a character.
  { line: "04100:A:2", name: "its Shadow on an undefended attack discards a character the defending player controls", layout: { phase: "Encounter" }, act: attack("f0", { shadow: "04100", undefended: true }), expect: zone("dh1", "discard") },
];

if (ROWS.length > 0) cardSpecs("the-long-dark", ROWS);
else describe("the-long-dark card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
