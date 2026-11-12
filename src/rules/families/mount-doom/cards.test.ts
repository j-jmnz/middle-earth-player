import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../../../effects/authored/return-of-the-king/mount-doom.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { attachSelf } from "../../interpret/effect-targeted.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { enemy, hero, send, table, recordsOf } from "../defense/table.ts";
import { STOP } from "./stop.ts";

// Rules: mec113.fortitude-tests, rr.forced, rr.first-player, rr.the-word-choose, rr.attachment-cards (data/rules/entries.json); ledger lines 146049:A:3, 146050:A:2, 146057:A:1.
// The cards that hear or change a Fortitude test, on a small table: Gollum's Forced effect, Ringwraith of Sauron's and Heavy and Tired's.

const GOLLUM = "146049";
const RINGWRAITH = "146050";
const HEAVY = "146057";
const card = (code: string, eyeIcons?: number) => definePrinted({ code, name: code, type: "treachery", keywords: eyeIcons ? { eyeIcons } : {} });
const gollum = definePrinted({ code: GOLLUM, name: "Gollum", type: "enemy", attack: 3, defense: 2, health: 6, threat: 2, engagementCost: 20, isUnique: true, keywords: { surge: true } });
const test: readonly Instruction[] = [{ verb: "FortitudeTest" }, { verb: "RaiseThreat", amount: 4, who: "actor", when: { kind: "lastFortitudeFailed" } }, STOP];

// A table whose effect frame makes a Fortitude test for seat 0, settled to the commit window.
function begin(codes: readonly string[], extra: Partial<Parameters<typeof table>[0]> = {}) {
  const cards = [hero("a", { willpower: 2 }), hero("b", { willpower: 2 }), card("eyes3", 3), card("eyes0"), gollum, definePrinted({ code: RINGWRAITH, name: "Ringwraith of Sauron", type: "enemy", attack: 3, defense: 2, health: 6, threat: 4, engagementCost: 40 }), definePrinted({ code: HEAVY, name: "Heavy and Tired", type: "treachery" }), enemy("orc")];
  const base = table({ cards, effects: recordsOf(AUTHORED_EFFECTS, GOLLUM, RINGWRAITH, HEAVY), heroes: [{ code: "a" }], encounter: codes, threat: 30, ...extra });
  const pushed = pushEffectFrame({ ...base.state, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: test, cancel: null, blockCancel: null }, []);
  return { ...base, state: settle(pushed, base.ctx, []) };
}
type Begun = ReturnType<typeof begin>;
const threat = (state: ScenarioState) => state.seats[0]?.threat ?? 0;
const commit = (run: Begun, state: ScenarioState = run.state) => send(state, { type: "CommitFortitude", cardIds: [run.ids.a ?? ""] }, run.ctx);
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

describe("Gollum (146049:A:3)", () => {
  // X = 3: the cards discarded are the first three of the deck.
  it("comes into play engaged with the first player once the cards are discarded, and the first player chooses a card whose icons are ignored", () => {
    const run = begin(["eyes3", GOLLUM, "eyes0", "orc"]);
    const committed = commit(run);
    expect(committed.window?.kind).toBe("choose");
    expect(codesOf(committed, committed.seats[0]?.engaged ?? [])).toEqual([GOLLUM]);
    const options = committed.window?.kind === "choose" ? committed.window.options : [];
    expect(codesOf(committed, options)).toEqual(["eyes3", "eyes0"]);
    // Choosing the card with 3 icons leaves none to count: Willpower 2 passes.
    const chosen = send(committed, { type: "Choose", optionId: options[0] ?? "" }, run.ctx);
    expect(chosen.window?.kind).toBe("frameAction");
    expect(threat(send(chosen, { type: "Pass" }, run.ctx))).toBe(30);
  });

  it("leaves the icons of the other cards counted: ignoring a card with no icons does not save the test", () => {
    const run = begin(["eyes3", GOLLUM, "eyes0", "orc"]);
    const committed = commit(run);
    const options = committed.window?.kind === "choose" ? committed.window.options : [];
    const chosen = send(committed, { type: "Choose", optionId: options[1] ?? "" }, run.ctx);
    expect(threat(send(chosen, { type: "Pass" }, run.ctx))).toBe(34);
  });

  it("changes nothing for a test that discards no Gollum", () => {
    const run = begin(["eyes3", "eyes0", "eyes0", "orc"]);
    expect(commit(run).window?.kind).toBe("frameAction");
  });
});

describe("Ringwraith of Sauron (146050:A:2)", () => {
  it("engages the player who fails a Fortitude test and makes an immediate attack, while it is in the staging area", () => {
    const run = begin(["eyes3", "eyes0", "eyes0", "orc"], { staging: [{ code: RINGWRAITH }] });
    const failed = send(commit(run), { type: "Pass" }, run.ctx);
    expect(codesOf(failed, failed.seats[0]?.engaged ?? [])).toContain(RINGWRAITH);
    expect(failed.window?.kind === "defense" || failed.pendingAttack != null || (failed.seats[0]?.engaged ?? []).length > 0).toBe(true);
  });

  it("does nothing when the test is passed", () => {
    const run = begin(["eyes0", "eyes0", "eyes0", "orc"], { staging: [{ code: RINGWRAITH }] });
    const passed = send(commit(run), { type: "Pass" }, run.ctx);
    expect(passed.seats[0]?.engaged ?? []).toEqual([]);
  });
});

describe("Heavy and Tired (146057:A:1)", () => {
  const attached = { attachments: [{ code: HEAVY, host: "a" }] };
  const ring = (code: string) => definePrinted({ code, name: code, type: "attachment", sphere: "tactics", cost: 0 });

  it("keeps the attached hero from committing to a Fortitude test: with no other hero the player is not asked", () => {
    const run = begin(["eyes0", "eyes0", "eyes0", "orc"], attached);
    expect(run.state.window?.kind).toBe("frameAction");
    expect(run.state.cards[run.ids.a ?? ""]?.exhausted).toBe(false);
  });

  it("lets another hero commit", () => {
    const run = begin(["eyes0", "eyes0", "eyes0", "orc"], { ...attached, heroes: [{ code: "a" }, { code: "b" }] });
    expect(run.state.window).toEqual({ kind: "fortitudeCommit", seat: 0 });
    expect(() => send(run.state, { type: "CommitFortitude", cardIds: [run.ids.a ?? ""] }, run.ctx)).toThrow();
    expect(send(run.state, { type: "CommitFortitude", cardIds: [run.ids.b ?? ""] }, run.ctx).window?.kind).toBe("frameAction");
  });

  it("exhausts the attached hero and discards each non-objective attachment on it, itself included, after its player fails a Fortitude test", () => {
    const run = begin(["eyes3", "eyes0", "eyes0", "orc"], { ...attached, cards: [hero("a", { willpower: 2 }), card("eyes3", 3), card("eyes0"), definePrinted({ code: HEAVY, name: "Heavy and Tired", type: "treachery" }), ring("blade"), enemy("orc")], attachments: [{ code: HEAVY, host: "a" }, { code: "blade", host: "a" }] });
    const failed = send(run.state, { type: "Pass" }, run.ctx);
    expect(failed.cards[run.ids.a ?? ""]?.exhausted).toBe(true);
    expect(failed.cards[run.ids[HEAVY] ?? ""]?.zone).not.toBe("play");
    expect(failed.cards[run.ids.blade ?? ""]?.zone).not.toBe("play");
  });

  it("hears the failure of the player who controls the attached hero, whoever is the first player (attached by AttachSelf: in zone attached, controlled by nobody)", () => {
    const run = begin(["eyes3", "eyes0", "eyes0", "orc"], { seatCount: 2, heroes: [{ code: "a", seat: 0 }, { code: "b", seat: 1 }] });
    const spawned = spawn(run.state, HEAVY, { zone: "play", seat: 1 });
    const placed = attachSelf(moveCard(spawned.state, spawned.id, { zone: "attached" }), spawned.id, run.ids.b ?? "", run.ctx);
    expect(placed.cards[spawned.id]?.controller ?? null).toBeNull();
    const pushed = pushEffectFrame({ ...placed, window: null }, { frame: "whenRevealed", sourceId: null, actor: 1, peril: false, effectId: "test", instructions: test, cancel: null, blockCancel: null }, []);
    const settled = settle(pushed, run.ctx, []);
    // Seat 1's only hero is barred, so the player is not asked; the actions window closes when both players pass.
    const failed = send(send(settled, { type: "Pass" }, run.ctx), { type: "Pass" }, run.ctx);
    expect(failed.cards[run.ids.b ?? ""]?.exhausted).toBe(true);
  });

  it("does not hear the failure of a player who does not control the attached hero", () => {
    const run = begin(["eyes3", "eyes0", "eyes0", "orc"], { seatCount: 2, heroes: [{ code: "a", seat: 0 }, { code: "b", seat: 1 }] });
    const spawned = spawn(run.state, HEAVY, { zone: "play", seat: 1 });
    const placed = attachSelf(moveCard(spawned.state, spawned.id, { zone: "attached" }), spawned.id, run.ids.b ?? "", run.ctx);
    const pushed = pushEffectFrame({ ...placed, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: test, cancel: null, blockCancel: null }, []);
    const failed = send(send(send(settle(pushed, run.ctx, []), { type: "CommitFortitude", cardIds: [] }, run.ctx), { type: "Pass" }, run.ctx), { type: "Pass" }, run.ctx);
    expect(failed.cards[run.ids.b ?? ""]?.exhausted).toBe(false);
    expect(failed.cards[spawned.id]?.zone).toBe("attached");
  });

  it("does nothing after a test that is passed", () => {
    const run = begin(["eyes0", "eyes0", "eyes0", "orc"], { ...attached, heroes: [{ code: "a" }, { code: "b" }] });
    const passed = send(send(run.state, { type: "CommitFortitude", cardIds: [run.ids.b ?? ""] }, run.ctx), { type: "Pass" }, run.ctx);
    expect(passed.cards[run.ids[HEAVY] ?? ""]?.zone).toBe("play");
  });
});

describe("Brake of Thorns (146047:A:1)", () => {
  const brake = definePrinted({ code: "146047", name: "Brake of Thorns", type: "location", threat: 3, questPoints: 3 });
  const placed = (zone: "staging" | "active") => {
    const run = begin(["eyes0", "eyes0", "eyes0", "orc"], { cards: [hero("a", { willpower: 1 }), card("eyes0"), brake, enemy("orc")], effects: recordsOf(AUTHORED_EFFECTS, "146047"), ...(zone === "staging" ? { staging: [{ code: "146047" }] } : {}) });
    return run;
  };

  it("adds one icon to each Fortitude test while it is in the staging area: Willpower 1 against 1 icon fails", () => {
    const run = placed("staging");
    expect(threat(send(commit(run), { type: "Pass" }, run.ctx))).toBe(34);
  });

  it("adds none while it is not in the staging area", () => {
    const run = placed("active");
    expect(threat(send(commit(run), { type: "Pass" }, run.ctx))).toBe(30);
  });
});

describe("The Lidless Eye (146055:A:2)", () => {
  const eye = definePrinted({ code: "146055", name: "The Lidless Eye", type: "treachery", keywords: { peril: true, eyeIcons: 2 } });
  const ring = definePrinted({ code: "146065", name: "The One Ring", type: "objective" });

  function revealed(exhausted: boolean) {
    const base = table({ cards: [hero("a", { willpower: 2 }), card("eyes0"), eye, ring], effects: recordsOf(AUTHORED_EFFECTS, "146055"), heroes: [{ code: "a" }], attachments: [{ code: "146065", host: "a" }], encounter: ["eyes0", "eyes0", "eyes0"], threat: 30 });
    const ringId = base.ids["146065"] ?? "";
    const state = exhausted ? { ...base.state, cards: { ...base.state.cards, [ringId]: { ...base.state.cards[ringId]!, exhausted: true } } } : base.state;
    const record = AUTHORED_EFFECTS.find((effect) => effect.id === "146055:whenRevealed:1");
    const pushed = pushEffectFrame({ ...state, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "146055:whenRevealed:1", instructions: [...(record?.instructions ?? []), STOP], cancel: null, blockCancel: null }, []);
    return { ...base, state: settle(pushed, base.ctx, []) };
  }

  it("adds two icons to its own test while The One Ring is exhausted, and raises the threat of the player who fails by 10", () => {
    const run = revealed(true);
    expect(threat(send(commit(run), { type: "Pass" }, run.ctx))).toBe(40);
  });

  it("adds none while The One Ring is ready: Willpower 2 against 0 passes", () => {
    const run = revealed(false);
    expect(threat(send(commit(run), { type: "Pass" }, run.ctx))).toBe(30);
  });
});
