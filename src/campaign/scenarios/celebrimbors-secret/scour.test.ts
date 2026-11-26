// Rules: rm.scour, rr.first-player, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 08122:B:2, 08123:A:1, 08124:A:2, 08131:A:2, 08132:A:1, 08133:A:1, 08134:A:1. The Scour keyword: TriggerScour resolves the scour effect of each card in the scope, in the order the first player chooses.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { idOf, idsOf, resolveRecords, run, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "celebrimbors-secret";
const BELLACH = "08124";
const SCOUT = "08128";
const TOWER = "08131";
const FOUNDATION = "08132";
const PLAZA = "08130";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const damage = (state: ScenarioState, code: string, at = 0): number => state.cards[idsOf(state, code)[at] ?? ""]?.damage ?? 0;
const SCOUR_IN_PLAY = { verb: "TriggerScour", scope: "inPlay" } as const;
const SCOUR_TOP = { verb: "TriggerScour", scope: "topmostDiscard" } as const;

describe("TriggerScour in play (rm.scour)", () => {
  it("does nothing when no card in play has a Scour effect", () => {
    const t = table({ staging: [PLAZA] });
    expect(run(t, t.state, SCOUR_IN_PLAY).cards[idOf(t.state, PLAZA)]?.damage).toBe(0);
  });

  it("08131:A:2 resolves the one Scour card at once: the Tower returns to the staging area from the active location and takes 2 damage", () => {
    const t = table({ active: TOWER });
    const state = run(t, t.state, SCOUR_IN_PLAY);
    const tower = state.cards[idOf(state, TOWER)];
    expect(tower?.zone).toBe("staging");
    expect(tower?.damage).toBe(2);
    expect(state.activeLocation).toBeNull();
  });

  it("08122:B:2 asks the first player which of two Scour cards with different titles resolves first, and resolves both", () => {
    const t = table({ staging: [SCOUT, TOWER], active: PLAZA });
    const stage = t.state.questStage ?? "";
    let options: string[] = [];
    const picked = resolveRecords(t.state, t.ctx, "08122", "forced", stage, (state) => {
      options = state.window?.kind === "choose" ? [...state.window.options] : options;
      return idOf(t.state, TOWER);
    });
    expect(options.sort()).toEqual([idOf(t.state, SCOUT), idOf(t.state, TOWER)].sort());
    expect(picked.state.window).toBeNull();
    // The Scout put 1 damage on the active location (the Plaza); the Tower went to the staging area with 2 damage; the stage took 3 time counters.
    expect(damage(picked.state, PLAZA)).toBe(1);
    expect(damage(picked.state, TOWER)).toBe(2);
    expect(picked.state.cards[stage]?.resources).toBe(3);
  });

  it("08124:A:2 fixes the set at the start: a Scour card that enters play during the trigger does not resolve", () => {
    const t = table({ staging: [BELLACH], active: PLAZA, deck: [SCOUT] });
    const picked = resolveRecords(t.state, t.ctx, "08122", "forced", t.state.questStage ?? "");
    // Bellach's scour added the Scout to the staging area from the encounter deck; the Scout's own scour (1 damage on the active location) did not resolve in this trigger.
    expect(picked.state.cards[idOf(picked.state, SCOUT)]?.zone).toBe("staging");
    expect(damage(picked.state, PLAZA)).toBe(0);
  });
});

describe("TriggerScour from the discard pile (08133:A:1)", () => {
  it("resolves the Scour card nearest the top of the encounter discard pile, from there, and it stays", () => {
    const t = table({ discard: [FOUNDATION, TOWER, PLAZA], staging: [SCOUT] });
    const state = run(t, t.state, SCOUR_TOP);
    const tower = state.cards[idOf(state, TOWER)];
    expect(tower?.zone).toBe("staging");
    expect(tower?.damage).toBe(2);
    expect(state.cards[idOf(state, FOUNDATION)]?.zone).toBe("encounterDiscard");
  });

  it("does nothing when no card in the discard pile has a Scour effect", () => {
    const t = table({ discard: [PLAZA], staging: [TOWER] });
    const state = run(t, t.state, SCOUR_TOP);
    expect(damage(state, TOWER)).toBe(0);
    expect(updateCard(moveCard(state, idOf(state, PLAZA), { zone: "encounterDiscard" }), idOf(state, PLAZA), {}).cards[idOf(state, PLAZA)]?.zone).toBe("encounterDiscard");
  });
});

describe("Prowling Orc's Scour (08129:A:2)", () => {
  const ORC = "08129";
  it("08129:A:2 in the staging area it engages the player with the highest threat and attacks him", () => {
    const t = table({ seats: 2, staging: [ORC], threat: [30, 35] });
    const picked = resolveRecords(t.state, t.ctx, "08122", "forced", t.state.questStage ?? "");
    const orc = picked.state.cards[idOf(picked.state, ORC)];
    expect(orc).toMatchObject({ zone: "engaged", controller: 1 });
    expect(picked.state.pendingAttack).toMatchObject({ enemyId: orc?.id, seat: 1 });
  });

  it("08133:A:1 lying in the discard pile it engages and attacks from there, and it leaves the pile", () => {
    const t = table({ seats: 2, discard: [ORC], staging: ["08133"], threat: [35, 30] });
    const city = idOf(t.state, "08133");
    const picked = resolveRecords(t.state, t.ctx, "08133", "forced", city);
    const orc = picked.state.cards[idOf(picked.state, ORC)];
    expect(orc).toMatchObject({ zone: "engaged", controller: 0 });
    expect(picked.state.encounterDiscard).not.toContain(orc?.id);
    expect(picked.state.pendingAttack).toMatchObject({ enemyId: orc?.id });
  });
});

describe("Ancient Foundation's Scour does not stack (08132:A:1)", () => {
  it("two copies in play assign damage once: X is the locations in play", () => {
    const t = table({ staging: [FOUNDATION, FOUNDATION, PLAZA], active: TOWER });
    const state = run(t, t.state, SCOUR_IN_PLAY);
    // 4 locations in play (three staged, one active): 4 damage assigned in all, once.
    let total = 0;
    for (const code of [FOUNDATION, PLAZA, TOWER]) for (const id of idsOf(state, code)) total += state.cards[id]?.damage ?? 0;
    expect(total).toBeLessThanOrEqual(4);
  });

  it("08132:A:1 the copy in the discard pile scours alone, whatever copy is in play: X is the one location in play", () => {
    const t = table({ staging: [FOUNDATION], discard: [FOUNDATION] });
    const state = run(t, t.state, SCOUR_TOP);
    const inPlay = idsOf(state, FOUNDATION).filter((id) => state.cards[id]?.zone === "staging");
    const discarded = idsOf(state, FOUNDATION).filter((id) => state.cards[id]?.zone === "encounterDiscard");
    expect(inPlay).toHaveLength(1);
    expect(discarded).toHaveLength(1);
    expect(state.cards[inPlay[0] ?? ""]?.damage).toBe(1);
  });
});
