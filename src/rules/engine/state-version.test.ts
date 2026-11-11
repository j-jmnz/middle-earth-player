// Rules: brief, Persistence and shipping (docs/brief.md). The stored form of a table: the migration chain, the round trip, and the check that refuses a state the engine cannot play.
import { describe, expect, it } from "vitest";

import { cardMap, codes, expectOk, fixtureDefinition, hero } from "../core/test-fixture.ts";
import { definePrinted } from "../core/printed.ts";
import type { ScenarioState } from "../core/state.ts";
import { reduce, startScenario } from "./reduce.ts";
import { checkState, migrateState, restoredState, STATE_MIGRATIONS, STATE_VERSION, storedState } from "./state-version.ts";

const deck = codes("d", 12);
const cards = cardMap([
  hero("aragorn", "leadership", 8, 1),
  definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 8 }),
  ...deck.map((code) => definePrinted({ code, name: code, type: "event", cost: 0, sphere: "neutral" })),
]);
const ctx = { effects: [], cards };
const start = startScenario({ seatCount: 1, seed: 42, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["aragorn"], deck }], encounterDeck: [], questDeck: ["stage"] }, ctx);
const played = expectOk(reduce(start, { type: "Mulligan" }, ctx)).state;

const withCard = (state: ScenarioState, change: Partial<ScenarioState["cards"][string]>): ScenarioState => {
  const [id] = Object.keys(state.cards);
  return { ...state, cards: { ...state.cards, [id!]: { ...state.cards[id!]!, ...change } } };
};

describe("the stored state", () => {
  it("has one migration from each version to the next, each a function", () => {
    expect(STATE_VERSION).toBeGreaterThanOrEqual(1);
    expect(STATE_MIGRATIONS).toHaveLength(STATE_VERSION - 1);
    for (const step of STATE_MIGRATIONS) expect(typeof step).toBe("function");
  });

  it("migrates the current version to itself and refuses a version it does not know", () => {
    const stored = storedState(start);
    expect(migrateState(STATE_VERSION, stored)).toBe(stored);
    expect(migrateState(0, stored)).toBeNull();
    expect(migrateState(STATE_VERSION + 1, stored)).toBeNull();
    expect(migrateState(1.5, stored)).toBeNull();
  });

  it("round-trips through JSON to an equal state: at a phase boundary the very table, elsewhere the table with its Undo log restarted", () => {
    expect(restoredState(JSON.parse(JSON.stringify(storedState(start))))).toEqual(start);
    const restored = restoredState(JSON.parse(JSON.stringify(storedState(played))));
    expect(storedState(restored)).toEqual(storedState(played));
    expect(restored.undo.intents).toEqual([]);
    expect(restored.undo.phase).toBe(played.phase);
    if (played.undo.intents.length === 0) expect(restored).toEqual(played);
  });
});

describe("checkState", () => {
  it("accepts a state the engine plays", () => {
    expect(checkState(start, ctx, { scenarioId: start.scenarioId, seatCount: 1 })).toEqual([]);
    expect(checkState(played, ctx)).toEqual([]);
  });

  it("refuses a code that is not in the world", () => {
    expect(checkState(withCard(start, { code: "no-such-card" }), ctx)).toEqual(["code no-such-card is not in this game's world"]);
  });

  it("refuses an unknown zone and a missing host", () => {
    expect(checkState(withCard(start, { zone: "nowhere" as never }), ctx).join("\n")).toMatch(/unknown zone nowhere/);
    expect(checkState(withCard(start, { host: "c-missing" }), ctx).join("\n")).toMatch(/has no host/);
  });

  it("refuses a seat count that is not the game's, and a scenario that is not", () => {
    expect(checkState(start, ctx, { seatCount: 2 })).toEqual(["seat count 1 is not 2"]);
    expect(checkState({ ...start, seatCount: 3 as never }, ctx).join("\n")).toMatch(/seat count 3/);
    expect(checkState(start, ctx, { scenarioId: "another" })).toHaveLength(1);
  });

  it("refuses a list that names a card the state does not hold", () => {
    expect(checkState({ ...start, staging: [...start.staging, "c-gone"] }, ctx)).toEqual(["1 listed card is not in the game"]);
  });

  it("refuses a state whose window the engine cannot list", () => {
    const broken = { ...played, window: { kind: "choose", options: null } as never };
    expect(checkState(broken, ctx).join("\n")).toMatch(/cannot list the window/);
  });
});
