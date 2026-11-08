// Rules: mec112.pursuit, mec112.setup-the-uruk-hai, rr.in-play-and-out-of-play, rr.ownership-and-control, rr.quest-advancement, rr.step-3-3, rr.refresh-phase, rr.combat-phase, rr.destroy (data/rules/entries.json); ledger lines
// 143069:A:1 to 143070:B:3, 143022:A:1 to 143024:A:2. The two stages of The Uruk-hai, To Isengard!, Uglúk and Grishnákh on the scenario's scene: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { canAttack } from "../../../rules/combat/combat.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { placeDamage } from "../../../rules/core/keywords.ts";
import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { defenseBlocked, restricted } from "../../../rules/interpret/restrictions.ts";
import { CODES, haiTable, idOf, legalIntents, loadHaiWorld, resolveRecords, send, start, type HaiWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/the-uruk-hai/scene.ts";
import { revealFromTop } from "../../../../test/harness/scene-kit.ts";

let world: HaiWorld;
beforeAll(async () => {
  world = await loadHaiWorld();
  world.cards.set("fel", definePrinted({ code: "fel", name: "fel", type: "hero", sphere: "fellowship", threat: 8, willpower: 2, attack: 2, defense: 2, health: 6 }));
  world.cards.set("q9", definePrinted({ code: "q9", name: "q9", type: "hero", sphere: "tactics", threat: 8, willpower: 2, attack: 2, defense: 2, health: 6 }));
}, 120_000);

const stageId = (state: ScenarioState): string => state.questStage ?? "";
const settled = (t: ReturnType<typeof haiTable>, state: ScenarioState): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, []);
const logged = (state: ScenarioState, captives: readonly { seat: number; hero: string }[]): ScenarioState => ({
  ...state,
  campaignFacts: { prisoner: null, usedOnce: [], counters: {}, heroLog: { heroes: [["dh1", "dh2"], ["dh3"]], fallen: [[], []], fellowship: ["fel"], captives } },
});
// The context holding the one record with this id (a card's other Forced effects are not part of the test).
const only = (ctx: ReturnType<typeof haiTable>["ctx"], id: string): ReturnType<typeof haiTable>["ctx"] => ({ ...ctx, effects: ctx.effects.filter((effect) => effect.id === id) });
// A Setup answered by choosing the card with this id.
const choosing = (id: string) => (state: ScenarioState): string => (state.window?.kind === "choose" && state.window.options.includes(id) ? id : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));

describe("143069 Follow the Orcs, side A: Setup (143069:A:1)", () => {
  const setup = (layout: Parameters<typeof haiTable>[1], tweak: (state: ScenarioState) => ScenarioState = (state) => state, pick?: (state: ScenarioState) => string) => {
    const t = haiTable(world, { phase: "Planning", staging: [CODES.toIsengard, CODES.ugluk], ...layout });
    const state = tweak(t.state);
    const run = resolveRecords(state, t.ctx, CODES.stage1, "setup", stageId(state), pick);
    return { t, run };
  };

  it("each player chooses a non-Fellowship hero they control to be a Captive faceup under To Isengard!, and the pursuit value is set to 10", () => {
    const { t, run } = setup({}, (state) => spawn(state, "fel", { zone: "heroes", seat: 0 }).state, (state) => {
      // The Fellowship hero is not offered.
      expect(state.window?.kind === "choose" ? state.window.options : []).toEqual([expect.any(String), expect.any(String)]);
      return state.window?.kind === "choose" ? (state.window.options.find((id) => state.cards[id]?.code === "dh2") ?? "") : "";
    });
    const captive = run.state.cards[t.hero2]!;
    expect(captive).toMatchObject({ zone: "captive", host: idOf(run.state, CODES.toIsengard), face: "up", controller: null, captive: true });
    expect(run.state.pursuit).toBe(10);
    expect(run.state.seats[0].heroes).toHaveLength(2);
    expect(run.state.seats[0].heroes).not.toContain(t.hero2);
  });

  it("with two players each seat's Captive is its own: a seat whose only hero is held stays in the game", () => {
    const { t, run } = setup({ seats: 2 }, undefined, (state) => choosing(t0(state))(state));
    const held = Object.values(run.state.cards).filter((card) => card.captive === true);
    expect(held).toHaveLength(2);
    expect(held.map((card) => card.owner).sort()).toEqual([0, 1]);
    expect(run.state.seats[1].eliminated).not.toBe(true);
    expect(t.state.pursuit).toBeUndefined();
    expect(run.state.pursuit).toBe(10);
  });

  it("in Campaign Mode a seat whose log names a captive takes that hero without being asked (user ruling, 2026-11-08)", () => {
    let asked = 0;
    const { t, run } = setup({}, (state) => logged(state, [{ seat: 0, hero: "dh2" }]), (state) => {
      asked += 1;
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    expect(asked).toBe(0);
    expect(run.state.cards[t.hero2]).toMatchObject({ zone: "captive", captive: true });
    expect(run.state.cards[t.hero]?.zone).toBe("heroes");
  });

  it("a seat with no logged captive, in a log that names one for another seat, chooses as in standalone", () => {
    let asked = 0;
    const { t, run } = setup({ seats: 2 }, (state) => spawn(logged(state, [{ seat: 1, hero: "dh3" }]), "q9", { zone: "heroes", seat: 1 }).state, (state) => {
      asked += 1;
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    void t;
    // Seat 0 chose (two heroes); seat 1 took its logged hero.
    expect(asked).toBeGreaterThan(0);
    const held = Object.values(run.state.cards).filter((card) => card.captive === true);
    expect(held.map((card) => card.code).sort()).toEqual(["dh1", "dh3"]);
  });

  it("a fresh log (no captive named) is a choice, as in standalone", () => {
    let asked = 0;
    const { run } = setup({}, (state) => logged(state, []), (state) => {
      asked += 1;
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    expect(asked).toBeGreaterThan(0);
    expect(Object.values(run.state.cards).filter((card) => card.captive === true)).toHaveLength(1);
  });
});

// The first hero of seat 0's heroes, for a pick that must name one.
function t0(state: ScenarioState): string {
  return state.seats[0].heroes[1] ?? "";
}

describe("143069 Follow the Orcs, side B", () => {
  it("143069:B:2 Uglúk cannot take damage or leave the staging area (cannot be engaged) while stage 1 is the current quest", () => {
    const t = haiTable(world, { stage: CODES.stage1, staging: [CODES.ugluk] });
    const ugluk = idOf(t.state, CODES.ugluk);
    expect(flagged(t.state, ugluk, "cannotTakeDamage")).toBe(true);
    expect(flagged(t.state, ugluk, "cannotBeEngaged")).toBe(true);
    const hurt = placeDamage(t.state, ugluk, 3, world.cards, [], "framework", UNATTRIBUTED);
    expect(hurt.cards[ugluk]?.damage).toBe(0);
    // Stage 2 does not hold him there.
    const later = haiTable(world, { stage: CODES.stage2, staging: [CODES.ugluk] });
    expect(flagged(later.state, idOf(later.state, CODES.ugluk), "cannotTakeDamage")).toBe(false);
    expect(flagged(later.state, idOf(later.state, CODES.ugluk), "cannotBeEngaged")).toBe(false);
  });

  it("143069:B:3 at the end of the combat phase the pursuit value rises by 1 for each enemy in the staging area, Uglúk included", () => {
    const t = haiTable(world, { stage: CODES.stage1, pursuit: 10, phase: "Combat", staging: [CODES.ugluk, "f0", "f3", CODES.theWold] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage1, "forced", stageId(t.state));
    // Three enemies, one location.
    expect(run.state.pursuit).toBe(13);
  });

  it("143069:B:3 is heard at the end of the combat phase, not at the end of another phase", () => {
    const t = haiTable(world, { stage: CODES.stage1, pursuit: 10, phase: "Combat", staging: [CODES.ugluk, "f0"] });
    let run = start(t.state);
    for (let guard = 0; guard < 12 && run.state.phase === "Combat" && run.state.window?.kind === "pass"; guard += 1) run = send(run, { type: "Pass" }, t.ctx);
    expect(run.state.phase).not.toBe("Combat");
    expect(run.state.pursuit).toBe(12);
  });
});

describe("143070 Rescue the Captives", () => {
  it("143070:A:1 each player searches the encounter deck and discard pile for an Uruk-hai enemy, reveals it and adds it to the staging area; the deck is shuffled", () => {
    const t = haiTable(world, { seats: 2, stage: CODES.stage2, deck: ["f0", CODES.urukHaiFighter, "f3"], discard: [CODES.urukHaiFighter], staging: [CODES.toIsengard] });
    // The Uruk-hai Fighters have no When Revealed: the reveal only places them.
    const run = resolveRecords(t.state, t.ctx, CODES.stage2, "whenRevealed", stageId(t.state));
    const fighters = run.state.staging.filter((id) => run.state.cards[id]?.code === CODES.urukHaiFighter);
    expect(fighters).toHaveLength(2);
    expect(run.state.encounterDeck.map((id) => run.state.cards[id]?.code).sort()).toEqual(["f0", "f3"]);
    expect(run.state.encounterDiscard).toEqual([]);
  });

  it("143070:B:2 after an enemy is defeated the players may reduce the pursuit value by 1", () => {
    const t = haiTable(world, { stage: CODES.stage2, pursuit: 12, phase: "Combat", engaged: ["f0"] });
    const enemy = t.state.seats[0].engaged[0] ?? "";
    const killed = settled(t, placeDamage(t.state, enemy, 3, world.cards, [], "framework", UNATTRIBUTED));
    const offered = legalIntents(killed, t.ctx).find((intent): intent is Extract<PlayerIntent, { type: "Trigger" }> => intent.type === "Trigger" && intent.effectId === "143070:response:1");
    expect(offered).toBeDefined();
    const run = send({ state: killed, steps: [] }, offered as PlayerIntent, t.ctx);
    expect(run.state.pursuit).toBe(11);
    // The tracker stops at 0.
    const low = resolveRecords({ ...t.state, pursuit: 0 }, t.ctx, CODES.stage2, "response", stageId(t.state));
    expect(low.state.pursuit).toBe(0);
  });

  it("143070:B:3 the players cannot defeat the stage while Uglúk is in play; once he is gone the stage is defeated and they win", () => {
    const t = haiTable(world, { stage: CODES.stage2, pursuit: 10, progress: 10, staging: [CODES.ugluk] });
    expect(restricted(t.state, t.ctx, "advance")).toHaveLength(1);
    const held = settled(t, t.state);
    expect(held.questStage).toBe(stageId(t.state));
    expect(held.stageCleared).not.toBe(true);
    const gone = moveCard(held, idOf(held, CODES.ugluk), { zone: "victory" });
    const won = settled(t, syncOf(t, gone));
    expect(won.stageCleared).toBe(true);
    expect(won.lost).not.toBe(true);
  });

  it("143070:B:1 the stage needs the pursuit value in progress: a lower value defeats it sooner", () => {
    const t = haiTable(world, { stage: CODES.stage2, pursuit: 10, progress: 8 });
    expect(settled(t, t.state).stageCleared).not.toBe(true);
    const lower = settled(t, syncOf(t, { ...t.state, pursuit: 8 }));
    expect(lower.stageCleared).toBe(true);
  });
});

function syncOf(t: ReturnType<typeof haiTable>, state: ScenarioState): ScenarioState {
  return settle({ ...state, window: null, mode: "stopped" }, t.ctx, []);
}

describe("143022 To Isengard!", () => {
  it("143022:A:2 at the end of the refresh phase the pursuit value rises by 1; at 30 or more the players lose, below it they do not", () => {
    const t = haiTable(world, { captives: ["hero2"], pursuit: 27, phase: "Refresh" });
    const one = resolveRecords(t.state, t.ctx, CODES.toIsengard, "forced", idOf(t.state, CODES.toIsengard));
    expect(one.state.pursuit).toBe(28);
    expect(one.state.lost).not.toBe(true);
    const last = resolveRecords({ ...t.state, pursuit: 29 }, t.ctx, CODES.toIsengard, "forced", idOf(t.state, CODES.toIsengard));
    expect(last.state.pursuit).toBe(30);
    expect(last.state.lost).toBe(true);
    expect(last.state.lossReason).toBe("The pursuit value reached 30");
  });

  it("143022:A:2 is heard at the end of the refresh phase", () => {
    const t = haiTable(world, { captives: ["hero2"], pursuit: 10, phase: "Refresh" });
    // The refresh phase is automatic: the round engine settles it and goes on to the next round.
    const after = settle(t.state, t.ctx, []);
    expect(after.pursuit).toBe(11);
    expect(after.phase).not.toBe("Refresh");
  });

  it("143022:A:1 the players lose when no Captive is in play", () => {
    const t = haiTable(world, { staging: [CODES.toIsengard] });
    expect(settled(t, t.state).lost).toBe(true);
    expect(settled(t, t.state).lossReason).toContain("To Isengard!");
  });
});

describe("143023 Uglúk", () => {
  it("143023:A:2 allies cannot be declared as attackers or defenders against Uglúk; heroes can", () => {
    const t = haiTable(world, { stage: CODES.stage2, engaged: [CODES.ugluk], play: ["ally"] });
    const ugluk = idOf(t.state, CODES.ugluk);
    const ally = idOf(t.state, "ally");
    expect(canAttack(t.state, 0, ally, ugluk, world.cards)).toBe(false);
    expect(canAttack(t.state, 0, t.hero, ugluk, world.cards)).toBe(true);
    // A defender: the rule is read against the attack in progress.
    const attacked = { ...t.state, pendingAttack: { enemyId: ugluk, seat: 0 } } as unknown as ScenarioState;
    expect(defenseBlocked(attacked, t.ctx, ally)).toBe(true);
    expect(defenseBlocked(attacked, t.ctx, t.hero)).toBe(false);
  });
});

describe("143024 Grishnákh", () => {
  const reveal = (layout: Parameters<typeof haiTable>[1] = {}, pick?: (state: ScenarioState) => string) => {
    const t = haiTable(world, { seats: 2, captives: ["hero2", "seat1"], stage: CODES.stage1, ...layout });
    const steps: Parameters<typeof revealFromTop>[3] = [];
    const revealed = revealFromTop(t.state, t.ctx, CODES.grishnakh, steps);
    let run = { state: revealed.state, steps };
    for (let guard = 0; guard < 8 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: pick?.(run.state) ?? run.state.window.options[0] ?? "" }, t.ctx);
    return { t, run, id: revealed.id };
  };

  it("143024:A:1 after Grishnákh enters play the first player attaches 1 of the Captives to him", () => {
    const { t, run, id } = reveal({}, (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === haiTable(world).hero2 || state.cards[option]?.code === "dh3") ?? state.window.options[0] ?? "") : ""));
    const held = Object.values(run.state.cards).filter((card) => card.captive === true && card.host === id);
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ zone: "captive", face: "up" });
    // The other Captive is still under To Isengard!.
    expect(Object.values(run.state.cards).filter((card) => card.captive === true && card.host === idOf(run.state, CODES.toIsengard))).toHaveLength(1);
    void t;
  });

  it("143024:A:1 with a single Captive there is nothing to choose: it is attached at once", () => {
    const { run, id } = reveal({ seats: 1, captives: ["hero2"] });
    expect(run.state.window?.kind === "choose").toBe(false);
    expect(Object.values(run.state.cards).filter((card) => card.captive === true && card.host === id)).toHaveLength(1);
  });

  it("143024:A:2 at the end of the quest phase 1 damage is dealt to the attached Captive", () => {
    const { t, run, id } = reveal({ seats: 1, captives: ["hero2"] });
    const damaged = resolveRecords(run.state, only(t.ctx, "143024:forced:3"), CODES.grishnakh, "forced", id).state;
    // The hold has been placed by the reveal; the end of the quest phase deals the damage.
    expect(Object.values(damaged.cards).find((card) => card.captive === true)?.damage).toBeGreaterThanOrEqual(1);
  });

  it("143024:A:2 is heard at the end of the quest phase, and a Captive that takes lethal damage is destroyed to its owner's discard pile", () => {
    const { t, run, id } = reveal({ seats: 2, captives: ["hero2", "seat1"], phase: "Quest" }, (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => state.cards[option]?.code === "dh2") ?? "") : ""));
    const captive = Object.values(run.state.cards).find((card) => card.captive === true && card.host === id)!;
    const hurt = updateCard(run.state, captive.id, { damage: captive.damage + 5 });
    // A last bit of the quest phase: the Forced effect deals 1 damage, which is lethal (6 hit points).
    const after = resolveRecords(hurt, only(t.ctx, "143024:forced:3"), CODES.grishnakh, "forced", id).state;
    const owner = after.cards[captive.id];
    expect(owner?.zone).toBe("discard");
    expect(after.seats[captive.owner ?? 0].discard).toContain(captive.id);
    // The other Captive is still in play: the players have not lost.
    expect(after.lost).not.toBe(true);
  });

  it("143024:A:1 when Grishnákh is defeated the attached Captive goes faceup under To Isengard!", () => {
    const { t, run, id } = reveal({ seats: 1, captives: ["hero2"] });
    const killed = settle(placeDamage(run.state, id, 5, world.cards, [], "framework", UNATTRIBUTED), t.ctx, []);
    const finished = finishWindows(killed, t);
    expect(finished.cards[id]?.zone).toBe("victory");
    const captive = Object.values(finished.cards).find((card) => card.captive === true)!;
    expect(captive).toMatchObject({ zone: "captive", host: idOf(finished, CODES.toIsengard), face: "up" });
  });

  it("143024:A:1 any other way Grishnákh leaves play puts the Captive under To Isengard! too, never in a discard pile (user ruling, 2026-11-08)", () => {
    const { t, run, id } = reveal({ seats: 1, captives: ["hero2"] });
    const gone = settle(moveCard(run.state, id, { zone: "encounterDiscard" }), t.ctx, []);
    const finished = finishWindows(gone, t);
    const captive = Object.values(finished.cards).find((card) => card.captive === true)!;
    expect(captive).toMatchObject({ zone: "captive", host: idOf(finished, CODES.toIsengard) });
    expect(finished.lost).not.toBe(true);
  });
});

// Passes the Responses and answers the choices an event left open.
function finishWindows(state: ScenarioState, t: ReturnType<typeof haiTable>): ScenarioState {
  let run: Run = { state: { ...state, mode: "stopped" }, steps: [] };
  for (let guard = 0; guard < 10 && (run.state.window?.kind === "response" || run.state.window?.kind === "choose"); guard += 1) {
    const intent = run.state.window?.kind === "choose" ? ({ type: "Choose", optionId: run.state.window.options[0] ?? "" } as PlayerIntent) : (legalIntents(run.state, t.ctx).find((offered) => offered.type === "Pass") as PlayerIntent);
    run = send(run, intent, t.ctx);
  }
  return run.state;
}
