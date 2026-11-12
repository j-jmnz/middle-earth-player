import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { settle } from "../../engine/machine.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { placeDamage } from "../../core/keywords.ts";
import { updateCard } from "../../core/state.ts";
import { definePrinted } from "../../core/printed.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { hero, table } from "../defense/table.ts";

// Rules: mec113.setting-up-the-game, rr.guarded, rr.ownership-and-control, rr.player-elimination (data/rules/entries.json); ledger lines 146066:A:1, 146067:B:2.
// The Ring-bearer faceup under Topmost Chamber as a guarded objective (CaptureRingBearer `guarded`) and given back once the chamber is out of play (FreeRingBearer).

const focus = { seat: 0, sourceId: null };
const chamber = definePrinted({ code: "chamber", name: "Topmost Chamber", type: "location", threat: 1, questPoints: 1 });
const ring = definePrinted({ code: "ring", name: "The One Ring", type: "objective" });
const sword = definePrinted({ code: "sword", name: "Sting", type: "attachment" });
const free: Effect = { id: "stage:constant:1", cardCode: "stage", lines: ["stage:B:2"], timing: "constant", instructions: [{ verb: "FreeRingBearer" }] };

function built() {
  const base = table({
    cards: [hero("frodo", { traits: ["Ring-bearer"] }), hero("sam"), chamber, ring, sword, definePrinted({ code: "stage", name: "Stage", type: "quest" })],
    effects: [free],
    heroes: [{ code: "frodo" }, { code: "sam" }],
    attachments: [{ code: "sword", host: "frodo" }],
    staging: [{ code: "chamber" }],
  });
  let state = placeDamage(base.state, base.ids.frodo!, 2, base.ctx.cards, [], "framework", { kind: "rule", ruleId: "test" } as never);
  state = updateCard(state, base.ids.frodo!, { resources: 2, exhausted: true });
  state = spawn(state, "stage", { zone: "questStage" }).state;
  return { ...base, state };
}

describe("CaptureRingBearer guarded (146066:A:1)", () => {
  it("places the Ring-bearer faceup under the card, keeping its tokens and attachments faceup, controlled by nobody", () => {
    const { state, ids, ctx } = built();
    const next = runInstruction(state, { verb: "CaptureRingBearer", under: "chamber", guarded: true }, focus, ctx, []);
    const frodo = next.cards[ids.frodo!]!;
    expect([frodo.zone, frodo.host, frodo.face, frodo.controller, frodo.guardedHero]).toEqual(["captive", ids.chamber, "up", null, true]);
    expect([frodo.damage, frodo.resources, frodo.exhausted]).toEqual([2, 2, true]);
    expect(next.seats[0].heroes).toEqual([ids.sam]);
    const attached = next.cards[frodo.attachments[0]!]!;
    expect([attached.face, attached.zone]).toEqual(["up", "attached"]);
  });

  it("takes no damage from archery or a card while it lies there: no seat controls it, so nothing offers it", () => {
    const { state, ids, ctx } = built();
    const held = runInstruction(state, { verb: "CaptureRingBearer", under: "chamber", guarded: true }, focus, ctx, []);
    expect(held.seats.flatMap((seat) => seat.heroes)).not.toContain(ids.frodo);
  });

  it("is the ordinary facedown capture, tokens lost, without the option", () => {
    const { state, ids, ctx } = built();
    const next = runInstruction(state, { verb: "CaptureRingBearer", under: "chamber" }, focus, ctx, []);
    const frodo = next.cards[ids.frodo!]!;
    expect([frodo.face, frodo.damage, frodo.resources, frodo.guardedHero]).toEqual(["down", 0, 0, undefined]);
  });
});

describe("FreeRingBearer (146067:B:2)", () => {
  function captured() {
    const made = built();
    const state = runInstruction(made.state, { verb: "CaptureRingBearer", under: "chamber", guarded: true }, focus, made.ctx, []);
    return { ...made, state };
  }

  it("holds the Ring-bearer while the guard is in play", () => {
    const { state, ids, ctx } = captured();
    const next = settle(syncConstants(state, ctx), ctx, []);
    expect(next.cards[ids.frodo!]?.zone).toBe("captive");
  });

  it("gives the first player the Ring-bearer, in its place, as it was held, once the guard is out of play", () => {
    const { state, ids, ctx } = captured();
    const away = moveCard(state, ids.chamber!, { zone: "victory" });
    const next = settle(syncConstants(away, ctx), ctx, []);
    const frodo = next.cards[ids.frodo!]!;
    expect([frodo.zone, frodo.controller, frodo.face, frodo.guardedHero, frodo.host]).toEqual(["heroes", 0, "up", undefined, null]);
    expect(next.seats[0].heroes).toEqual([ids.frodo, ids.sam]);
    expect([frodo.damage, frodo.resources, frodo.exhausted]).toEqual([2, 2, true]);
    const sting = next.cards[frodo.attachments[0]!]!;
    expect([sting.zone, sting.controller, sting.face]).toEqual(["play", 0, "up"]);
  });

  it("does nothing in a game with no card that has a FreeRingBearer record, though the effect list holds one", () => {
    const { state, ids, ctx } = captured();
    const away = moveCard(state, ids.chamber!, { zone: "victory" });
    const without = { ...away, cards: Object.fromEntries(Object.entries(away.cards).filter(([, card]) => card.code !== "stage")) };
    const next = settle(syncConstants(without, ctx), ctx, []);
    expect(next.cards[ids.frodo!]?.zone).toBe("captive");
  });

  it("does nothing in a game with no FreeRingBearer record", () => {
    const { state, ids, ctx } = captured();
    const away = moveCard(state, ids.chamber!, { zone: "victory" });
    const next = settle(syncConstants(away, { ...ctx, effects: [] }), { ...ctx, effects: [] }, []);
    expect(next.cards[ids.frodo!]?.zone).toBe("captive");
  });
});
