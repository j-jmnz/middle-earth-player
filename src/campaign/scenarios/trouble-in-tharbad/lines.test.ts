// Rules: rr.active-location, rr.explored, rr.step-6-2, rr.step-6-4-2, rr.step-6-4-3, rr.cancel (data/rules/entries.json); ledger lines 08066:B:3, 08067:B:3, 08076:A:2, 08077:A:2.
// Moments of played quest and combat phases that the spec rows cannot express: the order of two effects, the shared amount of a shadow card.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { drive, idOf, legalIntents, opened, resolveRecords, send, tableFromLayout, where, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "trouble-in-tharbad";
const MUG = "08069";
const STREETS = "08074";
const CROSSING = "08071";
const RUINS = "08076";
const SEEDY_INN = "08077";
const SPY = "08072";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const progressOn = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.progress ?? 0;

describe("quest resolution on the stages", () => {
  it("08066:B:3 the excess progress that explores The Empty Mug goes to stage 1B after the Mug has left play, and each player's threat is lowered by it", () => {
    // Four willpower against the Mug's 4 quest points with 3 progress on it: 1 explores it, the other 3 reach the stage, are canceled and lower the threat 10 to 7.
    const t = table({ stage: "08066", phase: "Quest", active: { code: MUG, progress: 3 }, committed: ["dh1", "dh2"], threat: [10, 0] });
    const done = drive(t, opened(t), (state) => state.phase !== "Quest");
    expect(where(done.state, MUG)).toBe("victory");
    expect(done.state.seats[0]?.threat).toBe(7);
    expect(done.state.cards[done.state.questStage ?? ""]?.progress ?? 0).toBe(0);
  });

  it("08067:B:3 with an active location, it takes progress first and only the excess goes to The Crossing at Tharbad in the staging area", () => {
    // Four willpower less the 2 Threat of The Crossing: 2 progress, 1 explores Streets of Tharbad (1 quest point), the other 1 lands on The Crossing.
    const t = table({ stage: "08067", phase: "Quest", active: STREETS, staging: [CROSSING], committed: ["dh1", "dh2"] });
    const done = drive(t, opened(t), (state) => state.phase !== "Quest");
    expect(where(done.state, STREETS)).not.toBe("activeLocation");
    expect(progressOn(done.state, CROSSING)).toBe(1);
    expect(where(done.state, CROSSING)).toBe("staging");
  });
});

describe("picks with one candidate resolve without a tap", () => {
  it("08067:B:2 the attack branch picks Bellach, the one enemy that can, and the attack begins at once", () => {
    const t = table({ stage: "08067", play: ["08068"], staging: ["08070"], timeCounters: 0 });
    const run = resolveRecords(t.state, t.ctx, "08067", "forced", idOf(t.state, "08067"), (state) => (state.window?.kind === "choose" ? "attack" : ""), true);
    expect(run.state.pendingAttack?.enemyId).toBe(idOf(t.state, "08070"));
    expect(run.state.window?.kind).toBe("defense");
  });

  it("08083:A:2 an undefended attack with the shadow card deals 2 damage to Nalir, the one character it can name, with no pick to tap", () => {
    const t = table({ stage: "08066", play: ["08068"], engaged: [SPY], deck: ["08083"], phase: "Encounter" });
    const nalir = idOf(t.state, "08068");
    const atDefense = drive(t, opened(t), (state) => state.window?.kind === "defense");
    const undefended = send(atDefense, { type: "Undefended", heroId: idOf(t.state, "dh1") }, t.ctx);
    const done = drive(t, undefended, (state) => state.phase !== "Combat" || (state.cards[nalir]?.damage ?? 0) > 0);
    expect(done.state.cards[nalir]?.damage).toBe(2);
  });
});

describe("shadow cards", () => {
  it("08076:A:2 the additional shadow card is dealt at the beginning of the combat phase with the enemy's own (step 6.2): two in all at the defense window", () => {
    // The table starts in the encounter phase, so the combat phase begins (and its Forced effect resolves) in the play.
    const t = table({ stage: "08066", active: RUINS, engaged: [SPY], deck: ["f0", "f0", "f0"], phase: "Encounter" });
    const spy = idOf(t.state, SPY);
    const shadows = (state: ScenarioState): number => (state.cards[spy]?.shadowId ? 1 : 0) + (state.cards[spy]?.extraShadowIds?.length ?? 0);
    const dealtAt: number[] = [];
    const done = drive(t, opened(t), (state) => {
      if (state.phase === "Combat") dealtAt.push(shadows(state));
      return state.window?.kind === "defense";
    });
    expect(done.state.window?.kind).toBe("defense");
    // Both are dealt as the phase begins: the Forced effect's card and then the enemy's own (step 6.2), so the enemy holds two at its defense window and one card is left in the deck.
    expect(dealtAt[0]).toBe(2);
    expect(shadows(done.state)).toBe(2);
    expect(Object.values(done.state.cards).filter((card) => card.zone === "encounterDeck").length).toBe(1);
  });

  it("08077:A:2 X is the damage the attack dealt to the defender after its Defense: 3 Attack, 2 Defense, the threat rises by 1", () => {
    const t = table({ stage: "08066", engaged: [SPY], deck: [SEEDY_INN], phase: "Encounter", threat: [20, 20] });
    const atDefense = drive(t, opened(t), (state) => state.window?.kind === "defense");
    const defended = send(atDefense, { type: "DeclareDefender", defenderId: idOf(atDefense.state, "dh1") }, t.ctx);
    const done = drive(t, defended, (state) => state.phase !== "Combat" || (state.seats[0]?.threat ?? 0) > 20);
    expect(done.state.cards[idOf(done.state, "dh1")]?.damage).toBe(1);
    expect(done.state.seats[0]?.threat).toBe(21);
  });

  it("08077:A:2 X is the damage the attack dealt after a Shield reduced it: 3 Attack undefended, Mithril Shirt takes 1, the threat rises by 2", () => {
    const t = tableFromLayout(SCENARIO, { stage: "08066", engaged: [SPY], deck: [SEEDY_INN], phase: "Encounter", threat: [20, 20], attached: [{ code: "19152", to: "dh1" }] }, { extra: ["19152"] });
    const hero = idOf(t.state, "dh1");
    const atDefense = drive(t, opened(t), (state) => state.window?.kind === "defense");
    let run = send(atDefense, { type: "Undefended", heroId: hero }, t.ctx);
    // The Shirt's Response reduces the 3 damage by 1; the shadow card then reads the 2 that were dealt.
    for (let guard = 0; guard < 40 && run.state.phase === "Combat" && (run.state.seats[0]?.threat ?? 0) === 20; guard += 1) {
      const shirt = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Trigger");
      run = shirt ? send(run, shirt, t.ctx) : drive(t, run, (state) => (state.seats[0]?.threat ?? 0) > 20 || legalIntents(state, t.ctx).some((intent) => intent.type === "Trigger") || state.phase !== "Combat");
    }
    expect(run.state.cards[hero]?.damage).toBe(2);
    expect(run.state.seats[0]?.threat).toBe(22);
  });
});
