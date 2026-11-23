import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../src/effects/index.ts";

import { loadCards } from "../data/load-cards.ts";
import { ROOT, tracked } from "./tracked.ts";

// Every effect record is named by a test: its id, or one of the printed lines it implements, stands in a test file. That holds for the deck-legal player cards and for every other card (encounter cards,
// quest stages, objectives, campaign cards, boons, burdens and treasures). The smokes (scripts/card-smoke) only show that a record runs without breaking the game, so they do not count. A record that no
// test names is a card nobody checked against its text. Write a player card's test from the card's words in src/campaign/player-cards/<pack>.test.ts, and a scenario card's in its scenario's spec.test.ts or
// card-lines.test.ts (a card-spec row, test/harness/card-spec.ts), with lineSpec (test/harness/line-spec.ts) where a row cannot say it: each runs again without the line's records and fails there. A
// title built in a loop does not name its line: write the line ids in the describe title. A record no test can show is listed in EXEMPT with its reason; the list is empty and stays empty unless a reason
// is written beside the entry.

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

describe("line coverage", () => {
  const playerCodes = new Set(loadCards().filter((card) => PLAYER_TYPES.has(card.type) && card.deckLegal).map((card) => card.code));
  const named = namedInTests();
  const unnamed = [...new Set(EFFECTS.filter((effect) => !named.has(effect.id) && !effect.lines.some((line) => named.has(line))).map((effect) => effect.id))];
  const open = unnamed.filter((id) => !(id in EXEMPT)).sort();
  const ofPlayer = (id: string) => playerCodes.has(id.slice(0, id.indexOf(":")));

  it("finds a test that names every record of a deck-legal player card", () => {
    expect(EFFECTS.filter((effect) => playerCodes.has(effect.cardCode)).length).toBeGreaterThan(1000);
    expect(open.filter(ofPlayer)).toEqual([]);
  });

  it("finds a test that names every record of every other card", () => {
    expect(open.filter((id) => !ofPlayer(id))).toEqual([]);
  });

  it("holds no exemption that is stale: an exempt record is still a record, and still unnamed", () => {
    const ids = new Set(EFFECTS.map((effect) => effect.id));
    expect(Object.keys(EXEMPT).filter((id) => !ids.has(id) || !unnamed.includes(id))).toEqual([]);
  });
});
