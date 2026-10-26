// Rules: mec109.ringbearers-life, mec109.burden-deck (data/rules/entries.json). The table pieces a scenario declares, and the
// log's words for the life: shown for Flight to the Ford with the numbers the engine holds, and absent for the scenarios that
// declare neither.
import { beforeAll, describe, expect, it } from "vitest";

import { ruleCause } from "../rules/cause.ts";
import { syncConstants } from "../rules/constants.ts";
import { placeDamage } from "../rules/keywords.ts";
import type { EngineStep } from "../rules/intents.ts";
import { fordTable, loadFordWorld, type FordWorld } from "../../scripts/ford-scene.ts";
import { loadWorld, table, type World } from "../../scripts/past-scene.ts";

import { ledgerLine, ruleTitle } from "./ledger.ts";
import { logLines, type LogNames } from "./log.ts";
import { widgetReadouts } from "./widgets.ts";

let ford: FordWorld;
let past: World;

beforeAll(async () => {
  ford = await loadFordWorld();
  past = await loadWorld();
});

describe("the life and burden deck readouts", () => {
  it("show the life and the burden deck count of Flight to the Ford, as the engine holds them", () => {
    const { state, ctx, frodo } = fordTable(ford);
    expect(widgetReadouts(state)).toEqual({ life: 15, burdenDeck: 5 });
    const hurt = placeDamage(syncConstants(state, ctx), frodo, 2, ctx.cards, [], "combat", ruleCause("rr.step-6-4-3"));
    expect(widgetReadouts(hurt)).toEqual({ life: 13, burdenDeck: 5 });
    // Taking the top burden out of the deck lowers its count.
    const [top, ...rest] = state.burdenDeck ?? [];
    expect(top).toBeDefined();
    expect(widgetReadouts({ ...state, burdenDeck: rest })).toEqual({ life: 15, burdenDeck: 4 });
  });

  it("show neither on a scenario 1 game", () => {
    const { state } = table(past);
    expect(state.widgets.lifeTracker).toBe(false);
    expect(state.widgets.burdenDeck).toBe(false);
    expect(widgetReadouts(state)).toEqual({ life: null, burdenDeck: null });
  });

  it("are shown only when the scenario declares them", () => {
    const { state } = fordTable(ford);
    expect(widgetReadouts({ ...state, widgets: { ...state.widgets, lifeTracker: false } }).life).toBeNull();
    expect(widgetReadouts({ ...state, widgets: { ...state.widgets, burdenDeck: false } }).burdenDeck).toBeNull();
  });
});

describe("the log's words for the Ring-bearer's life", () => {
  const names: LogNames = {
    card: (id) => id,
    code: (code) => ford.cards.get(code)?.name ?? code,
    effectCard: () => "141063",
    rule: ruleTitle,
    line: ledgerLine,
  };

  it("says the life went down, with the rule or the card line that did it", () => {
    const steps: EngineStep[] = [
      { kind: "life", amount: -1, cause: { effect: "141063:forced:1", line: "141063:A:2" } },
      { kind: "life", amount: -3, cause: { rule: "rr.step-6-4-3" } },
    ];
    const lines = logLines(steps, names);
    expect(lines.map((line) => line.text)).toEqual(["The Ring-bearer's life -1", "The Ring-bearer's life -3"]);
    expect(lines[0]?.cause).toContain("Fell Rider");
    expect(lines[1]?.cause).toBe(`Rule: ${ruleTitle("rr.step-6-4-3")}`);
    expect(lines.every((line) => line.mark === "damage")).toBe(true);
  });
});
