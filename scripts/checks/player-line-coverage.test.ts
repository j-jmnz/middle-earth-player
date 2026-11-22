import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../src/effects/index.ts";

import { loadCards } from "../data/load-cards.ts";
import { ROOT, tracked } from "./tracked.ts";

// Every effect record of a deck-legal player card is named by a test: its id, or one of the printed lines it implements, stands in a test file. The card smoke (scripts/card-smoke) only shows
// that a record runs without breaking the game, so it does not count. A record that no test names is a card nobody checked against its text: write its test from the card's words in
// src/campaign/player-cards/<pack>.test.ts, with lineSpec (test/harness/line-spec.ts) where the test fails without the line's records. A record no test can show is listed in EXEMPT with its reason;
// the list is empty and stays empty unless a reason is written beside the entry.

/** Record ids with no test, each with the reason no test can show it. */
const EXEMPT: Readonly<Record<string, string>> = {};

// The card types a player builds a deck from.
const PLAYER_TYPES = new Set(["hero", "ally", "attachment", "event", "player-side-quest", "contract"]);
// A record id (01026:action:1) or a printed line id (01026:A:1), as a whole token.
const NAME = /(?<![\w:])(\d{2,6}:[A-Za-z]+:\d+)(?![\w])/g;

/** Every record id and line id that a test file names. */
function namedInTests(): Set<string> {
  const named = new Set<string>();
  const files = tracked(["src", "test"]).filter((file) => /\.(ts|tsx)$/.test(file) && (file.startsWith("test/") || /\.test\.tsx?$/.test(file)));
  for (const file of files) for (const found of readFileSync(path.join(ROOT, file), "utf8").matchAll(NAME)) named.add(found[1]!);
  return named;
}

describe("player card line coverage", () => {
  const playerCodes = new Set(loadCards().filter((card) => PLAYER_TYPES.has(card.type) && card.deckLegal).map((card) => card.code));
  const records = EFFECTS.filter((effect) => playerCodes.has(effect.cardCode));
  const named = namedInTests();
  const unnamed = records.filter((effect) => !named.has(effect.id) && !effect.lines.some((line) => named.has(line))).map((effect) => effect.id);

  it("finds a test that names every record of a deck-legal player card", () => {
    expect(records.length).toBeGreaterThan(1000);
    expect([...new Set(unnamed)].filter((id) => !(id in EXEMPT)).sort()).toEqual([]);
  });

  it("holds no exemption that is stale: an exempt record is still a record, and still unnamed", () => {
    const ids = new Set(records.map((effect) => effect.id));
    expect(Object.keys(EXEMPT).filter((id) => !ids.has(id) || !unnamed.includes(id))).toEqual([]);
  });
});
