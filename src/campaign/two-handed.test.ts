import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../rules/core/intents.ts";
import { settle } from "../rules/engine/machine.ts";
import { livingSeats, updateCard, type ScenarioState } from "../rules/core/state.ts";
import { buildTable, FRODO, idsOf, MERRY, RING, SAM, sceneCards, type Table } from "../../scripts/test-scene.ts";

let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  base = await sceneCards();
});

// The Refresh step of a two-seat table. The Ring sits on Frodo, who carries resources and one other attachment.
function refresh(extra: Parameters<typeof buildTable>[1] = {}): { table: Table; state: ScenarioState; steps: EngineStep[] } {
  const table = buildTable(base, {
    seats: 2,
    attached: [{ code: "plain", host: FRODO }],
    resources: 3,
    deck: ["f0", "f0", "f0", "f0"],
    playerDeck: [{ code: "card", seat: 0 }, { code: "card", seat: 0 }, { code: "card", seat: 1 }, { code: "card", seat: 1 }],
    ...extra,
  });
  const steps: EngineStep[] = [];
  const ready = { ...table.state, mode: "refresh" as const, phase: "Refresh" as const, boundaryPhase: "Refresh" as const, window: null };
  return { table, state: settle(ready, table.ctx, steps), steps };
}

describe("the first-player token passes with The One Ring", () => {
  it("moves the Ring-bearer, its resources, and every attachment to the new first seat", () => {
    const { table, state } = refresh();
    const frodo = idsOf(table, FRODO);
    const ring = idsOf(table, RING);
    const plain = idsOf(table, "plain");
    expect(state.firstPlayer).toBe(1);
    expect(state.seats[1].heroes).toContain(frodo);
    expect(state.seats[0].heroes).not.toContain(frodo);
    expect(state.cards[frodo]).toMatchObject({ zone: "heroes", controller: 1, resources: 4 });
    // The 3 carried over; the next Resource phase then added the ordinary 1 for this hero.
    for (const id of [ring, plain]) expect(state.cards[id], id).toMatchObject({ zone: "play", controller: 1, host: frodo });
    expect([...(state.cards[frodo]?.attachments ?? [])].sort()).toEqual([plain, ring].sort());
    expect(state.seats[1].play).toEqual(expect.arrayContaining([ring, plain]));
    expect(state.seats[0].play).not.toContain(ring);
    // Seat 0 keeps its other hero.
    expect(state.seats[0].heroes).toEqual([idsOf(table, SAM)]);
    expect(state.seats[0].eliminated).toBe(false);
  });

  it("eliminates a seat that is left with no heroes", () => {
    const { table, state, steps } = refresh({ heroes: [{ code: FRODO, seat: 0 }, { code: MERRY, seat: 1 }] });
    expect(state.firstPlayer).toBe(1);
    expect(state.seats[0].heroes).toEqual([]);
    expect(state.seats[0].eliminated).toBe(true);
    expect(steps).toContainEqual({ kind: "eliminate", seat: 0 });
    expect(livingSeats(state)).toEqual([1]);
    expect(state.lost).toBe(false);
    expect(state.cards[idsOf(table, FRODO)]?.controller).toBe(1);
  });

  it("passes only when the token passes: a single seat keeps its Ring-bearer", () => {
    const { table, state } = refresh({ seats: 1 });
    expect(state.firstPlayer).toBe(0);
    expect(state.cards[idsOf(table, FRODO)]?.controller).toBe(0);
  });

  it("does nothing without The One Ring", () => {
    const { table, state } = refresh({ ring: "none" });
    expect(state.firstPlayer).toBe(1);
    expect(state.cards[idsOf(table, FRODO)]?.controller).toBe(0);
  });

  it("keeps the exhausted Ring and the damage on the hero", () => {
    const table = buildTable(base, { seats: 2, ring: "exhausted", deck: ["f0", "f0", "f0", "f0"] });
    const frodo = idsOf(table, FRODO);
    const hurt = updateCard(table.state, frodo, { damage: 1 });
    const ready = { ...hurt, mode: "refresh" as const, phase: "Refresh" as const, boundaryPhase: "Refresh" as const, window: null };
    const state = settle(ready, table.ctx, []);
    expect(state.cards[frodo]).toMatchObject({ controller: 1, damage: 1 });
    // Control passed, ownership did not (rr.ownership-and-control): the log keeps him under seat 0.
    expect(state.cards[frodo]?.owner).toBe(0);
  });
});
