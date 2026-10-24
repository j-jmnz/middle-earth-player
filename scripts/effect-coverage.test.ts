import { describe, expect, it } from "vitest";

import { AUTHORED_EFFECTS, AUTHORED_REPLACES, EFFECTS, GENERATED_EFFECTS } from "../src/effects/index.ts";

import { loadCards } from "./data/load-cards.ts";
import { generateEffects, segmentsOf } from "./data/effects/generate.ts";
import { loadCampaign, loadScenarios } from "./data/load-scenarios.ts";

// Every printed ability on a card the Fellowship scenarios deal needs an effect record. The cards come from
// data/cards and the scenario data; the records are the generated ones plus the authored ones. A card's
// labelled lines (Setup, Forced, When Revealed, Response, Action, Travel, Shadow) need a record of that timing,
// and the number of records is at least the number of lines. A line no template reads is listed by
// `pnpm effects:draft` for an agent to author.
const cards = loadCards();
const scenarios = loadScenarios();
const campaign = loadCampaign();
const byCode = new Map(cards.map((card) => [card.code, card]));

const dealt = new Set<string>(campaign.prelude.map((card) => card.code));
for (const scenario of scenarios) {
  for (const card of scenario.cards) dealt.add(card.code);
  for (const group of campaign.authored.resolution[scenario.id] ?? []) for (const choice of group.choices) dealt.add(choice.code);
}

const LABELLED = new Set(["setup", "forced", "whenRevealed", "response", "action", "travel", "shadow", "questResolution"]);

describe("effect coverage", () => {
  for (const code of [...dealt].sort()) {
    const card = byCode.get(code);
    it(`${code} ${card?.name ?? "(not in data/cards)"}`, () => {
      expect(card, `${code} is in data/cards`).toBeDefined();
      const records = EFFECTS.filter((effect) => effect.cardCode === code);
      const wanted = new Map<string, number>();
      for (const timing of card?.timings ?? []) if (LABELLED.has(timing)) wanted.set(timing, (wanted.get(timing) ?? 0) + 1);
      for (const [timing, count] of wanted) {
        const have = records.filter((effect) => effect.timing === timing).length;
        expect(have, `${code} prints ${count} ${timing}`).toBeGreaterThanOrEqual(count);
      }
      expect(records.length, `${code} has a record for each printed line`).toBeGreaterThanOrEqual(card ? segmentsOf(card).length : 0);
    });
  }
});

describe("generated and authored records", () => {
  const regenerated = generateEffects(cards, scenarios, campaign);

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
      const have = EFFECTS.filter((effect) => effect.cardCode === line.card.code).length;
      expect(have, `${line.card.code} ${line.line}`).toBeGreaterThan(0);
    }
  });
});
