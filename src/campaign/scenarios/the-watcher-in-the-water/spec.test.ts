// Rules: rr.reveal, rr.staging, rr.travel, rr.shadow-effects, rr.first-player, dwd.setup-the-watcher-in-the-water, dwd.setup-the-watcher-in-the-water-set-aside, rr.running-out-of-cards, rr.attachment-cards (data/rules/entries.json).
import { describe, it } from "vitest";

import { attack, cardSpecs, damageOn, deckCount, defend, handCount, progressOn, resolve, reveal, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Watcher in the Water (dwarrowdelf part 6): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The rows here are the lines whose records need only a table; the lines with a flow
// of several steps (the Tentacle attachments, Doors of Durin's Action, the Nightmare setup card) are tests titled with their line id in verbs.test.ts, tentacles.test.ts and flows.test.ts. The stand-in heroes dh1 and dh2 are the first player's.
const ROWS: readonly Row[] = [
  // 040076 Wrapped!: the first player attaches it to a hero he controls that has no Wrapped!; with none it is discarded.
  { line: "040076:A:1", name: "revealed, it attaches to a hero of the first player", layout: { deck: ["f0"] }, act: reveal("040076"), expect: zone("040076", "attached") },

  // 04063 To the West-door, B:1: cards are revealed until the staging area holds at least twice the players' Threat (X = 2 solo).
  { line: "04063:B:1", name: "reveals until the staging area holds 2 Threat and stops there", layout: { stage: "04063", side: "B", deck: ["f3", "f0", "f0"] }, act: resolve("04063", "whenRevealed"), expect: [zone("f3", "staging"), deckCount(2)] },

  // 04064 The Seething Lake, B:1: The Watcher joins the staging area, Doors of Durin becomes the active location (the one it replaces goes to the staging area), the Tentacle cards of the discard pile are shuffled into the deck.
  { line: "04064:B:1", name: "The Watcher joins the staging area, Doors of Durin becomes the active location and the displaced location returns to the staging area", layout: { stage: "04064", side: "B", active: "place", setAside: ["04072", "04065"], deck: ["f0"] }, act: resolve("04064", "whenRevealed"), expect: [zone("04072", "staging"), zone("04065", "activeLocation"), zone("place", "staging")] },
  { line: "04064:B:1", name: "the Tentacle cards of the encounter discard pile are shuffled into the deck", layout: { stage: "04064", side: "B", setAside: ["04072", "04065"], discard: ["04073", "901507", "f0"], deck: ["f0"] }, act: resolve("04064", "whenRevealed"), expect: [zone("04073", "encounterDeck"), zone("f0", "encounterDiscard")] },
  { line: "04064:B:1", name: "on Nightmare the Nightmare Watcher stands in for the set-aside Watcher", layout: { nightmare: "901501", stage: "04064", side: "B", setAside: ["901502", "04065"], deck: ["f0"] }, act: resolve("04064", "whenRevealed"), expect: [zone("901502", "staging"), zone("04065", "activeLocation")] },

  // 04066 Stair Falls and 04067 Perilous Swamp, Shadow: 1 progress token is removed from the main quest stage.
  { line: "04066:A:2", name: "its Shadow removes 1 progress from the main quest", layout: { stage: "04064", progress: 3 }, act: attack("f0", { shadow: "04066" }), expect: progressOn("04064", 2) },
  { line: "04067:A:2", name: "its Shadow removes 1 progress from the main quest", layout: { stage: "04064", progress: 3 }, act: attack("f0", { shadow: "04067" }), expect: progressOn("04064", 2) },

  // 901505:A:2 "Shadow: For each point of damage dealt by this attack, the defending player must discard a random card from his hand." f0 (1 Attack) undefended deals 1: one of three cards is discarded.
  { line: "901505:A:2", name: "Shadow: a card at random from the hand for each point of damage the attack deals", layout: { hand: ["filler", "filler", "filler"] }, act: attack("f0", { shadow: "901505", undefended: true }), expect: handCount(2) },
  // Mountain Warg (4 Attack) defended by dh1 (2 Defense) deals 2: two of three cards are discarded.
  { line: "901505:A:2", name: "Shadow: 2 damage dealt, 2 cards discarded at random", layout: { hand: ["filler", "filler", "filler"] }, act: [attack("03055", { shadow: "901505" }), defend("dh1")], expect: [damageOn("dh1", 2), handCount(1)] },
];

if (ROWS.length > 0) cardSpecs("the-watcher-in-the-water", ROWS);
else describe("the-watcher-in-the-water card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
