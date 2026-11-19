// Rules: docs/brief.md (The Battle of Lake-town), rr.travel, rr.active-location; ledger lines 50223:A:2, 50217:A:2.
// Fisherman's Dock: with one active location the players may travel to it as a second active location (the exhaust is its cost); South Pier: while in play the players cannot travel to any other location.
import { describe, expect, it } from "vitest";

import "../index.ts";
import { legalTargets } from "../../engine/legal.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { travelCostUnpayable } from "../../interpret/restrictions.ts";
import { travelTo } from "../../quest/quest.ts";
import { moveCard } from "../../core/zones.ts";
import { updateCard } from "../../core/state.ts";
import type { Condition, Effect } from "../../../catalog/boundary.ts";
import { DOCK, lakeTable } from "./fixture.ts";

const traveling = (made: ReturnType<typeof lakeTable>, activeId?: string) => {
  const base = { ...made.state, window: { kind: "travel" as const }, phase: "Travel" as const, mode: "travel" as const, activeSeat: 0 };
  return activeId ? { ...moveCard(base, activeId, { zone: "activeLocation" }), window: { kind: "travel" as const } } : base;
};

const ONE_ACTIVE: Condition = { kind: "count", pick: { type: "location", control: "any", active: true }, min: 1 };
const READY_HERO = { type: "hero" as const, control: "you" as const, state: "ready" as const };
const dockTravel: Effect = {
  id: "50223:travel:1",
  cardCode: DOCK,
  lines: ["50223:A:2"],
  timing: "travel",
  instructions: [{ verb: "Pick", pick: READY_HERO, when: ONE_ACTIVE }, { verb: "Exhaust", target: { kind: "picked" }, when: ONE_ACTIVE }],
};

describe("Fisherman's Dock (50223:A:2)", () => {
  it("is the only location the players may travel to while one location is active, and it becomes the second active location", () => {
    const made = lakeTable({ staging: [{ code: "plain", key: "active" }, { code: "plain", key: "other" }, { code: DOCK, key: "dock" }] });
    const state = traveling(made, made.ids.active);
    expect(legalTargets(state, { type: "Travel" }, made.ctx)).toEqual([made.ids.dock]);
    const there = travelTo(state, made.ids.dock ?? "", made.ctx.cards);
    expect(there?.activeLocation).toBe(made.ids.active);
    expect(there?.secondActiveLocation).toBe(made.ids.dock);
  });

  it("is traveled to as any location is when none is active, and not at all with two active locations", () => {
    const made = lakeTable({ staging: [{ code: "plain", key: "other" }, { code: DOCK, key: "dock" }] });
    expect(legalTargets(traveling(made), { type: "Travel" }, made.ctx)).toEqual([made.ids.other, made.ids.dock]);
    const second = lakeTable({ staging: [{ code: "plain", key: "a" }, { code: "plain", key: "b" }, { code: DOCK, key: "dock" }] });
    const both = { ...traveling(second, second.ids.a), secondActiveLocation: second.ids.b ?? null };
    expect(legalTargets(both, { type: "Travel" }, second.ctx)).toEqual([]);
  });

  it("cannot be paid with one active location and no ready hero to exhaust, but is free with none active", () => {
    const made = lakeTable({ staging: [{ code: "plain", key: "active" }, { code: DOCK, key: "dock" }], effects: [dockTravel] });
    const state = traveling(made, made.ids.active);
    expect(travelCostUnpayable(state, made.ctx, made.ids.dock ?? "")).toBe(false);
    const tired = updateCard(state, made.ids.h1 ?? "", { exhausted: true });
    expect(travelCostUnpayable(tired, made.ctx, made.ids.dock ?? "")).toBe(true);
    expect(legalTargets(tired, { type: "Travel" }, made.ctx)).toEqual([]);
    // No active location: the exhaust is not owed, so the Dock is a target with every hero exhausted.
    const none = lakeTable({ staging: [{ code: DOCK, key: "dock" }], effects: [dockTravel] });
    const spent = updateCard(traveling(none), none.ids.h1 ?? "", { exhausted: true });
    expect(travelCostUnpayable(spent, none.ctx, none.ids.dock ?? "")).toBe(false);
    expect(legalTargets(spent, { type: "Travel" }, none.ctx)).toEqual([none.ids.dock]);
  });
});

describe("South Pier (50217:A:2)", () => {
  const southPier: Effect = { id: "pier:constant:1", cardCode: "pier", lines: ["pier:A:2"], timing: "constant", instructions: [{ verb: "Restrict", what: "travel", exceptSelf: true }] };

  it("leaves the players only South Pier to travel to, and nothing is barred without it", () => {
    const made = lakeTable({ staging: [{ code: "plain", key: "other" }, { code: DOCK, key: "dock" }, { code: "pier" }], effects: [southPier] });
    const withPier = { ...made, state: syncConstants(traveling(made), made.ctx) };
    expect(legalTargets(withPier.state, { type: "Travel" }, made.ctx)).toEqual([made.ids.pier]);
    const without = lakeTable({ staging: [{ code: "plain", key: "other" }, { code: DOCK, key: "dock" }] });
    expect(legalTargets(traveling(without), { type: "Travel" }, without.ctx)).toHaveLength(2);
  });
});
