import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadCards } from "./data/load-cards.ts";
import { parseScenarioFixture, fixtureCards } from "../src/catalog/scenario-fixture.ts";
import { EFFECTS } from "../src/effects/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(...parts: string[]): unknown {
  return JSON.parse(readFileSync(path.join(root, ...parts), "utf8")) as unknown;
}

// Codes and timing labels only. A repeated label means the card prints that timing more than once.
const manifest = readJson("fixtures", "abilities", "a-shadow-of-the-past.json") as Record<string, string[]>;
const fixture = parseScenarioFixture(readJson("fixtures", "a-shadow-of-the-past.json"));

// Timings that phase 8 authors. A timing in LATER is listed as todo until it is authored.
const AUTHORED = new Set(["setup", "forced", "triggered", "whenRevealed", "shadow", "response", "action", "constant", "travel", "questResolution"]);
const LATER: Readonly<Record<string, string>> = {};

// A timing whose record is held back on purpose. The case fails with this message until a citation exists.
const HELD: Readonly<Record<string, string>> = {};

type Case = { code: string; timing: string; nth: number; name: string };

const cases: Case[] = Object.entries(manifest).flatMap(([code, timings]) => {
  const seen = new Map<string, number>();
  return timings.map((timing): Case => {
    const nth = (seen.get(timing) ?? 0) + 1;
    seen.set(timing, nth);
    return { code, timing, nth, name: `${code} ${timing} #${nth}` };
  });
});

describe("effect coverage manifest", () => {
  it("lists exactly the dealt codes and The One Ring", () => {
    const dealt = new Set([...fixtureCards(fixture).map((card) => card.code), "141085"]);
    expect(Object.keys(manifest).sort()).toEqual([...dealt].sort());
  });

  it("uses only timings an effect record can have", () => {
    const known = new Set([...AUTHORED, ...Object.keys(LATER)]);
    for (const [code, timings] of Object.entries(manifest)) {
      for (const timing of timings) expect(known.has(timing), `${code} ${timing}`).toBe(true);
    }
  });

  it("lists every labelled timing that data/cards derives from a card's text", () => {
    const byCode = new Map(loadCards().map((card) => [card.code, card]));
    let checked = 0;
    for (const [code, timings] of Object.entries(manifest)) {
      const card = byCode.get(code);
      expect(card, `${code} is in data/cards`).toBeDefined();
      for (const label of (card?.timings ?? []).filter((timing) => timing !== "constant")) {
        checked += 1;
        expect(timings, `${code} should list ${label}`).toContain(label);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("effect coverage", () => {
  for (const entry of cases) {
    if (!AUTHORED.has(entry.timing)) {
      it.todo(`${entry.name} (${LATER[entry.timing] ?? "unknown"})`);
      continue;
    }
    it(entry.name, () => {
      const held = HELD[entry.name];
      if (held) expect.fail(held);
      const records = EFFECTS.filter((effect) => effect.cardCode === entry.code && effect.timing === entry.timing);
      expect(records.length, `${entry.name} has no effect record`).toBeGreaterThanOrEqual(entry.nth);
    });
  }
});
