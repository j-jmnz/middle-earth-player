import { describe, expect, it } from "vitest";

import { runInstruction } from "../../interpret/interpret.ts";
import { settle } from "../../engine/machine.ts";
import { syncConstants } from "../../interpret/constants.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { definePrinted } from "../../core/printed.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { enemy, hero, table } from "../defense/table.ts";

// Rules: mec113.setting-up-the-game, rr.guarded, rr.objective-cards, rr.permanent, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 146069:A:1, 146069:B:1.
// The Tower of Cirith Ungol's campaign card: A Heavy Burden attached to the hero with Last of the Company and moved to the Ring-bearer, the boons set aside and guarded by Shagrat.

const focus = (seat = 0) => ({ seat, sourceId: null });
const company = definePrinted({ code: "company", name: "Last of the Company", type: "objective" });
const burden = definePrinted({ code: "burden", name: "A Heavy Burden", type: "objective", keywords: { permanent: true } });
const sting = definePrinted({ code: "sting", name: "Sting", type: "attachment", traits: ["Item"], campaignKind: "boon" });
const lembas = definePrinted({ code: "lembas", name: "Lembas", type: "attachment", traits: ["Item"], campaignKind: "boon" });
const frodo = hero("frodo", { traits: ["Ring-bearer"] });

function built() {
  const base = table({
    seatCount: 2,
    cards: [frodo, hero("sam"), hero("other"), company, burden, sting, lembas, enemy("shagrat", { traits: ["Orc"] }), definePrinted({ code: "c", name: "Campaign", type: "campaign" })],
    effects: [],
    heroes: [{ code: "frodo" }, { code: "sam" }, { code: "other", seat: 1 }],
    attachments: [{ code: "company", host: "sam" }],
  });
  return base;
}

describe("AttachToHeroWith (146069:A:1)", () => {
  it("attaches a copy from the supply to the hero that has the card attached, under that hero's controller", () => {
    const { state, ids, ctx } = built();
    const next = runInstruction(state, { verb: "AttachToHeroWith", code: "burden", with: "company" }, focus(), ctx, []);
    const attached = next.cards[ids.sam!]!.attachments.map((id) => next.cards[id]!.code);
    expect(attached.sort()).toEqual(["burden", "company"]);
    const copy = next.cards[ids.sam!]!.attachments.find((id) => next.cards[id]!.code === "burden")!;
    expect([next.cards[copy]?.zone, next.cards[copy]?.controller, next.cards[copy]?.host]).toEqual(["play", 0, ids.sam]);
  });

  it("attaches nothing when no hero has the card", () => {
    const { state, ctx } = built();
    const next = runInstruction(state, { verb: "AttachToHeroWith", code: "burden", with: "nobody" }, focus(), ctx, []);
    expect(next).toBe(state);
  });
});

describe("MoveAttachment (146069:B:1)", () => {
  it("moves the card in play to the Ring-bearer, one card on one hero, without leaving play", () => {
    const { state, ids, ctx } = built();
    const withBurden = runInstruction(state, { verb: "AttachToHeroWith", code: "burden", with: "company" }, focus(), ctx, []);
    // The stand-in has lost Last of the Company, so the Ring-bearer is the one hero with the trait.
    const next = runInstruction(withBurden, { verb: "MoveAttachment", code: "burden", to: "ringBearer" }, focus(), ctx, []);
    const moved = next.cards[ids.frodo!]!.attachments.map((id) => next.cards[id]!.code);
    expect(moved).toEqual(["burden"]);
    expect(next.cards[ids.sam!]!.attachments.map((id) => next.cards[id]!.code)).toEqual(["company"]);
    expect((next.pendingEvents ?? []).filter((event) => event.trigger === "leftPlay")).toEqual([]);
  });

  it("does nothing with no such card in play", () => {
    const { state, ctx } = built();
    expect(runInstruction(state, { verb: "MoveAttachment", code: "burden", to: "ringBearer" }, focus(), ctx, [])).toBe(state);
  });
});

describe("GuardWithSetAside and ReturnGuardedToHand (146069:B:1)", () => {
  function guarded() {
    const base = built();
    let state = base.state;
    const aside: string[] = [];
    for (const [code, owner] of [["sting", 0], ["lembas", 1]] as const) {
      const spawned = spawn(state, code, { zone: "setAside" }, "down");
      state = updateCard(spawned.state, spawned.id, { owner });
      aside.push(spawned.id);
    }
    // The campaign card holds the Forced record that names the verb, so the sweep looks in this game.
    const campaign = spawn(state, "c", { zone: "campaign" });
    const shagrat = spawn(campaign.state, "shagrat", { zone: "staging" });
    const effects = [
      { id: "c:forced:1", cardCode: "c", lines: ["c:B:1"], timing: "forced" as const, trigger: "afterStageRevealed" as const, instructions: [{ verb: "GuardWithSetAside" as const, host: "shagrat", kind: "boon" as const }] },
      { id: "c:forced:2", cardCode: "c", lines: ["c:B:1"], timing: "forced" as const, trigger: "leftPlay" as const, instructions: [{ verb: "ReturnGuardedToHand" as const }] },
    ];
    return { ...base, state: shagrat.state, aside, shagrat: shagrat.id, ctx: { ...base.ctx, effects } };
  }

  it("attaches each set-aside boon faceup to Shagrat, held for its owner, whichever seat set it aside", () => {
    const { state, aside, shagrat, ctx } = guarded();
    const next = runInstruction(state, { verb: "GuardWithSetAside", host: "shagrat", kind: "boon" }, focus(), ctx, []);
    expect(next.cards[shagrat]!.attachments).toEqual(aside);
    for (const id of aside) expect([next.cards[id]?.zone, next.cards[id]?.face, next.cards[id]?.host, next.cards[id]?.held]).toEqual(["attached", "up", shagrat, true]);
    expect(next.setAside).toEqual([]);
  });

  it("leaves the boons set aside while Shagrat is not in play", () => {
    const { state, aside, shagrat, ctx } = guarded();
    const away = moveCard(state, shagrat, { zone: "victory" });
    const next = runInstruction(away, { verb: "GuardWithSetAside", host: "shagrat", kind: "boon" }, focus(), ctx, []);
    expect(next.setAside).toEqual(aside);
  });

  it("returns each guarded boon to its owner's hand when Shagrat leaves play", () => {
    const { state, aside, shagrat, ctx } = guarded();
    const attached = runInstruction(state, { verb: "GuardWithSetAside", host: "shagrat", kind: "boon" }, focus(), ctx, []);
    const gone = moveCard(attached, shagrat, { zone: "victory" });
    const next: ScenarioState = settle(syncConstants(gone, ctx), ctx, []);
    expect(next.seats[0].hand).toContain(aside[0]);
    expect(next.seats[1].hand).toContain(aside[1]);
    expect(next.cards[aside[0]!]?.held).toBeUndefined();
  });
});
