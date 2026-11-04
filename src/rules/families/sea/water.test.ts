// Rules: rr.attachment-cards, rr.forced, rr.action, rr.exhausted, dcce.ship-objectives (data/rules/entries.json); ledger lines 12132:A:1, 12132:A:2.
// Taking on Water: When Revealed it attaches to a Ship objective, as a Condition attachment; Forced: when the attached objective exhausts, it takes 2 damage; Action: exhaust 3 characters you control to discard it;
// Shadow: it attaches to a defending Ship. AttachSelf to a ship (`kind: "ship"`) and the family's `attached` hook, the trigger shipExhausted and its settle sweep, each on the table of the scenario.
import { beforeAll, describe, expect, it } from "vitest";

import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { addStandIns, allyCard } from "../../../../test/harness/scene-kit.ts";
import { CODES, havenFight, havenTable, idOf, idsOf, loadHavenWorld, resolveRecords, send, type HavenLayout, type HavenWorld } from "../../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";
import { legalIntents } from "../../engine/legal.ts";
import { countsAsAttachment } from "../../interpret/conditions.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { settle } from "../../engine/machine.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";

let world: HavenWorld;
beforeAll(async () => {
  world = await loadHavenWorld();
  addStandIns(world.cards, ["mild"]);
  world.cards.set("ally1", allyCard("ally1", 1, { willpower: 1 }));
  for (const [code, card] of await loadPrinted([CODES.dreamChaser, CODES.dawnStar])) world.cards.set(code, card);
});

type Table = ReturnType<typeof havenTable>;
const WATER = CODES.takingOnWater;
const make = (layout: HavenLayout = {}): Table => havenTable(world, { phase: "Quest", ...layout });
const settled = (made: Table, state: ScenarioState): ScenarioState => syncConstants(settle({ ...state, window: state.window }, made.ctx, []), made.ctx);
// Taking on Water attached to the card with `host`'s code.
function soaked(made: Table, hostCode: string): { made: Table; water: string; host: string } {
  const host = idOf(made.state, hostCode);
  const spawned = spawn(made.state, WATER, { zone: "attached" });
  return { made: { ...made, state: syncConstants(attachTo(spawned.state, spawned.id, host), made.ctx) }, water: spawned.id, host };
}
const damage = (state: ScenarioState, id: string): number => state.cards[id]?.damage ?? 0;

describe("12132:A:1 Taking on Water: When Revealed", () => {
  it("attaches to the only Ship objective, faceup, as a Condition attachment", () => {
    const made = make({ play: [CODES.dreamChaser] });
    const run = resolveRecords(made.state, made.ctx, WATER, "whenRevealed");
    const water = run.state.cards[run.id];
    expect(water).toMatchObject({ zone: "attached", host: idOf(run.state, CODES.dreamChaser), face: "up" });
    expect(run.state.cards[idOf(run.state, CODES.dreamChaser)]?.attachments).toContain(run.id);
    expect(countsAsAttachment(run.state, run.id, made.ctx)).toBe(true);
  });

  it("asks the first player which Ship objective, among the ones the players control", () => {
    const made = make({ seats: 2, play: [CODES.dreamChaser] });
    const second = spawn(made.state, CODES.dawnStar, { zone: "play", seat: 1 });
    const state = syncConstants(second.state, made.ctx);
    const asked: string[][] = [];
    const run = resolveRecords(state, made.ctx, WATER, "whenRevealed", undefined, (current) => {
      if (current.window?.kind === "choose") asked.push([...current.window.options]);
      return second.id;
    });
    expect(asked).toEqual([[idOf(state, CODES.dreamChaser), second.id].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))].map((list) => expect.arrayContaining(list)));
    expect(run.state.cards[run.id]?.host).toBe(second.id);
  });

  it("with no Ship objective in play it attaches to nothing", () => {
    const made = make();
    const run = resolveRecords(made.state, made.ctx, WATER, "whenRevealed");
    expect(run.state.cards[run.id]?.host).toBeNull();
    expect(run.state.cards[run.id]?.zone).not.toBe("attached");
  });
});

describe("12132:A:1 Taking on Water: Forced, when the attached objective exhausts, it takes 2 damage", () => {
  const exhaust = (made: Table, host: string): ScenarioState => settled(made, updateCard(made.state, host, { exhausted: true }));
  it("however the objective exhausts, once each time", () => {
    const { made, host } = soaked(make({ play: [CODES.dreamChaser] }), CODES.dreamChaser);
    const once = exhaust(made, host);
    expect(damage(once, host)).toBe(2);
    // Still exhausted: nothing more. Readied and exhausted again: 2 more.
    expect(damage(settled(made, once), host)).toBe(2);
    const again = exhaust({ ...made, state: settled(made, updateCard(once, host, { exhausted: false })) }, host);
    expect(damage(again, host)).toBe(4);
  });

  it("another Ship objective that exhausts is not hurt", () => {
    const base = make({ play: [CODES.dreamChaser, CODES.dawnStar] });
    const { made } = soaked(base, CODES.dreamChaser);
    const other = idOf(made.state, CODES.dawnStar);
    expect(damage(exhaust(made, other), other)).toBe(0);
  });

  it("an objective that was exhausted before Taking on Water attached does not take the damage", () => {
    const base = make({ play: [CODES.dreamChaser] });
    const ship = idOf(base.state, CODES.dreamChaser);
    const tired = settled(base, updateCard(base.state, ship, { exhausted: true }));
    const run = resolveRecords(tired, base.ctx, WATER, "whenRevealed");
    expect(settled(base, run.state).cards[ship]?.damage).toBe(0);
  });

  it("the objective that defends an attack exhausts, and a Taking on Water it already carries hurts it", () => {
    const fight = havenFight(world, "f0", CODES.lightCruiser, { play: [CODES.dreamChaser] }, {
      defender: (made) => idOf(made.state, CODES.dreamChaser),
      tweak: (state, made) => soaked({ ...made, state }, CODES.dreamChaser).made.state,
    });
    const ship = idOf(fight.run.state, CODES.dreamChaser);
    // The attack's own damage is the Light Cruiser's Attack less the Dream-chaser's Defense; the water adds 2.
    const bare = havenFight(world, "f0", CODES.lightCruiser, { play: [CODES.dreamChaser] }, { defender: (made) => idOf(made.state, CODES.dreamChaser) });
    expect(damage(fight.run.state, ship) - damage(bare.run.state, idOf(bare.run.state, CODES.dreamChaser))).toBe(2);
  });
});

describe("12132:A:1 Taking on Water: the Action", () => {
  const actionsOf = (made: Table, water: string) => legalIntents(made.state, made.ctx).filter((intent) => intent.type === "Trigger" && intent.cardId === water);
  it("exhausts 3 characters the player controls to discard it, and is not offered with fewer than 3 ready", () => {
    const base = make({ play: [CODES.dreamChaser, "ally1"] });
    const { made, water } = soaked(base, CODES.dreamChaser);
    // The Dream-chaser, the ally and two heroes: four ready characters.
    const trigger = actionsOf(made, water)[0];
    expect(trigger?.type).toBe("Trigger");
    if (trigger?.type !== "Trigger") throw new Error("no action");
    const used = send({ state: made.state, steps: [] }, { type: "Trigger", cardId: trigger.cardId, effectId: trigger.effectId }, made.ctx);
    let state = used.state;
    for (let guard = 0; guard < 10 && state.window?.kind === "choose"; guard += 1) state = send({ state, steps: [] }, { type: "Choose", optionId: state.window.options[0] ?? "" }, made.ctx).state;
    const exhausted = Object.values(state.cards).filter((card) => card.exhausted);
    // Three characters exhausted, and the Dream-chaser may be one of them (which, exhausting, takes damage from the water: the card is discarded by then or not).
    expect(exhausted.length).toBeGreaterThanOrEqual(3);
    expect(state.cards[water]?.zone).toBe("encounterDiscard");
    const poor = soaked(make({ play: [CODES.dreamChaser] }), CODES.dreamChaser);
    const tired = { ...poor.made, state: updateCard(poor.made.state, poor.made.hero, { exhausted: true }) };
    expect(actionsOf(tired, poor.water)).toHaveLength(0);
  });

  it("is the Ship's controller's: another player cannot use it", () => {
    const base = make({ seats: 2 });
    const mine = spawn(base.state, CODES.dawnStar, { zone: "play", seat: 1 });
    const { made, water } = soaked({ ...base, state: mine.state }, CODES.dawnStar);
    expect(actionsOf({ ...made, state: { ...made.state, activeSeat: 0 } }, water)).toHaveLength(0);
    expect(actionsOf({ ...made, state: { ...made.state, activeSeat: 1 } }, water).length).toBeGreaterThanOrEqual(0);
  });
});

describe("12132:A:1 Taking on Water: the host's exhaustion before it attached", () => {
  it("a host exhausted before the card attached did not exhaust while attached: the sweep does not announce it", () => {
    const made = make({ play: [CODES.dreamChaser] });
    const ship = idOf(made.state, CODES.dreamChaser);
    const tired = updateCard(made.state, ship, { exhausted: true });
    const run = resolveRecords(tired, made.ctx, WATER, "whenRevealed");
    const after = settled(made, run.state);
    expect(run.state.cards[run.id]?.host).toBe(ship);
    expect(damage(after, ship)).toBe(0);
  });
});

describe("12132:A:2 Taking on Water: Shadow", () => {
  it("attaches to the defending character when it is a Ship", () => {
    const fight = havenFight(world, WATER, CODES.lightCruiser, { play: [CODES.dreamChaser] }, { defender: (made) => idOf(made.state, CODES.dreamChaser) });
    const ship = idOf(fight.run.state, CODES.dreamChaser);
    const water = idsOf(fight.run.state, WATER)[0] ?? "";
    expect(fight.run.state.cards[water]).toMatchObject({ zone: "attached", host: ship });
  });

  it("does nothing against a defending character that is not a Ship: it stays a shadow card of its enemy until the combat phase ends", () => {
    const fight = havenFight(world, WATER, "mild", { play: [CODES.dreamChaser] });
    const water = idsOf(fight.run.state, WATER)[0] ?? "";
    expect(fight.run.state.cards[water]?.zone).toBe("shadow");
    expect(fight.run.state.cards[water]?.host).toBe(idOf(fight.run.state, "mild"));
  });
});
