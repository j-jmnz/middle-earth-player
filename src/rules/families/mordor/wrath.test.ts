// Rules: vom.controlling-locations, vom.losing-control-of-a-location, rr.destroy, rr.damage, rr.staging-area, rr.active-location (data/rules/entries.json); ledger lines 22016:A:1, 22017:A:2, 22018:A:2, 22019:A:2, 22025:B:3, 22026:B:2.
// The pieces Wrath and Ruin adds to the shared engine, each on a table of the scenario: TakeControlOfLocation with `who: actor`, the trigger `controlTaken`, the condition `controlsOutnumberStaging`, and the flag `healsInsteadOfDestroyed`.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { placeDamage } from "../../core/damage.ts";
import { ruleCause } from "../../core/cause.ts";
import { settle } from "../../engine/machine.ts";
import { holds } from "../../interpret/conditions.ts";
import { controlledLocations, controllerOf } from "../pelargir/location-control.ts";
import type { EngineStep } from "../../core/intents.ts";
import { advanceFreed } from "../../quest/stage-reveal.ts";
import { idOf, opened, resolveRecords, run, tableFromLayout, where, type Layout } from "../../../../test/harness/scene-kit.ts";

const HOUSE = "22016";
const FORTIFICATION = "22017";
const TOWER = "22018";
const FURY = "22019";
const WARRIOR = "21021";
const SQUARE = "22015";
const CITY_FORUM = "21046";
const table = (layout: Layout = {}) => tableFromLayout("wrath-and-ruin", { seats: 2, stage: "22025", phase: "Quest", ...layout });
const settled = (made: { ctx: Parameters<typeof settle>[1] }, state: ScenarioState): ScenarioState => settle(state, made.ctx, []);

describe("TakeControlOfLocation: `who: actor` gives the location to the player who resolves the effect (22016:A:1)", () => {
  it("the first player takes it by default, the acting player when the instruction says so", () => {
    const made = table({ firstPlayer: 0, staging: [HOUSE, SQUARE] });
    const state = opened(made).state;
    const byDefault = run(made, state, { verb: "TakeControlOfLocation", card: "self" }, { seat: 1, sourceId: idOf(state, HOUSE) });
    expect(controllerOf(byDefault, idOf(state, HOUSE))).toBe(0);
    const actor = run(made, state, { verb: "TakeControlOfLocation", card: "self", who: "actor" }, { seat: 1, sourceId: idOf(state, HOUSE) });
    expect(controllerOf(actor, idOf(state, HOUSE))).toBe(1);
    expect(actor.cards[idOf(state, HOUSE)]).toMatchObject({ zone: "play", controller: 1 });
  });
});

describe("controlTaken: announced after a player takes control, heard by the location's own Forced effect (22017:A:2, 22018:A:2)", () => {
  it("Makeshift Fortification returns the topmost enemy of the encounter discard pile to the staging area", () => {
    const made = table({ staging: [FORTIFICATION], discard: [WARRIOR, "21020"] });
    const state = opened(made).state;
    const taken = settled(made, run(made, state, { verb: "TakeControlOfLocation", card: "self" }, { sourceId: idOf(state, FORTIFICATION) }));
    expect(where(taken, "21020")).toBe("staging");
    expect(where(taken, WARRIOR)).toBe("encounterDiscard");
  });

  it("Captured Tower puts the first enemy the shuffled discard pile gives into play engaged with the player who took control", () => {
    const made = table({ firstPlayer: 0, staging: [TOWER], discard: [WARRIOR], deck: ["21016"] });
    const state = opened(made).state;
    const taken = settled(made, run(made, state, { verb: "TakeControlOfLocation", card: "self", who: "actor" }, { seat: 1, sourceId: idOf(state, TOWER) }));
    expect(taken.cards[idOf(taken, WARRIOR)]).toMatchObject({ zone: "engaged", controller: 1 });
  });

  it("nothing is announced in a game with no record that names it: the other cards of the table see no event", () => {
    const made = tableFromLayout("assault-on-osgiliath", { seats: 1, stage: "06091", phase: "Quest", staging: ["06096"] });
    const state = opened(made).state;
    const taken = run(made, state, { verb: "TakeControlOfLocation", card: "self" }, { sourceId: idOf(state, "06096") });
    expect((taken.pendingEvents ?? []).map((event) => event.trigger)).not.toContain("controlTaken");
  });
});

describe("controlsOutnumberStaging: more locations under control than in the staging area, the active location not counted (22025:B:3, 22026:B:2)", () => {
  const outnumber = (made: ReturnType<typeof table>, state: ScenarioState) => holds(state, { kind: "controlsOutnumberStaging" }, { actor: 0, sourceId: null, returned: 0 }, made.ctx);

  it("is false with nothing controlled and true once the controlled locations exceed those in the staging area", () => {
    const made = table({ staging: [HOUSE, SQUARE, CITY_FORUM], active: FORTIFICATION });
    const state = opened(made).state;
    expect(outnumber(made, state)).toBe(false);
    const one = run(made, state, { verb: "TakeControlOfLocation", card: "self" }, { sourceId: idOf(state, HOUSE) });
    expect(controlledLocations(one)).toHaveLength(1);
    expect(outnumber(made, one)).toBe(false);
    const two = run(made, one, { verb: "TakeControlOfLocation", card: "self" }, { sourceId: idOf(state, SQUARE) });
    expect(outnumber(made, two)).toBe(true);
  });

  it("an enemy in the staging area is no location, so it does not count against the players", () => {
    const made = table({ staging: [HOUSE, WARRIOR] });
    const state = opened(made).state;
    const one = run(made, state, { verb: "TakeControlOfLocation", card: "self" }, { sourceId: idOf(state, HOUSE) });
    expect(outnumber(made, one)).toBe(true);
  });
});

describe("healsInsteadOfDestroyed: the enemy that would be destroyed heals all damage and the source is discarded (22019:A:2)", () => {
  it("the enemy stays in play with no damage, Fury goes to the encounter discard pile, and no victory display or destroy event follows", () => {
    const made = table({ staging: [WARRIOR], attached: [{ code: FURY, to: WARRIOR, encounter: true }] });
    const base = opened(made).state;
    const enemy = idOf(base, WARRIOR);
    const fury = idOf(base, FURY);
    const flagged = { ...base, modifiers: [...base.modifiers, { instanceId: enemy, sourceId: fury, stat: "healsInsteadOfDestroyed" as const, amount: 1, until: "whileSourceInPlay" as const }] };
    const hit = settled(made, placeDamage(updateCard(flagged, enemy, { damage: 1 }), enemy, 99, made.ctx.cards, [], "framework", ruleCause("rr.damage")));
    expect(hit.cards[enemy]).toMatchObject({ zone: "staging", damage: 0 });
    expect(hit.cards[fury]?.zone).toBe("encounterDiscard");
    expect(hit.cards[enemy]?.attachments).not.toContain(fury);
    expect((hit.pendingEvents ?? []).map((event) => event.trigger)).not.toContain("enemyDestroyed");
  });

  it("an enemy that holds no such flag is destroyed as before", () => {
    const made = table({ staging: [WARRIOR] });
    const base = opened(made).state;
    const enemy = idOf(base, WARRIOR);
    const hit = settled(made, placeDamage(base, enemy, 99, made.ctx.cards, [], "framework", ruleCause("rr.damage")));
    expect(hit.cards[enemy]?.zone).not.toBe("staging");
  });
});

describe("the stage 1B restriction: defeated only at the end of the round with the control ahead (22025:B:3)", () => {
  const full = (layout: Layout = {}) => table({ seats: 1, stage: "22025", progress: 30, staging: [HOUSE, SQUARE, CITY_FORUM], ...layout });
  const sweep = (state: ScenarioState, made: { ctx: Parameters<typeof settle>[1] }): ScenarioState => advanceFreed(settle({ ...state, window: null, mode: "stopped" }, made.ctx, []), made.ctx, [] as EngineStep[]);

  it("a full stage stays while the end of the round has not marked the table", () => {
    const made = full();
    const state = opened(made).state;
    expect(sweep(state, made).questStage).toBe(state.questStage);
  });

  it("the end of the round marks the table only when the players control more locations than the staging area holds, and then the stage is defeated", () => {
    const made = full();
    const base = opened(made).state;
    const ahead = ["22015", "22016"].reduce((state, code) => run(made, state, { verb: "TakeControlOfLocation", card: "self" }, { sourceId: idOf(base, code) }), base);
    const marked = resolveRecords(ahead, made.ctx, "22025", "forced", idOf(base, "22025"), undefined, false).state;
    expect(sweep(marked, made).questStage).not.toBe(base.questStage);
    const behind = resolveRecords(base, made.ctx, "22025", "forced", idOf(base, "22025"), undefined, false).state;
    expect(sweep(behind, made).questStage).toBe(base.questStage);
  });
});
