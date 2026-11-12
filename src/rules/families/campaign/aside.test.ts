import { describe, expect, it } from "vitest";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { definePrinted } from "../../core/printed.ts";
import { hero, enemy, table } from "../defense/table.ts";

// Rules: mec113.setting-up-the-game, mec113.aragorn, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 145078:A:1, 145078:B:1, 145072:A:1.
// The Pelennor campaign card's Setup and the Corsair Fleet's Forced: Aragorn set aside with his attachments and handed back, the logged Harad enemies, the recorded Fleet count.

const focus = { seat: 0, sourceId: null };
const sword = definePrinted({ code: "sword", name: "Sword", type: "attachment", traits: ["Artifact"] });
const banner = definePrinted({ code: "banner", name: "Banner", type: "attachment" });
const harad = (code: string) => enemy(code, { traits: ["Harad"] });
const orc = enemy("orc", { traits: ["Orc"] });

function built(notes?: NonNullable<ScenarioState["campaignFacts"]>["notes"]) {
  const base = table({ seatCount: 2, cards: [hero("aragorn"), hero("other"), sword, banner, harad("h1"), harad("h2"), orc], effects: [], heroes: [{ code: "aragorn" }, { code: "other", seat: 1 }] });
  const state: ScenarioState = { ...base.state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, ...(notes ? { notes } : {}) } };
  return { ...base, state };
}

describe("SetAsideHeroWithAttachments (145078:A:1)", () => {
  it("sets the hero aside with the supplied cards attached, out of play, without announcing that he left play", () => {
    const { state, ids, ctx } = built();
    const next = runInstruction(state, { verb: "SetAsideHeroWithAttachments", hero: "aragorn", attach: ["sword", "banner"] }, focus, ctx, []);
    const aragorn = next.cards[ids.aragorn!]!;
    expect(aragorn.zone).toBe("setAside");
    expect(next.seats[0].heroes).toEqual([]);
    expect(aragorn.attachments).toHaveLength(2);
    for (const id of aragorn.attachments) expect([next.cards[id]?.zone, next.cards[id]?.host]).toEqual(["setAside", ids.aragorn]);
    expect((next.pendingEvents ?? []).filter((event) => event.trigger === "leftPlay")).toEqual([]);
  });

  it("does nothing when the hero is not in play", () => {
    const { state, ctx } = built();
    const next = runInstruction(state, { verb: "SetAsideHeroWithAttachments", hero: "nobody", attach: ["sword"] }, focus, ctx, []);
    expect(next.setAside).toEqual([]);
  });
});

describe("ReturnSetAsideHero (145072:A:1)", () => {
  it("puts the hero back under the first player with his attachments, attached", () => {
    const { state, ids, ctx } = built();
    const away = runInstruction(state, { verb: "SetAsideHeroWithAttachments", hero: "aragorn", attach: ["sword", "banner"] }, focus, ctx, []);
    const back = runInstruction(away, { verb: "ReturnSetAsideHero", code: "aragorn" }, focus, ctx, []);
    const aragorn = back.cards[ids.aragorn!]!;
    expect([aragorn.zone, aragorn.controller]).toEqual(["heroes", 0]);
    expect(back.seats[0].heroes).toEqual([ids.aragorn]);
    for (const id of aragorn.attachments) expect([back.cards[id]?.zone, back.cards[id]?.controller, back.cards[id]?.host]).toEqual(["play", 0, ids.aragorn]);
  });

  it("does nothing with no such hero set aside", () => {
    const { state, ctx } = built();
    expect(runInstruction(state, { verb: "ReturnSetAsideHero", code: "aragorn" }, focus, ctx, [])).toBe(state);
  });
});

describe("SetAsideLogged and AddSetAsideToStaging by trait (145078:A:1, 145078:B:1)", () => {
  it("sets aside one copy per recorded count of each recorded Harad enemy, and no other", () => {
    const { state, ctx } = built({ blackGate: { h1: 2, h2: 1, orc: 3 }, corsairFleet: null, blackGateTokens: null });
    const next = runInstruction(state, { verb: "SetAsideLogged", trait: "Harad" }, focus, ctx, []);
    expect(next.setAside.map((id) => next.cards[id]?.code).sort()).toEqual(["h1", "h1", "h2"]);
  });

  it("sets nothing aside with no log", () => {
    const { state, ctx } = built();
    expect(runInstruction(state, { verb: "SetAsideLogged", trait: "Harad" }, focus, ctx, []).setAside).toEqual([]);
  });

  it("adds every set aside card with the trait to the staging area", () => {
    const { state, ctx } = built({ blackGate: { h1: 2, h2: 1, orc: 1 }, corsairFleet: null, blackGateTokens: null });
    const away = runInstruction(state, { verb: "SetAsideLogged", trait: "Harad" }, focus, ctx, []);
    const staged = runInstruction(away, { verb: "AddSetAsideToStaging", trait: "Harad", all: true }, focus, ctx, []);
    expect(staged.staging.map((id) => staged.cards[id]?.code).sort()).toEqual(["h1", "h1", "h2"]);
    expect(staged.setAside).toEqual([]);
  });
});

describe("the recorded count (145078:A:1)", () => {
  it("reads the Fleet's count, 0 when none is recorded or there is no log", () => {
    const withLog = built({ blackGate: {}, corsairFleet: 4, blackGateTokens: null });
    expect(resolveAmount(withLog.state, { recorded: "corsairFleet" }, frameScope(withLog.state, 0, null), withLog.ctx)).toBe(4);
    const unrecorded = built({ blackGate: {}, corsairFleet: null, blackGateTokens: null });
    expect(resolveAmount(unrecorded.state, { recorded: "corsairFleet" }, frameScope(unrecorded.state, 0, null), unrecorded.ctx)).toBe(0);
    const none = built();
    expect(resolveAmount(none.state, { recorded: "corsairFleet" }, frameScope(none.state, 0, null), none.ctx)).toBe(0);
  });
});
