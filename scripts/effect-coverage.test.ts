import { describe, expect, it } from "vitest";

import { AUTHORED_EFFECTS, AUTHORED_REPLACES, EFFECTS, GENERATED_EFFECTS } from "../src/effects/index.ts";

import { loadCards } from "./data/load-cards.ts";
import { generateEffects } from "./data/effects/generate.ts";
import { isKeywordLine } from "./data/normalize/printed.ts";
import { keyOf, lineId, loadLedger } from "./data/printed/ledger.ts";
import { loadCampaign, loadScenarios } from "./data/load-scenarios.ts";

// Every printed line of a card the Fellowship scenarios deal is owned: by an effect record that names it in
// `lines`, by a keyword the engine reads (a line that is only keywords), or by an `inert` entry in the printed-text
// ledger (data/printed). Every record names lines that exist and belong to its own card. A line no template reads
// is listed by `pnpm effects:draft` for an agent to author.
const cards = loadCards();
const scenarios = loadScenarios();
const campaign = loadCampaign();
const ledger = loadLedger();
const byCode = new Map(cards.map((card) => [card.code, card]));

const dealt = new Set<string>(campaign.prelude.map((card) => card.code));
for (const scenario of scenarios) {
  for (const card of scenario.cards) dealt.add(card.code);
  for (const group of campaign.authored.resolution[scenario.id] ?? []) for (const choice of group.choices) dealt.add(choice.code);
}

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
          const owned = EFFECTS.some((effect) => effect.lines?.includes(id)) || isKeywordLine(line) || entry.inert.some((mark) => mark.line === at + 1);
          expect(owned, `${id} is owned: ${line}`).toBe(true);
        });
      }
    });
  }

  it("has a record that names a line of its own card, for every shipped record", () => {
    for (const effect of EFFECTS) {
      expect(effect.lines?.length ?? 0, `${effect.id} names a line`).toBeGreaterThan(0);
      for (const id of effect.lines ?? []) {
        const [code, side, n] = id.split(":");
        const entry = ledger.byKey.get(keyOf(code ?? "", side ?? ""));
        expect(code, `${effect.id} claims ${id}, a line of another card`).toBe(effect.cardCode);
        expect(entry?.lines[Number(n) - 1], `${effect.id} claims ${id}, which is not in the ledger`).toBeDefined();
      }
    }
  });

  it("leaves no inert line that a record also claims", () => {
    for (const entry of ledger.entries) {
      for (const mark of entry.inert) {
        const id = lineId(entry.code, entry.side, mark.line);
        expect(EFFECTS.some((effect) => effect.lines?.includes(id)), `${id} is inert and implemented`).toBe(false);
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
    for (const line of regenerated.unmatched) {
      const [code, side, n] = line.lineId.split(":");
      const inert = ledger.byKey.get(keyOf(code ?? "", side ?? ""))?.inert.some((mark) => mark.line === Number(n)) ?? false;
      expect(inert || EFFECTS.some((effect) => effect.lines?.includes(line.lineId)), `${line.lineId} ${line.line}`).toBe(true);
    }
  });
});
