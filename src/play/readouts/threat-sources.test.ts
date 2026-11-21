// Rules: rr.step-3-4 (data/rules/entries.json). The cards a tap on the quest meter lists add up to the meter's threat.
import { beforeAll, describe, expect, it } from "vitest";

import { stagingThreat } from "../../rules/quest/quest.ts";
import { buildTable, RIDER, sceneCards } from "../../../test/harness/scene.ts";

import { adjustWords, threatSourcesOf } from "./threat-sources.ts";
import { threatSourceSaid, threatSourceWords } from "../words/list.ts";

let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  base = await sceneCards();
});

describe("threatSourcesOf", () => {
  it("lists each card in staging with its Threat, the most first, adding up to the engine's staging threat", () => {
    const table = buildTable(base, { staging: [RIDER, "f0"] });
    const read = threatSourcesOf(table.state, table.ctx);
    expect(read.sources.map((source) => source.id).sort()).toEqual([...table.state.staging].sort());
    expect(read.sources.every((source) => source.from === "staging")).toBe(true);
    const threats = read.sources.map((source) => source.threat);
    expect(threats).toEqual([...threats].sort((left, right) => right - left));
    expect(read.total).toBe(stagingThreat(table.state, table.ctx.cards));
    expect(read.adjust).toBe(0);
    expect(read.seat).toBeNull();
  });

  it("lists nothing for an empty staging area", () => {
    const table = buildTable(base, {});
    expect(threatSourcesOf(table.state, table.ctx)).toMatchObject({ total: 0, sources: [], adjust: 0 });
  });
});

describe("threat source words", () => {
  it("says the type, where the card stands when not in staging, and the Threat it adds", () => {
    expect(threatSourceWords("Enemy", 3, "staging")).toBe("Enemy · 3 Threat");
    expect(threatSourceWords("Enemy", 2, "engaged")).toBe("Enemy · Engaged · 2 Threat");
    expect(threatSourceWords(null, 1, "active")).toBe("Active location · 1 Threat");
    expect(threatSourceSaid("Enemy", 2, "engaged")).toBe("Enemy, engaged, 2 threat");
    expect(threatSourceWords("Location", 2, "elsewhere", 1)).toBe("Location · In Player 2's staging area · 2 Threat");
    expect(threatSourceSaid("Location", 2, "elsewhere", 1)).toBe("Location, in player 2's staging area, 2 threat");
    expect(threatSourceWords("Location", 2, "elsewhere")).toBe("Location · In another area · 2 Threat");
  });

  it("says what held effects add or take, and nothing when they change nothing", () => {
    expect(adjustWords(0)).toBeNull();
    expect(adjustWords(2)).toBe("Other effects: +2 Threat");
    expect(adjustWords(-1)).toBe("Other effects: −1 Threat");
  });
});
