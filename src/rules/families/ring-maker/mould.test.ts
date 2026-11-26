// Rules: rm.scour, rr.setup, rr.search, rr.enters-play, rr.ownership-and-control, rr.attachment-cards, rr.quest-advancement, rr.immune, rr.engaged (data/rules/entries.json); ledger lines 08122:A:1, 08122:B:4, 08123:A:1, 08123:B:3, 08123:B:4, 08127:A:1, 08127:A:2, 08130:A:1.
// Celebrimbor's Mould and the two stages that hold it: the Setup's attachment, the claim once nothing holds it, the loss when its hero leaves play, the attack that comes before the Mould passes to Bellach and the stages that wait for it.
import { describe, expect, it } from "vitest";

import { settle } from "../../engine/machine.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { holds } from "../../interpret/conditions.ts";
import { finish, idOf, opened, resolveRecords, run, send, type Run, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { modifiedStat } from "../../core/modified-stat.ts";

const SCENARIO = "celebrimbors-secret";
const MOULD = "08127";
const CHAMBER = "08126";
const BELLACH = "08124";
const PLAZA = "08130";
const TOWER = "08131";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const hostCode = (state: ScenarioState, code = MOULD): string | undefined => {
  const host = state.cards[idOf(state, code)]?.host;
  return host ? state.cards[host]?.code : undefined;
};

describe("Setup (08122:A:1)", () => {
  it("08122:A:1 the Mould is attached to The Secret Chamber and each player adds a different Ost-in-Edhil location, the Plaza taking its damage", () => {
    const t = table({ seats: 2, staging: [CHAMBER, BELLACH], setAside: [MOULD], deck: [PLAZA, PLAZA, TOWER, "f0"] });
    const done = resolveRecords(t.state, t.ctx, "08122", "setup", t.state.questStage ?? "");
    expect(hostCode(done.state)).toBe(CHAMBER);
    expect(done.state.cards[idOf(done.state, MOULD)]).toMatchObject({ zone: "attached", claimed: true });
    const staged = done.state.staging.map((id) => done.state.cards[id]?.code);
    expect(staged.filter((code) => code === PLAZA || code === TOWER).sort()).toEqual([PLAZA, TOWER]);
    expect(done.state.cards[idOf(done.state, PLAZA)]?.damage).toBe(1);
  });
});

describe("Celebrimbor's Mould (08127:A:1, 08127:A:2)", () => {
  it("08127:A:1 once the Chamber it lies on leaves play the Mould returns to the staging area and the first player attaches it to a hero he controls", () => {
    const t = table({ seats: 1, staging: [CHAMBER], setAside: [MOULD], attached: [] });
    const attached = resolveRecords(t.state, t.ctx, "08122", "setup", t.state.questStage ?? "").state;
    expect(hostCode(attached)).toBe(CHAMBER);
    const gone = settle({ ...moveCard(attached, idOf(attached, CHAMBER), { zone: "encounterDiscard" }), mode: "stopped", window: null }, t.ctx, []);
    const claimed = finish({ state: gone, steps: [] }, t.ctx).state;
    expect(claimed.cards[idOf(claimed, MOULD)]).toMatchObject({ zone: "attached", claimed: true });
    expect(claimed.cards[claimed.cards[idOf(claimed, MOULD)]?.host ?? ""]?.zone).toBe("heroes");
  });

  it("08127:A:2 the players lose when the hero it is attached to leaves play", () => {
    const t = table({ seats: 1, attached: [{ code: MOULD, to: "dh1" }] });
    const synced = opened(t).state;
    const dead = run(t, synced, { verb: "DamageCard", amount: 20, target: "self" }, { sourceId: t.hero });
    expect(dead.cards[t.hero]?.zone).toBe("discard");
    expect(dead.lost).toBe(true);
  });

  it("08127:A:2 with the Mould on Bellach, Bellach leaving play loses nothing and the Mould goes back to a hero", () => {
    const t = table({ seats: 1, staging: [BELLACH], attached: [{ code: MOULD, to: BELLACH, encounter: true }] });
    const mould = idOf(t.state, MOULD);
    const onBellach = opened(t, updateCard(t.state, mould, { claimed: true })).state;
    expect(modifiedStat(onBellach, onBellach.cards[mould]!, "attack", t.cards)).toBeGreaterThanOrEqual(0);
    const gone = settle({ ...moveCard(onBellach, idOf(onBellach, BELLACH), { zone: "victory" }), mode: "stopped", window: null }, t.ctx, []);
    expect(gone.lost).not.toBe(true);
    const claimed = finish({ state: gone, steps: [] }, t.ctx).state;
    expect(claimed.cards[mould]?.zone).toBe("attached");
    expect(claimed.cards[claimed.cards[mould]?.host ?? ""]?.zone).toBe("heroes");
  });
});

describe("The stages that wait for the Mould (08122:B:4, 08123:B:4)", () => {
  it("08122:B:4 the stage holds its progress while the Mould is not on a hero and advances the moment it is attached", () => {
    const t = table({ seats: 1, staging: [CHAMBER], progress: 14, attached: [{ code: MOULD, to: CHAMBER, encounter: true }] });
    const stage = t.state.questStage ?? "";
    const held = settle({ ...opened(t).state, mode: "stopped", window: null }, t.ctx, []);
    expect(held.questStage).toBe(stage);
    expect(held.cards[stage]?.progress).toBe(14);
    const onHero = settle({ ...attachTo(held, idOf(held, MOULD), t.hero), mode: "stopped", window: null }, t.ctx, []);
    expect(onHero.questStage).not.toBe(stage);
  });

  it("08123:B:4 the last stage is not defeated while the Mould is on Bellach, and the players win once a hero holds it", () => {
    const t = table({ seats: 1, stage: "08123", staging: [BELLACH], progress: 12, attached: [{ code: MOULD, to: BELLACH, encounter: true }] });
    const held = settle({ ...opened(t).state, mode: "stopped", window: null }, t.ctx, []);
    expect(held.stageCleared).not.toBe(true);
    const won = settle({ ...attachTo(held, idOf(held, MOULD), t.hero), mode: "stopped", window: null }, t.ctx, []);
    expect(won.stageCleared).toBe(true);
  });
});

describe("The Enemy's Servant (08123:A:1, 08123:B:3)", () => {
  it("08123:A:1 Bellach attacks the player who controls the Mould, and the Mould is attached to Bellach once that attack is over", () => {
    const t = table({ seats: 1, stage: "08123", side: "A", staging: [BELLACH], attached: [{ code: MOULD, to: "dh1" }] });
    const start = opened(t).state;
    expect(hostCode(start)).toBe("dh1");
    const revealed = resolveRecords(start, t.ctx, "08123", "whenRevealed", start.questStage ?? "");
    expect(revealed.state.pendingAttack).toMatchObject({ enemyId: idOf(start, BELLACH), seat: 0 });
    // The attack is under way: the Mould is still on the hero.
    expect(hostCode(revealed.state)).toBe("dh1");
    let current: Run = { state: revealed.state, steps: [] };
    for (let guard = 0; guard < 20 && (current.state.pendingAttack != null || current.state.window?.kind === "defense"); guard += 1) {
      current = current.state.window?.kind === "defense" ? send(current, { type: "Undefended", heroId: t.hero }, t.ctx) : send(current, { type: "Pass" }, t.ctx);
    }
    expect(current.state.pendingAttack).toBeNull();
    expect(hostCode(current.state)).toBe(BELLACH);
  });

  it("08123:B:3 Bellach is immune and cannot be engaged until the stage holds 12 progress", () => {
    const low = table({ seats: 1, stage: "08123", staging: [BELLACH], progress: 11 });
    const lowState = opened(low).state;
    expect(modifiedStat(lowState, lowState.cards[idOf(lowState, BELLACH)]!, "cannotBeEngaged", low.cards)).toBe(1);
    const high = table({ seats: 1, stage: "08123", staging: [BELLACH], progress: 12 });
    const highState = opened(high).state;
    expect(modifiedStat(highState, highState.cards[idOf(highState, BELLACH)]!, "cannotBeEngaged", high.cards)).toBe(0);
  });
});
void holds;
