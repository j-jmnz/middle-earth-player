// Rules: rm.time-x, rm.current-trial, rr.engaged, rr.attacks-outside-the-combat-phase, rr.reveal, rr.cannot, rr.victory (data/rules/entries.json); ledger lines 08037:B:1, 08037:B:2, 08038:B:2, 08040:A:2, 08041:A:2, 08042:A:2, 08047:A:1, 08054:A:1, 08055:A:1.
// The cards of The Three Trials that run the new verbs: the Guardians' Time effect on the engaged player, the Cave Barrow's cap on allies, the guardians held in play and the time counters taken off.
import { describe, expect, it } from "vitest";

import { idOf, resolveRecords, run, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { effectCause } from "../../../rules/core/cause.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { pushEffectFrame } from "../../../rules/interpret/effect-frames.ts";
import { removeTimeCounters } from "../../../rules/families/angmar/time.ts";

const SCENARIO = "the-three-trials";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const counters = (state: ScenarioState, code: string) => cardsOf(state, code)[0]?.resources;

describe("08040:A:2 to 08042:A:2 the Guardians' Time effect", () => {
  const engagedWith = (code: string, resources: number, extra: Layout = {}) => table({ seats: 2, engaged: [{ code, seat: 1, resources }], ...extra });
  const forced = (made: ReturnType<typeof table>, code: string) => resolveRecords(made.state, made.ctx, code, "forced", idOf(made.state, code));

  it("08040:A:2 makes the engaged player, and no other, discard an ally he controls, then puts 2 counters on again", () => {
    const t = engagedWith("08040", 0, { play: [{ code: "ally", seat: 0 }, { code: "ally", seat: 1 }] });
    const { state } = forced(t, "08040");
    expect(cardsOf(state, "ally").map((card) => [card.zone, card.controller])).toEqual([["play", 0], ["discard", 1]]);
    expect(counters(state, "08040")).toBe(2);
  });

  it("08040:A:2 does nothing to a player with no ally, and the counters are still placed", () => {
    const t = engagedWith("08040", 0, { play: [{ code: "ally", seat: 0 }] });
    const { state } = forced(t, "08040");
    expect([cardsOf(state, "ally")[0]?.zone, counters(state, "08040")]).toEqual(["play", 2]);
  });

  it("08042:A:2 deals 1 damage to each character the engaged player controls and puts 4 counters on again", () => {
    const t = engagedWith("08042", 0, { play: [{ code: "ally", seat: 0 }, { code: "ally", seat: 1 }] });
    const { state } = forced(t, "08042");
    const damaged = Object.values(state.cards).filter((card) => card.damage > 0).map((card) => card.controller);
    expect(damaged).toEqual([1, 1]);
    expect(counters(state, "08042")).toBe(4);
  });

  it("08041:A:2 makes an immediate attack against the engaged player", () => {
    const t = engagedWith("08041", 0, {});
    const { state } = forced(t, "08041");
    expect([state.pendingAttack?.seat, state.pendingAttack?.enemyId]).toEqual([1, idOf(state, "08041")]);
  });

  it("08040:A:2 a Guardian that no player is engaged with does nothing but place its counters", () => {
    const t = table({ seats: 2, staging: ["08040"], play: [{ code: "ally", seat: 0 }, { code: "ally", seat: 1 }] });
    const { state } = forced(t, "08040");
    expect([cardsOf(state, "ally").map((card) => card.zone), counters(state, "08040")]).toEqual([["play", "play"], 2]);
  });
});

describe("08055:A:1 Wild Tenacity", () => {
  it("08055:A:1 takes X counters, X the players, off each enemy with Time, stops at 0, and the Guardian hears its last counter go once", () => {
    const t = table({ seats: 2, engaged: [{ code: "08040", seat: 1, resources: 2 }, { code: "08042", seat: 0, resources: 4 }], play: [{ code: "ally", seat: 1 }] });
    const { state } = resolveRecords(t.state, t.ctx, "08055", "whenRevealed");
    // The Boar's Guardian lost both, its Forced effect discarded the ally once and placed 2 counters again; the Raven's lost 2 of 4.
    expect([counters(state, "08040"), counters(state, "08042"), cardsOf(state, "ally")[0]?.zone]).toEqual([2, 2, "discard"]);
  });

  it("08055:A:1 leaves a single player's Guardian with 1 counter off and no Forced effect before 0", () => {
    const t = table({ engaged: [{ code: "08040", seat: 0, resources: 2 }], play: [{ code: "ally", seat: 0 }] });
    const { state } = resolveRecords(t.state, t.ctx, "08055", "whenRevealed");
    expect([counters(state, "08040"), cardsOf(state, "ally")[0]?.zone]).toEqual([1, "play"]);
  });

  it("08051:A:2 takes one counter off the picked enemy, and none off a card that has no Time", () => {
    const t = table({ engaged: [{ code: "08041", seat: 0, resources: 3 }, { code: "08050", seat: 0, resources: 3 }] });
    const record = t.ctx.effects.find((effect) => effect.id === "08051:shadow:1");
    const attempt = (target: string): ScenarioState => {
      const pushed = pushEffectFrame(t.state, { frame: "forced", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", names: [target] } }, { verb: "RemoveTimeCounters", target: "picked", amount: 1 }], cancel: null, blockCancel: null, cause: effectCause(record!) }, []);
      return settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
    };
    expect(counters(attempt("Wolf's Guardian"), "08041")).toBe(2);
    expect(counters(attempt("Spirit of the Wild"), "08050")).toBe(3);
    expect(removeTimeCounters(t.state, t.ctx)).toBeDefined();
  });
});

describe("08037:B:1 and 08037:B:2 the Guardians at Perseverance", () => {
  const guarded = () => table({ stage: "08037", engaged: [{ code: "08040", seat: 0 }], staging: ["08041"] });

  it("08037:B:1 cannot be damaged or leave play for a player card while this stage is current, and 08037:B:2 still puts them in the victory display", () => {
    const t = guarded();
    const hurt = run(t, t.state, { verb: "DamageEach", amount: 2, pick: { type: "enemy", control: "any", staging: true, trait: "Guardian" } });
    expect(cardsOf(hurt, "08040")[0]?.damage).toBe(0);
    const { state } = resolveRecords(t.state, t.ctx, "08037", "triggered", idOf(t.state, "08037"));
    expect(state.victory.map((id) => state.cards[id]?.code).sort()).toEqual(["08040", "08041"]);
  });

  it("08037:B:2 adds only the Guardians in play to the victory display, no Barrow and no card out of play, and the quest advances to the one trial left", () => {
    const t = table({ stage: "08037", staging: ["08046"], engaged: [{ code: "08040", seat: 0 }] });
    const { state } = resolveRecords(t.state, t.ctx, "08037", "triggered", idOf(t.state, "08037"));
    expect(state.victory.map((id) => state.cards[id]?.code)).toEqual(["08040"]);
    expect(cardsOf(state, "08046")[0]?.zone).toBe("staging");
    expect(state.questStage && state.cards[state.questStage]?.code).toBe("08038");
  });

  it("08037:B:1 a Guardian takes damage when this stage is not current", () => {
    const t = table({ stage: "08036", engaged: [{ code: "08040", seat: 0 }] });
    const hurt = run(t, t.state, { verb: "DamageEach", amount: 2, pick: { type: "enemy", control: "any", staging: true, trait: "Guardian" } });
    expect(cardsOf(hurt, "08040")[0]?.damage).toBe(2);
  });

  it("08038:B:2 with one stage 2 left it is taken without a question, and with none left the quest advances to stage 3A", () => {
    const one = table({ stage: "08037" });
    const taken = resolveRecords(one.state, one.ctx, "08037", "triggered", idOf(one.state, "08037"));
    expect(taken.state.questStage && taken.state.cards[taken.state.questStage]?.code).toBe("08038");
    const none = table({ stage: "08038", setAside: ["08049", "08040", "08041", "08042", "08043", "08044", "08045", "08046", "08047", "08048"] });
    const over = resolveRecords(none.state, none.ctx, "08038", "triggered", idOf(none.state, "08038"));
    expect(over.state.questStage && over.state.cards[over.state.questStage]?.code).toBe("08039");
  });
});

describe("08047:A:1 Cave Barrow", () => {
  it("08047:A:1 makes the first player discard allies, all seats counted together, until 5 remain, as soon as a sixth enters play", () => {
    const allies = Array.from({ length: 6 }, (_, index) => ({ code: "ally", seat: index % 2 }));
    const t = table({ seats: 2, staging: ["08047"], play: allies });
    const settled = settle({ ...t.state, window: null, mode: "stopped" }, t.ctx, []);
    expect(settled.window?.kind).toBe("choose");
    const options = settled.window?.kind === "choose" ? settled.window.options : [];
    expect(options.length).toBeGreaterThan(0);
    let state = settled;
    for (let guard = 0; guard < 12 && state.window?.kind === "choose"; guard += 1) state = send({ state, steps: [] }, { type: "Choose", optionId: state.window.options[0] ?? "" }, t.ctx).state;
    expect(cardsOf(state, "ally").filter((card) => card.zone === "play")).toHaveLength(5);
  });

  it("08047:A:1 asks nothing with 5 allies in play, or without the Barrow", () => {
    const five = table({ staging: ["08047"], play: Array.from({ length: 5 }, () => ({ code: "ally", seat: 0 })) });
    expect(settle({ ...five.state, window: null, mode: "stopped" }, five.ctx, []).window?.kind).not.toBe("choose");
    const none = table({ play: Array.from({ length: 6 }, () => ({ code: "ally", seat: 0 })) });
    expect(settle({ ...none.state, window: null, mode: "stopped" }, none.ctx, []).window?.kind).not.toBe("choose");
  });
});

describe("08054:A:1 The Guardian's Fury", () => {
  it("08054:A:1 reveals one Guardian from the victory display, with fresh counters, when none is in play", () => {
    const t = table({ victory: ["08040", "08041", "08042"], seed: 7 });
    const { state } = resolveRecords(t.state, t.ctx, "08054", "whenRevealed");
    const back = ["08040", "08041", "08042"].flatMap((code) => cardsOf(state, code)).filter((card) => card.zone !== "victory");
    expect(back).toHaveLength(1);
    expect(back[0]?.resources).toBe(Number(back[0]?.code) - 8040 + 2);
    expect(state.victory).toHaveLength(2);
  });

  it("08054:A:1 makes each Guardian in play attack and reveals none from the victory display", () => {
    const t = table({ victory: ["08042"], engaged: [{ code: "08040", seat: 0 }] });
    const { state } = resolveRecords(t.state, t.ctx, "08054", "whenRevealed");
    expect(state.pendingAttack?.enemyId).toBe(idOf(state, "08040"));
    expect(state.victory).toHaveLength(1);
  });
});
