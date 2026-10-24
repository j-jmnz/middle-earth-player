import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { cardMap, expectOk, fixtureDefinition } from "../rules/fixture.ts";
import type { EngineStep } from "../rules/intents.ts";
import { definePrinted, type PrintedCard } from "../rules/printed.ts";
import { legalIntents, reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { blankScenario, withThreat } from "../rules/state.ts";
import { spawn } from "../rules/zones.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";

const RIDER = "141039";
const RING = "141085";
const SHADOWS = ["141036", "141038", "141040", "141041", "141072", "141073", "141075", "141076"];

let cards: Map<string, PrintedCard>;

beforeAll(async () => {
  cards = new Map(await loadPrinted([...SHADOWS, RIDER, RING]));
  for (const code of ["tank", "pip"]) {
    cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "leadership", threat: 8, willpower: 1, attack: 1, defense: code === "tank" ? 3 : 0, health: 20 }));
  }
});

type Scene = { shadow: string; seats?: 1 | 2; hideFailed?: boolean; ring?: "ready" | "exhausted"; heroes?: readonly string[] };

function ctx(): ReduceContext {
  return { effects: EFFECTS, cards: cardMap([...cards.values()]) };
}

// One Black Rider engaged with seat 0, one dealt shadow card on top of the encounter deck. The run
// stops on the first defense window.
function attackWindow(scene: Scene): { state: ScenarioState; steps: EngineStep[]; ids: Record<string, string> } {
  const seats = scene.seats ?? 1;
  let state = blankScenario({ seatCount: seats, seed: 6, definition: fixtureDefinition(["stage"]) });
  const ids: Record<string, string> = {};
  for (const [index, code] of (scene.heroes ?? ["tank"]).entries()) {
    const spawned = spawn(state, code, { zone: "heroes", seat: 0 });
    state = spawned.state;
    ids[`hero${index}`] = spawned.id;
  }
  if (seats === 2) {
    const other = spawn(state, "tank", { zone: "heroes", seat: 1 });
    state = other.state;
    ids.seat1 = other.id;
  }
  const rider = spawn(state, RIDER, { zone: "engaged", seat: 0 });
  state = rider.state;
  ids.rider = rider.id;
  const shadow = spawn(state, scene.shadow, { zone: "encounterDeck" });
  state = shadow.state;
  ids.shadow = shadow.id;
  if (scene.ring) {
    const ring = spawn(state, RING, { zone: "play", seat: 0 });
    state = { ...ring.state, cards: { ...ring.state.cards, [ring.id]: { ...ring.state.cards[ring.id]!, exhausted: scene.ring === "exhausted" } } };
  }
  for (let seat = 0; seat < seats; seat += 1) state = withThreat(state, seat, 20);
  if (scene.hideFailed) state = { ...state, hideFailures: [{ seat: 0, round: state.round, phase: "Quest" }] };
  state = { ...state, phase: "Encounter", mode: "optionalEngage", window: { kind: "optionalEngage" }, activeSeat: 0, passed: [] };
  const steps: EngineStep[] = [];
  for (let seat = 0; seat < seats; seat += 1) {
    const result = expectOk(reduce(state, { type: "DeclineEngage" }, ctx()));
    state = result.state;
    steps.push(...result.steps);
  }
  return { state, steps, ids };
}

function send(run: { state: ScenarioState; steps: EngineStep[] }, intent: PlayerIntent) {
  const result = expectOk(reduce(run.state, intent, ctx()));
  return { state: result.state, steps: [...run.steps, ...result.steps] };
}

function damageOf(state: ScenarioState, id: string | undefined): number {
  return state.cards[id ?? ""]?.damage ?? -1;
}

describe("shadow cards stay face down until the attack is answered", () => {
  it("deals the card face down and turns it up after the defender is declared", () => {
    const run = attackWindow({ shadow: "141036" });
    expect(run.state.window).toEqual({ kind: "defense", enemyId: run.ids.rider, seat: 0 });
    expect(run.state.cards[run.ids.shadow ?? ""]).toMatchObject({ zone: "shadow", face: "down" });
    expect(run.state.pendingAttack).toEqual({ enemyId: run.ids.rider, seat: 0 });
    const done = send(run, { type: "DeclareDefender", defenderId: run.ids.hero0 ?? "" });
    expect(done.state.cards[run.ids.shadow ?? ""]?.zone).toBe("encounterDiscard");
    // 5 + 1 - 3
    expect(damageOf(done.state, run.ids.hero0)).toBe(3);
    expect(done.state.modifiers).toEqual([]);
    expect(done.state.pendingAttack).toBeNull();
  });
});

describe.each(["141036", "141038"])("%s shadow ModifyStat attack", (shadow) => {
  it("the base modifier applies", () => {
    const run = attackWindow({ shadow });
    expect(damageOf(send(run, { type: "Undefended" }).state, run.ids.hero0)).toBe(6);
  });

  it("the second modifier applies under hideFailed scope round", () => {
    const run = attackWindow({ shadow, hideFailed: true });
    expect(damageOf(send(run, { type: "Undefended" }).state, run.ids.hero0)).toBe(7);
  });

  it("hideFailed scope round ignores a failure from an earlier round", () => {
    const run = attackWindow({ shadow, hideFailed: true });
    const stale = { ...run.state, round: run.state.round + 1 };
    expect(damageOf(send({ ...run, state: stale }, { type: "Undefended" }).state, run.ids.hero0)).toBe(6);
  });
});

describe("141076 shadow", () => {
  it("the second modifier reads the exhausted condition on 141085", () => {
    const ready = attackWindow({ shadow: "141076", ring: "ready" });
    expect(damageOf(send(ready, { type: "Undefended" }).state, ready.ids.hero0)).toBe(6);
    const tired = attackWindow({ shadow: "141076", ring: "exhausted" });
    expect(damageOf(send(tired, { type: "Undefended" }).state, tired.ids.hero0)).toBe(7);
  });
});

describe("141040 shadow ConsiderUndefended", () => {
  it("without hideFailed the defended attack stands", () => {
    const run = attackWindow({ shadow: "141040", heroes: ["tank", "pip"] });
    const done = send(run, { type: "DeclareDefender", defenderId: run.ids.hero0 ?? "" });
    expect(damageOf(done.state, run.ids.hero0)).toBe(2);
    expect(damageOf(done.state, run.ids.hero1)).toBe(0);
  });

  it("under hideFailed the defended attack becomes undefended and the player names the hero", () => {
    const run = attackWindow({ shadow: "141040", heroes: ["tank", "pip"], hideFailed: true });
    const defended = send(run, { type: "DeclareDefender", defenderId: run.ids.hero0 ?? "" });
    expect(defended.state.cards[run.ids.hero0 ?? ""]).toMatchObject({ exhausted: true, damage: 0 });
    expect(defended.state.window).toEqual({ kind: "defense", enemyId: run.ids.rider, seat: 0 });
    expect(defended.state.pendingAttack?.undefended).toBe(true);
    expect(legalIntents(defended.state, ctx())).toEqual([{ type: "Undefended" }]);
    const again = reduce(defended.state, { type: "DeclareDefender", defenderId: run.ids.hero1 ?? "" }, ctx());
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe("This attack is considered undefended");
    const done = send(defended, { type: "Undefended", heroId: run.ids.hero1 });
    expect(damageOf(done.state, run.ids.hero1)).toBe(5);
    expect(damageOf(done.state, run.ids.hero0)).toBe(0);
    expect(done.state.pendingAttack).toBeNull();
    // The shadow card resolved once.
    expect(done.steps.filter((step) => step.kind === "push" && step.frame === "shadow")).toHaveLength(1);
  });

  it("an attack that was already undefended keeps the chosen hero", () => {
    const run = attackWindow({ shadow: "141040", heroes: ["tank", "pip"], hideFailed: true });
    const done = send(run, { type: "Undefended", heroId: run.ids.hero1 });
    expect(damageOf(done.state, run.ids.hero1)).toBe(5);
    expect(done.state.pendingAttack).toBeNull();
  });
});

describe.each([
  ["141041", "Crawling Towards Him"],
  ["141075", "Rode Like a Gale"],
])("%s %s", (shadow) => {
  it("AfterAttack ReturnToStaging moves the attacker once the attack resolves", () => {
    const run = attackWindow({ shadow });
    const done = send(run, { type: "Undefended" });
    expect(damageOf(done.state, run.ids.hero0)).toBe(5);
    expect(done.state.cards[run.ids.rider ?? ""]).toMatchObject({ zone: "staging", controller: null });
    expect(done.state.seats[0].engaged).toEqual([]);
    expect(done.state.cards[run.ids.shadow ?? ""]?.zone).toBe("encounterDiscard");
    expect(done.state.stack).toEqual([]);
  });
});

describe("141073 shadow AfterAttack ImmediateAttack", () => {
  it("the attack repeats with no new shadow card", () => {
    const run = attackWindow({ shadow: "141073" });
    const first = send(run, { type: "Undefended" });
    expect(damageOf(first.state, run.ids.hero0)).toBe(5);
    expect(first.state.window).toEqual({ kind: "defense", enemyId: run.ids.rider, seat: 0 });
    expect(first.state.pendingAttack).toMatchObject({ enemyId: run.ids.rider, immediate: true });
    const second = send(first, { type: "Undefended" });
    expect(damageOf(second.state, run.ids.hero0)).toBe(10);
    expect(second.state.pendingAttack).toBeNull();
    expect(second.state.cards[run.ids.rider ?? ""]?.zone).toBe("engaged");
    expect(second.state.stack).toEqual([]);
    expect(second.steps.filter((step) => step.kind === "attack")).toHaveLength(2);
    expect(second.steps.filter((step) => step.kind === "push" && step.frame === "shadow" && step.cardId === run.ids.shadow)).toHaveLength(1);
  });
});

describe("141072 shadow AfterAttack EngageNextPlayer", () => {
  it("the enemy is engaged to the next seat and attacks again; with one seat, the same seat", () => {
    const run = attackWindow({ shadow: "141072" });
    const first = send(run, { type: "Undefended" });
    expect(first.state.window).toEqual({ kind: "defense", enemyId: run.ids.rider, seat: 0 });
    expect(first.state.cards[run.ids.rider ?? ""]?.controller).toBe(0);
    const second = send(first, { type: "Undefended" });
    expect(damageOf(second.state, run.ids.hero0)).toBe(10);
  });

  it("with two seats, seat 1 answers the repeated attack", () => {
    const run = attackWindow({ shadow: "141072", seats: 2 });
    const first = send(run, { type: "Undefended" });
    expect(first.state.cards[run.ids.rider ?? ""]).toMatchObject({ zone: "engaged", controller: 1 });
    expect(first.state.seats[0].engaged).toEqual([]);
    expect(first.state.seats[1].engaged).toEqual([run.ids.rider]);
    expect(first.state.window).toEqual({ kind: "defense", enemyId: run.ids.rider, seat: 1 });
    expect(first.steps.some((step) => step.kind === "engage" && step.seat === 1)).toBe(true);
    const second = send(first, { type: "Undefended" });
    expect(damageOf(second.state, run.ids.seat1)).toBe(5);
    expect(damageOf(second.state, run.ids.hero0)).toBe(5);
  });
});

describe("the undefended condition", () => {
  it("is true for an undefended attack and false once a defender is declared", () => {
    const effect = {
      id: "141036:shadow:99",
      cardCode: "141036", lines: ["fixture:A:1"],
      timing: "shadow" as const,
      instructions: [
        { verb: "ModifyStat" as const, stat: "attack" as const, amount: 2, until: "endOfAttack" as const, target: "attacker" as const, when: { kind: "undefended" as const } },
      ],
    };
    const local: ReduceContext = { ...ctx(), effects: [effect] };
    const undefended = attackWindow({ shadow: "141036" });
    const hit = expectOk(reduce(undefended.state, { type: "Undefended" }, local));
    expect(damageOf(hit.state, undefended.ids.hero0)).toBe(7);
    const defended = attackWindow({ shadow: "141036" });
    const blocked = expectOk(reduce(defended.state, { type: "DeclareDefender", defenderId: defended.ids.hero0 ?? "" }, local));
    // 5 - 3: the condition failed, so there is no bonus.
    expect(damageOf(blocked.state, defended.ids.hero0)).toBe(2);
  });
});
