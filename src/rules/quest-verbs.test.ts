// Rules: rr.in-play-and-out-of-play, rr.active-location, rr.quest-advancement, rr.effects, rr.winning-the-game (data/rules/entries.json).
// Engine verbs for the A Knife in the Dark quest and encounter lines. The records here are fixtures; the real ones are
// written from the draft bundles. Each test names the ledger line (data/printed) it is for.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../catalog/boundary.ts";

import { effectCause } from "./cause.ts";
import { holds } from "./conditions.ts";
import { pushCardEffects } from "./effect-frames.ts";
import { byCode, cardMap, expectOk, hero, idleScenario } from "./fixture.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { settle } from "./machine.ts";
import { definePrinted } from "./printed.ts";
import { reduce } from "./reduce.ts";
import { updateCard, type ScenarioState } from "./state.ts";
import { moveCard, spawn } from "./zones.ts";

const wraith = definePrinted({ code: "wraith", name: "Ringwraith", type: "enemy", traits: ["Nazgûl"], engagementCost: 35, threat: 3, attack: 5, defense: 4, health: 5 });
const orc = definePrinted({ code: "orc", name: "Orc", type: "enemy", traits: ["Orc"], engagementCost: 20, threat: 1, attack: 2, defense: 1, health: 3 });
const pony = definePrinted({ code: "pony", name: "The Prancing Pony", type: "location", threat: 1, questPoints: 2, isUnique: true });
const marsh = definePrinted({ code: "marsh", name: "Midgewater", type: "location", threat: 2, questPoints: 3 });
const stage = definePrinted({ code: "stage", name: "Into the Wild", type: "quest", questPoints: 6 });
const next = definePrinted({ code: "next", name: "The Ringwraiths Attack", type: "quest", questPoints: 10 });
const frodo = hero("frodo", "fellowship");
const aragorn = hero("aragorn", "leadership");
const sam = hero("sam", "lore");

const cards = cardMap([wraith, orc, pony, marsh, stage, next, frodo, aragorn, sam]);

function record(id: string, cardCode: string, line: string, timing: Effect["timing"], instructions: Instruction[], extra: Partial<Effect> = {}): Effect {
  return { id, cardCode, lines: [line], timing, instructions, ...extra };
}

// The quest stage in play, the next stage in the quest deck, and heroes for each seat.
function table(seatCount: 1 | 2): { state: ScenarioState; stageId: string; heroes: string[][] } {
  let state: ScenarioState = { ...idleScenario(seatCount), stages: [{ code: "stage" }, { code: "next" }] };
  const placed = spawn(state, "stage", { zone: "questStage" });
  state = updateCard(placed.state, placed.id, { face: "B" });
  state = spawn(state, "next", { zone: "questDeck" }).state;
  const heroes: string[][] = [];
  for (let seat = 0; seat < seatCount; seat += 1) {
    const ids: string[] = [];
    for (const code of seat === 0 ? ["frodo", "aragorn", "sam"] : ["aragorn", "sam"]) {
      const made = spawn(state, code, { zone: "heroes", seat });
      state = made.state;
      ids.push(made.id);
    }
    heroes.push(ids);
  }
  return { state, stageId: placed.id, heroes };
}

function run(state: ScenarioState, effect: Effect, sourceId: string, ctx: ReduceContext, steps: EngineStep[], seat = 0): ScenarioState {
  return settle(pushCardEffects(state, "forced", sourceId, seat, false, [effect], ctx, steps), ctx, steps);
}

describe("an out-of-play card shuffled into the encounter deck (141026:B:2, 141051:A:2, 141053:A:1, 141054:A:2)", () => {
  const shuffle = record("stage:forced:1", "stage", "141026:B:2", "forced", [{ verb: "ShuffleOutOfPlayIntoEncounterDeck", code: "wraith" }]);
  const ctx = { effects: [shuffle], cards };

  it("moves one set-aside copy into the encounter deck and shuffles it, and does nothing with no copy left", () => {
    const { state: base, stageId } = table(1);
    let state = spawn(base, "wraith", { zone: "setAside" }, "down").state;
    state = spawn(state, "wraith", { zone: "setAside" }, "down").state;
    for (const code of ["orc", "orc", "orc"]) state = spawn(state, code, { zone: "encounterDeck" }).state;
    const cursor = state.seedCursor;
    const once = run(state, shuffle, stageId, ctx, []);
    expect(once.setAside).toHaveLength(1);
    expect(once.encounterDeck).toHaveLength(4);
    expect(once.encounterDeck.filter((id) => once.cards[id]?.code === "wraith")).toHaveLength(1);
    expect(once.seedCursor).toBeGreaterThan(cursor);
    const twice = run(once, shuffle, stageId, ctx, []);
    const thrice = run(twice, shuffle, stageId, ctx, []);
    expect(thrice.setAside).toEqual([]);
    expect(thrice.encounterDeck).toHaveLength(5);
  });

  it("reads whether a copy is out of play, so a Choose option can require it (rr.in-play-and-out-of-play, rr.removed-from-game)", () => {
    const { state: base } = table(1);
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const out = (state: ScenarioState): boolean => holds(state, { kind: "outOfPlay", code: "wraith" }, scope, ctx);
    expect(out(base)).toBe(false);
    // Out of play, by the Rules Reference's list: set aside, the encounter discard pile, the victory display.
    for (const zone of ["setAside", "encounterDiscard", "victory"] as const) expect(out(spawn(base, "wraith", { zone }, "down").state), zone).toBe(true);
    // Not the encounter deck the copy would be shuffled into, not one removed from the game, not one in play.
    for (const zone of ["encounterDeck", "removed", "staging"] as const) expect(out(spawn(base, "wraith", { zone }).state), zone).toBe(false);
  });

  it("takes a copy from the encounter discard pile when none is set aside", () => {
    const { state: base, stageId } = table(1);
    const discarded = spawn(base, "wraith", { zone: "encounterDiscard" });
    const state = spawn(discarded.state, "orc", { zone: "encounterDeck" }).state;
    const done = run(state, shuffle, stageId, ctx, []);
    expect(done.window).toBeNull();
    expect(done.encounterDiscard).toEqual([]);
    expect(done.cards[discarded.id]).toMatchObject({ zone: "encounterDeck", face: "down" });
  });

  it("takes a copy from under a location: it is out of play by that card's text (141049:A:1)", () => {
    const { state: base, stageId } = table(1);
    const location = spawn(base, "marsh", { zone: "staging" });
    const placed = spawn(location.state, "wraith", { zone: "under", locationId: location.id }, "down");
    const done = run(placed.state, shuffle, stageId, ctx, []);
    expect(done.cards[placed.id]).toMatchObject({ zone: "encounterDeck", host: null });
  });

  it("asks the first player which copy when copies are out of play in different zones (rr.first-player)", () => {
    const { state: base, stageId } = table(2);
    const aside = spawn(base, "wraith", { zone: "setAside" }, "down");
    const second = spawn(aside.state, "wraith", { zone: "setAside" }, "down");
    const discarded = spawn(second.state, "wraith", { zone: "encounterDiscard" });
    // The effect is the second seat's; the first player (seat 1 here) picks the copy. Two set-aside copies are one choice.
    const state = { ...discarded.state, firstPlayer: 1 };
    const asked = settle(pushCardEffects(state, "forced", stageId, 0, false, [shuffle], ctx, []), ctx, []);
    expect(asked.window).toEqual({ kind: "choose", seat: 1, options: [aside.id, discarded.id] });
    const chosen = expectOk(reduce({ ...asked, activeSeat: 1 }, { type: "Choose", optionId: discarded.id }, ctx));
    expect(chosen.state.cards[discarded.id]?.zone).toBe("encounterDeck");
    expect(chosen.state.setAside).toEqual([aside.id, second.id]);
  });
});

describe("the first player chooses between two instructions at the end of the round (141026:B:2)", () => {
  const forced = record("stage:forced:1", "stage", "141026:B:2", "forced", [
    {
      verb: "Choose",
      who: "firstPlayer",
      options: [
        { id: "progress", requires: { kind: "questProgress" }, instructions: [{ verb: "RemoveQuestProgress", perPlayer: 1 }] },
        { id: "wraith", requires: { kind: "outOfPlay", code: "wraith" }, instructions: [{ verb: "ShuffleOutOfPlayIntoEncounterDeck", code: "wraith" }] },
      ],
    },
  ], { trigger: "endOfRound" });
  const ctx = { effects: [forced], cards };

  it("asks the first player when both change the game, and removes X progress for X players", () => {
    const { state: base, stageId } = table(2);
    const state = spawn(updateCard(base, stageId, { progress: 5 }), "wraith", { zone: "setAside" }, "down").state;
    const steps: EngineStep[] = [];
    const asked = settle({ ...state, firstPlayer: 1, phase: "End of round", boundaryPhase: "End of round" }, ctx, steps);
    const crossed = settle({ ...asked, phase: "Beginning of round" }, ctx, steps);
    expect(crossed.window).toEqual({ kind: "choose", seat: 1, options: ["progress", "wraith"] });
    const chosen = expectOk(reduce({ ...crossed, activeSeat: 1 }, { type: "Choose", optionId: "progress" }, ctx));
    expect(chosen.state.cards[stageId]?.progress).toBe(3);
    expect(chosen.steps.filter((step) => step.kind === "progress")).toEqual([{ kind: "progress", targetId: stageId, amount: -2, cause: effectCause(forced) }]);
    expect(chosen.state.setAside).toHaveLength(1);
  });

  it("takes the only option that changes the game without asking (rr.effects), and stops progress at 0", () => {
    const { state: base, stageId } = table(2);
    // No progress: only the Ringwraith option is legal.
    const aside = spawn(base, "wraith", { zone: "setAside" }, "down").state;
    const shuffled = run(aside, forced, stageId, ctx, []);
    expect(shuffled.window).toBeNull();
    expect(shuffled.setAside).toEqual([]);
    // No copy left: progress comes off, down to 0.
    const steps: EngineStep[] = [];
    const removed = run(updateCard(base, stageId, { progress: 1 }), forced, stageId, ctx, steps);
    expect(removed.cards[stageId]?.progress).toBe(0);
    expect(steps.filter((step) => step.kind === "progress").map((step) => (step.kind === "progress" ? step.amount : 0))).toEqual([-1]);
  });
});

describe("each player places progress on the current quest (141026:B:1)", () => {
  const place = record("stage:whenRevealed:1", "stage", "141026:B:1", "whenRevealed", [{ verb: "PlaceQuestProgress", perPlayer: 1 }]);
  const ctx = { effects: [place], cards };

  it("puts it on the active location first (rr.active-location), then on the quest", () => {
    const { state: base, stageId } = table(2);
    const active = spawn(base, "marsh", { zone: "activeLocation" });
    const steps: EngineStep[] = [];
    const placed = run(updateCard(active.state, active.id, { progress: 2 }), place, stageId, ctx, steps);
    // Two players: 2 progress, 1 fills Midgewater (3 points) and 1 goes on the quest.
    expect(placed.activeLocation).toBeNull();
    expect(placed.cards[stageId]?.progress).toBe(1);
    expect(steps.filter((step) => step.kind === "progress").map((step) => (step.kind === "progress" ? step.amount : 0))).toEqual([1, 1]);
  });

  it("advances a full quest card unless a constant forbids it (rr.quest-advancement)", () => {
    const hold = record("stage:constant:1", "stage", "141026:B:3", "constant", [{ verb: "Restrict", what: "advance" }], { condition: { kind: "inPlay", code: "marsh", is: true } });
    const { state: base, stageId } = table(1);
    const full = updateCard(base, stageId, { progress: 5 });
    const advanced = run(full, place, stageId, { effects: [place], cards }, []);
    expect(advanced.cards[byCode(advanced, "next")[0] ?? ""]?.zone).toBe("questStage");
    const held = spawn(full, "marsh", { zone: "staging" }).state;
    const stayed = run(held, place, stageId, { effects: [place, hold], cards }, []);
    expect(stayed.questStage).toBe(stageId);
    expect(stayed.cards[stageId]?.progress).toBe(6);
  });
});

describe("the players cannot advance while a named card is in play (141025:B:1, 141026:B:3)", () => {
  it("is a Restrict advance record with an inPlay condition, read when the quest resolves", () => {
    const hold = record("stage:constant:1", "stage", "141025:B:1", "constant", [{ verb: "Restrict", what: "advance" }], { condition: { kind: "inPlay", code: "pony", is: true } });
    const ctx = { effects: [hold], cards };
    const { state: base, stageId, heroes } = table(1);
    let state = spawn(base, "pony", { zone: "staging" }).state;
    for (const id of heroes[0] ?? []) state = updateCard(state, id, { committed: true });
    state = updateCard(state, stageId, { progress: 5 });
    // Committed willpower 3 against staging threat 1: 2 progress fills the stage, which is held while the Pony is in play. A
    // stage that cannot advance takes all of it, past its quest points (faq.progress-without-advancing).
    const steps: EngineStep[] = [];
    const resolved = settle({ ...state, mode: "resolution", phase: "Quest", boundaryPhase: "Quest" }, ctx, steps);
    expect(resolved.questStage).toBe(stageId);
    expect(resolved.cards[stageId]?.progress).toBe(7);
  });
});

describe("a player removes heroes they control from the quest (141054:A:2)", () => {
  const reveal = record("trap:whenRevealed:1", "trap", "141054:A:2", "whenRevealed", [
    { verb: "Pick", pick: { type: "hero", control: "you", committed: true } },
    { verb: "RemoveFromQuest" },
    { verb: "Pick", pick: { type: "hero", control: "you", committed: true } },
    { verb: "RemoveFromQuest" },
  ]);
  const trap = definePrinted({ code: "trap", name: "Unwanted Attention", type: "treachery" });
  const ctx = { effects: [reveal], cards: cardMap([...cards.values(), trap]) };

  it("uncommits two chosen heroes, which stay exhausted, and resolves as much as it can with one", () => {
    const { state: base, heroes } = table(1);
    const [f = "", a = "", s = ""] = heroes[0] ?? [];
    let state = base;
    for (const id of [f, a, s]) state = updateCard(state, id, { committed: true, exhausted: true });
    const source = spawn(state, "trap", { zone: "staging" });
    const asked = run(source.state, reveal, source.id, ctx, []);
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: [f, a, s] });
    const first = expectOk(reduce(asked, { type: "Choose", optionId: a }, ctx)).state;
    expect(first.window).toEqual({ kind: "choose", seat: 0, options: [f, s] });
    const done = expectOk(reduce(first, { type: "Choose", optionId: s }, ctx)).state;
    expect([f, a, s].map((id) => done.cards[id]?.committed)).toEqual([true, false, false]);
    expect([a, s].map((id) => done.cards[id]?.exhausted)).toEqual([true, true]);
    // Only one hero committed: it leaves the quest and the second pick finds nothing.
    const single = run(spawn(updateCard(base, f, { committed: true }), "trap", { zone: "staging" }).state, reveal, source.id, ctx, []);
    expect(single.window).toBeNull();
    expect(single.cards[f]?.committed).toBe(false);
  });
});

describe("each player raises threat for each non-Fellowship hero committed to the quest (141051:A:2)", () => {
  const raise = record("ferny:forced:1", "ferny", "141051:A:2", "forced", [{ verb: "RaiseThreat", who: "eachSeat", perCommitted: { type: "hero", exceptSphere: "fellowship" } }]);
  const ferny = definePrinted({ code: "ferny", name: "Bill Ferny", type: "enemy", threat: 1, engagementCost: 50, isUnique: true });
  const ctx = { effects: [raise], cards: cardMap([...cards.values(), ferny]) };

  it("counts each seat's own committed heroes other than Fellowship ones", () => {
    const { state: base, heroes } = table(2);
    const [f = "", a = "", s = ""] = heroes[0] ?? [];
    const [a2 = ""] = heroes[1] ?? [];
    let state = base;
    for (const id of [f, a, s, a2]) state = updateCard(state, id, { committed: true });
    const source = spawn(state, "ferny", { zone: "staging" });
    const steps: EngineStep[] = [];
    const raised = run(source.state, raise, source.id, ctx, steps);
    expect(raised.seats[0].threat).toBe(2);
    expect(raised.seats[1].threat).toBe(1);
    expect(steps.filter((step) => step.kind === "threat")).toEqual([
      { kind: "threat", seat: 0, amount: 2, cause: effectCause(raise) },
      { kind: "threat", seat: 1, amount: 1, cause: effectCause(raise) },
    ]);
  });

  it("lets a Choose option require that some non-Fellowship hero is committed", () => {
    const { state: base, heroes } = table(1);
    const [f = "", a = ""] = heroes[0] ?? [];
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const condition = { kind: "canPick", pick: { type: "hero", control: "any", committed: true, exceptSphere: "fellowship" } } as const;
    expect(holds(updateCard(base, f, { committed: true }), condition, scope, ctx)).toBe(false);
    expect(holds(updateCard(base, a, { committed: true }), condition, scope, ctx)).toBe(true);
  });
});

describe("search the encounter deck and discard pile and add each enemy with a trait to staging (141027:A:1)", () => {
  const search = record("next:whenRevealed:1", "next", "141027:A:1", "whenRevealed", [
    { verb: "AddSetAsideToStaging", code: "marsh" },
    { verb: "SearchMove", trait: "Nazgûl", type: "enemy", to: "staging", each: true },
    { verb: "ShuffleEncounterDeck" },
  ]);
  const ctx = { effects: [search], cards };

  it("moves every match, from both piles, without asking, and leaves set-aside copies where they are", () => {
    const { state: base, stageId } = table(1);
    let state = spawn(base, "marsh", { zone: "setAside" }, "down").state;
    state = spawn(state, "wraith", { zone: "setAside" }, "down").state;
    state = spawn(state, "wraith", { zone: "encounterDeck" }, "down").state;
    state = spawn(state, "orc", { zone: "encounterDeck" }, "down").state;
    state = spawn(state, "wraith", { zone: "encounterDiscard" }).state;
    const done = run(state, search, stageId, ctx, []);
    expect(done.window).toBeNull();
    expect(done.staging.map((id) => done.cards[id]?.code).sort()).toEqual(["marsh", "wraith", "wraith"]);
    expect(done.staging.every((id) => done.cards[id]?.face === "up")).toBe(true);
    expect(done.setAside.map((id) => done.cards[id]?.code)).toEqual(["wraith"]);
    expect(done.encounterDeck.map((id) => done.cards[id]?.code)).toEqual(["orc"]);
  });
});

describe("the players win when no enemy with a trait is in play (141027:B:1, rr.winning-the-game)", () => {
  const win = record("next:constant:1", "next", "141027:B:1", "constant", [{ verb: "WinGame" }], { condition: { kind: "enemyInPlay", trait: "Nazgûl", is: false } });
  const ctx = { effects: [win], cards };

  it("reads the condition on enemies in play only", () => {
    const { state: base } = table(1);
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const condition = { kind: "enemyInPlay", trait: "Nazgûl", is: true } as const;
    expect(holds(spawn(base, "wraith", { zone: "staging" }).state, condition, scope, ctx)).toBe(true);
    expect(holds(spawn(base, "wraith", { zone: "engaged", seat: 0 }).state, condition, scope, ctx)).toBe(true);
    expect(holds(spawn(base, "wraith", { zone: "encounterDiscard" }).state, condition, scope, ctx)).toBe(false);
    expect(holds(spawn(base, "orc", { zone: "staging" }).state, condition, scope, ctx)).toBe(false);
    expect(holds(spawn(base, "orc", { zone: "staging" }).state, { kind: "enemyInPlay", is: true }, scope, ctx)).toBe(true);
  });

  it("ends the game as soon as the last one leaves play, closing the open window", () => {
    const { state: base } = table(1);
    const stage3 = spawn(base, "next", { zone: "staging" });
    let state = stage3.state;
    const enemy = spawn(state, "wraith", { zone: "engaged", seat: 0 });
    state = { ...enemy.state, window: { kind: "playerAttack" } };
    // While the Nazgûl is engaged the game goes on and the window stays.
    const going = settle(state, ctx, []);
    expect(going.stageCleared).toBe(false);
    expect(going.window).toEqual({ kind: "playerAttack" });
    const won = settle(moveCard(state, enemy.id, { zone: "encounterDiscard" }), ctx, []);
    expect(won.stageCleared).toBe(true);
    expect(won.window).toBeNull();
  });

  it("is not read while an effect is still resolving, so a stage that brings the enemies out is not won early", () => {
    const { state: base } = table(1);
    const stage3 = spawn(base, "next", { zone: "staging" });
    const bring = record("next:whenRevealed:1", "next", "141027:A:1", "whenRevealed", [{ verb: "AddSetAsideToStaging", code: "wraith" }]);
    const aside = spawn(stage3.state, "wraith", { zone: "setAside" }, "down").state;
    const both = { effects: [win, bring], cards };
    const revealed = settle(pushCardEffects(aside, "whenRevealed", stage3.id, 0, false, [bring], both, []), both, []);
    expect(revealed.stageCleared).toBe(false);
    expect(revealed.staging.some((id) => revealed.cards[id]?.code === "wraith")).toBe(true);
  });
});
