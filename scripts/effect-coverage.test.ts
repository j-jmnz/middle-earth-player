import { describe, expect, it } from "vitest";

import { AUTHORED_EFFECTS, AUTHORED_REPLACES, EFFECTS, GENERATED_EFFECTS } from "../src/effects/index.ts";

import { loadCards } from "./data/load-cards.ts";
import { generateEffects } from "./data/effects/generate.ts";
import { lineTimings } from "./data/normalize/timings.ts";
import { isKeywordLine } from "./data/normalize/keywords.ts";
import { keyOf, lineId, loadLedger } from "./data/printed/ledger.ts";
import { dealtCodes, loadCampaign, loadScenarios } from "./data/load-scenarios.ts";

// Every printed line of a card the Fellowship scenarios deal is owned: by an effect record that names it in
// `lines`, by a keyword the engine reads (a line that is only keywords), or by an `inert` entry in the printed-text
// ledger (data/printed). Every record names lines that exist and belong to its own card. A line no template reads
// is listed by `pnpm effects:draft` for an agent to author.
const cards = loadCards();
const scenarios = loadScenarios();
const campaign = loadCampaign();
const ledger = loadLedger();
const byCode = new Map(cards.map((card) => [card.code, card]));

// A scenario is playable when every printed line of the cards it deals is owned. Scenario 1 is. Scenarios 2 to 6 are
// built (data/scenarios, with their campaign cards) and not yet playable: phases 12 to 16 write their records. The
// campaign cards' Setup and Resolution lines are owned for all six, which is the 8d exit.
const PLAYABLE = ["a-shadow-of-the-past"];
const PENDING_LINES: Readonly<Record<string, string>> = {
  "141056:A:2": "Flight to the Ford (phase 13): the cancel response needs the attacker-declared trigger.",
};
const campaignCards = new Set(Object.values(campaign.campaignCards));
const dealt = new Set([...dealtCodes(campaign, scenarios.filter((scenario) => PLAYABLE.includes(scenario.id))), ...campaignCards]);
const unplayable = scenarios.filter((scenario) => !PLAYABLE.includes(scenario.id));

describe("effect coverage", () => {
  for (const code of [...dealt].sort()) {
    const card = byCode.get(code);
    it(`${code} ${card?.name ?? "(not in data/cards)"} owns every printed line`, () => {
      expect(card, `${code} is in data/cards`).toBeDefined();
      const entries = ledger.entries.filter((entry) => entry.code === code);
      expect(entries.length, `${code} has a printed-text ledger entry`).toBeGreaterThan(0);
      for (const entry of entries) {
        entry.lines.forEach((line, at) => {
          const id = lineId(code, entry.side, at + 1);
          const owned = EFFECTS.some((effect) => effect.lines.includes(id)) || isKeywordLine(line) || entry.inert.some((mark) => mark.line === at + 1) || id in PENDING_LINES;
          expect(owned, `${id} is owned: ${line}`).toBe(true);
        });
      }
    });
  }

  it("keeps the scenarios that are not playable honest: each has a printed line nobody owns yet", () => {
    for (const scenario of unplayable) {
      const open = [...dealtCodes(campaign, [scenario])].filter((code) => !campaignCards.has(code)).flatMap((code) =>
        ledger.entries
          .filter((entry) => entry.code === code)
          .flatMap((entry) => entry.lines.map((line, at) => ({ id: lineId(code, entry.side, at + 1), line, entry })))
          .filter(({ id, line, entry }) => !EFFECTS.some((effect) => effect.lines.includes(id)) && !isKeywordLine(line) && !entry.inert.some((mark) => id.endsWith(`:${mark.line}`))),
      );
      expect(open.length, `${scenario.id} would be playable: add it to PLAYABLE`).toBeGreaterThan(0);
    }
  });

  it("has a record that names a line of its own card, for every shipped record", () => {
    for (const effect of EFFECTS) {
      expect(effect.lines.length, `${effect.id} names a line`).toBeGreaterThan(0);
      for (const id of effect.lines) {
        const [code, side, n] = id.split(":");
        const entry = ledger.byKey.get(keyOf(code ?? "", side ?? ""));
        expect(code, `${effect.id} claims ${id}, a line of another card`).toBe(effect.cardCode);
        const line = entry?.lines[Number(n) - 1];
        expect(line, `${effect.id} claims ${id}, which is not in the ledger`).toBeDefined();
        // A ledger edit that shifts line numbers moves a record onto a line with another label.
        expect(lineTimings(line ?? ""), `${effect.id} (${effect.timing}) claims ${id}: ${line}`).toContain(effect.timing);
      }
    }
  });

  it("backs each keyword-owned inert line with a keyword on its card", () => {
    for (const entry of ledger.entries) {
      for (const mark of entry.inert.filter((item) => item.keyword)) {
        const keywords = (byCode.get(entry.code)?.keywords ?? {}) as Record<string, unknown>;
        expect(keywords[mark.keyword ?? ""], `${entry.code}.${entry.side} line ${mark.line} names ${mark.keyword}`).toBeTruthy();
      }
    }
  });

  it("leaves no inert line that a record also claims", () => {
    for (const entry of ledger.entries) {
      for (const mark of entry.inert) {
        const id = lineId(entry.code, entry.side, mark.line);
        expect(EFFECTS.some((effect) => effect.lines.includes(id)), `${id} is inert and implemented`).toBe(false);
      }
    }
  });
});

describe("generated and authored records", () => {
  const regenerated = generateEffects(cards, scenarios, campaign, ledger);

  it("match what the templates write today", () => {
    expect(GENERATED_EFFECTS).toEqual(regenerated.effects);
  });

  it("replace each other only where AUTHORED_REPLACES says so", () => {
    const generatedIds = new Set(GENERATED_EFFECTS.map((effect) => effect.id));
    const overlapping = AUTHORED_EFFECTS.filter((effect) => generatedIds.has(effect.id)).map((effect) => effect.id);
    expect([...overlapping].sort()).toEqual([...AUTHORED_REPLACES].sort());
    expect(new Set(EFFECTS.map((effect) => effect.id)).size).toBe(EFFECTS.length);
  });

  it("leave only authored records for the lines no template reads", () => {
    expect(regenerated.effects.length).toBeGreaterThan(30);
    for (const line of regenerated.unmatched.filter((item) => dealt.has(item.card.code))) {
      const [code, side, n] = line.lineId.split(":");
      const inert = ledger.byKey.get(keyOf(code ?? "", side ?? ""))?.inert.some((mark) => mark.line === Number(n)) ?? false;
      expect(inert || line.lineId in PENDING_LINES || EFFECTS.some((effect) => effect.lines.includes(line.lineId)), `${line.lineId} ${line.line}`).toBe(true);
    }
  });
});
