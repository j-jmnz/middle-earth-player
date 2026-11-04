// Rules: rr.travel, rr.active-location, rr.explored, rr.search, rr.drawing-cards, rr.refresh-phase, rr.step-7-3, rr.first-player (data/rules/entries.json).
// The Passage Through Mirkwood locations and Caught in a Web (01080).
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { pushCardEffects, pushEffectFrame } from "../../../rules/interpret/effect-frames.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { legalIntents, legalTargets } from "../../../rules/engine/legal.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { PlayerIntent, ReduceContext } from "../../../rules/engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { CAUGHT, HERO, loadMirkwoodWorld, mirkwoodTable, type MirkwoodLayout, type MirkwoodWorld } from "../../../../test/scenarios/passage-through-mirkwood/scene.ts";
import { codesOf } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { first, type Run, send, start } from "../../../../test/harness/scene-kit.ts";

let world: MirkwoodWorld;

beforeAll(async () => {
  world = await loadMirkwoodWorld();
});

function make(layout: MirkwoodLayout = {}) {
  return mirkwoodTable(world, layout);
}

function frame(state: ScenarioState, instructions: readonly Instruction[], sourceId: string, ctx: ReduceContext, steps: EngineStep[] = []): ScenarioState {
  const pushed = pushEffectFrame(state, { frame: "ResolveEffect", sourceId, actor: 0, peril: false, effectId: "test", instructions, cancel: null, blockCancel: null }, steps);
  return settle({ ...pushed, window: null }, ctx, steps);
}

// Answers every open choice with the first option (or `pick`), and returns the run.
function answers(run: Run, ctx: ReduceContext, pick?: (state: ScenarioState) => string): Run {
  let current = run;
  for (let guard = 0; guard < 20 && current.state.window?.kind === "choose"; guard += 1) current = send(current, { type: "Choose", optionId: pick?.(current.state) ?? current.state.window.options[0] ?? "" }, ctx);
  return current;
}

function travelTo(state: ScenarioState, ctx: ReduceContext, code: string): Run {
  return answers(send(start(state), { type: "Travel", locationId: first(state, code) }, ctx), ctx);
}

describe("Travel costs", () => {
  it("Great Forest Web has each player exhaust a hero to travel there, and bars the travel when a player has none ready (01077:A:1)", () => {
    const made = make({ seats: 2, staging: ["01077"], phase: "Travel" });
    const web = first(made.state, "01077");
    expect(legalTargets(made.state, { type: "Travel" }, made.ctx)).toContain(web);
    // The travel goes through, and the cost is the record's: one hero of each player exhausts (the rest of the round readies them again,
    // so the cost is read from the effect itself).
    expect(travelTo(made.state, made.ctx, "01077").state.activeLocation).toBe(web);
    const cost = made.ctx.effects.find((effect) => effect.id === "01077:travel:1")?.instructions ?? [];
    let paid = frame(made.state, cost, web, made.ctx);
    for (let guard = 0; guard < 6 && paid.window?.kind === "choose"; guard += 1) paid = send({ state: paid, steps: [] }, { type: "Choose", optionId: paid.window.options[0] ?? "" }, made.ctx).state;
    const exhausted = Object.values(paid.cards).filter((card) => card.zone === "heroes" && card.exhausted);
    expect(exhausted).toHaveLength(2);
    expect(exhausted.map((card) => card.controller).sort()).toEqual([0, 1]);
    // Seat 1's only hero is exhausted: the cost cannot be paid.
    const tired = updateCard(made.state, made.seat1Hero ?? "", { exhausted: true });
    expect(legalTargets(tired, { type: "Travel" }, made.ctx)).not.toContain(web);
    expect(legalIntents(tired, made.ctx)).toContainEqual({ type: "DeclineTravel" });
  });

  it("Necromancer's Pass has the first player discard 2 cards at random from his hand to travel there (01094:A:1)", () => {
    const made = make({ staging: ["01094"], phase: "Travel", hand: ["filler", "ally", "mevent"] });
    const run = travelTo(made.state, made.ctx, "01094");
    expect(run.state.seats[0].hand).toHaveLength(1);
    expect(run.state.seats[0].discard).toHaveLength(2);
    expect(causeProblems(run.steps)).toEqual([]);
    const short = make({ staging: ["01094"], phase: "Travel", hand: ["filler"] });
    expect(legalTargets(short.state, { type: "Travel" }, short.ctx)).not.toContain(first(short.state, "01094"));
    const two = make({ staging: ["01094"], phase: "Travel", hand: ["filler", "filler"] });
    expect(legalTargets(two.state, { type: "Travel" }, two.ctx)).toContain(first(two.state, "01094"));
  });

  it("Mountains of Mirkwood has the players reveal the top card of the encounter deck and add it to the staging area to travel there (01078:A:1)", () => {
    const made = make({ staging: ["01078"], phase: "Travel", deck: ["f3", "f0"] });
    const run = travelTo(made.state, made.ctx, "01078");
    expect(codesOf(run.state, run.state.staging)).toEqual(["f3"]);
    expect(run.state.activeLocation).toBe(first(made.state, "01078"));
  });
});

describe("Responses after traveling", () => {
  it("Old Forest Road lets the first player ready a character he controls (01099:A:1)", () => {
    const made = make({ staging: ["01099"], phase: "Travel" });
    const tired = updateCard(made.state, made.hero, { exhausted: true });
    const run = send(start(tired), { type: "Travel", locationId: first(tired, "01099") }, made.ctx);
    const road = first(tired, "01099");
    const offer = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === road);
    expect(offer).toBeDefined();
    const after = answers(send(run, offer as PlayerIntent, made.ctx), made.ctx);
    expect(after.state.cards[made.hero]?.exhausted).toBe(false);
    // With nothing exhausted there is nothing to ready, so no Response is offered.
    const fresh = send(start(made.state), { type: "Travel", locationId: road }, made.ctx);
    expect(legalIntents(fresh.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === road)).toBe(false);
  });

  it("Forest Gate lets the first player draw 2 cards (01100:A:1)", () => {
    const made = make({ staging: ["01100"], phase: "Travel", playerDeck: ["filler", "filler", "filler"] });
    const gate = first(made.state, "01100");
    const run = send(start(made.state), { type: "Travel", locationId: gate }, made.ctx);
    const offer = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === gate);
    expect(offer).toBeDefined();
    const after = answers(send(run, offer as PlayerIntent, made.ctx), made.ctx);
    expect(after.state.seats[0].hand).toHaveLength(2);
  });

  it("Mountains of Mirkwood, explored, lets each player search the top 5 cards of his deck for a card (01078:A:2)", () => {
    const made = make({ seats: 2, active: "01078", playerDeck: ["filler", "ally", "mevent", "filler", "ally", "filler", "filler"] });
    const mountains = first(made.state, "01078");
    const seat2 = updateCard(made.state, mountains, {});
    let state = frame(seat2, [{ verb: "PlaceProgressOn", amount: 99, target: "activeLocation" }], made.hero, made.ctx);
    expect(state.activeLocation).toBeNull();
    expect(state.window).toMatchObject({ kind: "response" });
    const offer = legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === mountains);
    expect(offer).toBeDefined();
    let run: Run = send({ state, steps: [] }, offer as PlayerIntent, made.ctx);
    run = answers(run, made.ctx, (current) => {
      const options = current.window?.kind === "choose" ? current.window.options : [];
      // The first choice is search (or the card to find); the player card chosen is the first option offered.
      return options[0] ?? "";
    });
    state = run.state;
    expect(state.seats[0].hand).toHaveLength(1);
    expect(state.seats[0].deck).toHaveLength(6);
  });
});

describe("Enchanted Stream (01095:A:1)", () => {
  it("stops every draw while it is the active location, and only then", () => {
    const active = make({ staging: [], active: "01095", playerDeck: ["filler", "filler", "filler"] });
    const none = frame(active.state, [{ verb: "Draw", amount: 2 }], active.hero, active.ctx);
    expect(none.seats[0].hand).toHaveLength(0);
    const staged = make({ staging: ["01095"], playerDeck: ["filler", "filler", "filler"] });
    const some = frame(staged.state, [{ verb: "Draw", amount: 2 }], staged.hero, staged.ctx);
    expect(some.seats[0].hand).toHaveLength(2);
  });
});

describe("Caught in a Web (01080:A:1)", () => {
  // The When Revealed attaches it to a hero of the player with the highest threat.
  function reveal(layout: MirkwoodLayout, pick?: (state: ScenarioState) => string) {
    const made = make(layout);
    const effects = made.ctx.effects.filter((effect) => effect.cardCode === CAUGHT && effect.timing === "whenRevealed");
    const steps: EngineStep[] = [];
    const web = spawnWeb(made.state);
    const pushed = pushCardEffects(web.state, "whenRevealed", web.id, web.state.firstPlayer, false, effects, made.ctx, steps);
    return { made, run: answers({ state: settle({ ...pushed, window: null }, made.ctx, steps), steps }, made.ctx, pick) };
  }

  it("attaches to a hero of the player with the highest threat, and the first player settles a tie", () => {
    const { run, made } = reveal({ seats: 2, threat: [30, 26] });
    const web = first(run.state, CAUGHT);
    const host = run.state.cards[web]?.host ?? "";
    expect(run.state.cards[host]?.controller).toBe(0);
    expect(run.state.cards[web]?.zone).toBe("attached");
    const other = reveal({ seats: 2, threat: [24, 31] });
    expect(other.run.state.cards[other.run.state.cards[first(other.run.state, CAUGHT)]?.host ?? ""]?.controller).toBe(1);
    // A tie: the first player chooses among the heroes of both players.
    const tied = reveal({ seats: 2, threat: [28, 28] }, (state) => (state.window?.kind === "choose" && state.window.options.includes(made.seat1Hero ?? "") ? (state.window.options.find((id) => state.cards[id]?.code === "mh3") ?? "") : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")));
    expect(tied.run.state.cards[tied.run.state.cards[first(tied.run.state, CAUGHT)]?.host ?? ""]?.zone).toBe("heroes");
  });

  it("does not ready its hero in the refresh phase unless the player pays 2 resources from the hero's pool", () => {
    const refreshed = (resources: number, answer: "pay" | "skip") => {
      const made = make({ phase: "Combat", resources: [[HERO, resources]] });
      const hero = made.hero;
      const web = spawnWeb(made.state);
      const attached = attachWeb(web.state, web.id, hero);
      const tired = [hero, made.hero2].reduce((state, id) => updateCard(state, id, { exhausted: true }), attached);
      const synced = settle(tired, made.ctx, []);
      const refreshing: ScenarioState = { ...synced, phase: "Combat", mode: "refresh", window: null };
      const run = answers({ state: settle(refreshing, made.ctx, []), steps: [] }, made.ctx, (state) => (state.window?.kind === "choose" && state.window.options.includes(answer) ? answer : ""));
      return { run, hero, other: made.hero2, asked: run.state.stack.length === 0 };
    };
    const paid = refreshed(3, "pay");
    expect(paid.run.state.cards[paid.hero]?.exhausted).toBe(false);
    // 3 - 2, and the next resource phase (the round goes on) adds 1.
    expect(paid.run.state.cards[paid.hero]?.resources).toBe(2);
    expect(paid.run.state.cards[paid.other]?.exhausted).toBe(false);
    const declined = refreshed(3, "skip");
    expect(declined.run.state.cards[declined.hero]?.exhausted).toBe(true);
    expect(declined.run.state.cards[declined.hero]?.resources).toBe(4);
    expect(declined.run.state.cards[declined.other]?.exhausted).toBe(false);
    // With fewer than 2 resources there is nothing to pay: no question, and the hero stays exhausted.
    const poor = refreshed(1, "pay");
    expect(poor.run.state.cards[poor.hero]?.exhausted).toBe(true);
    expect(poor.run.state.cards[poor.other]?.exhausted).toBe(false);
  });
});

function spawnWeb(state: ScenarioState): { state: ScenarioState; id: string } {
  const spawned = spawn(state, CAUGHT, { zone: "encounterDiscard" });
  return { state: spawned.state, id: spawned.id };
}

function attachWeb(state: ScenarioState, webId: string, heroId: string): ScenarioState {
  const moved = spawnAttached(state, webId);
  return attachTo(moved, webId, heroId);
}

function spawnAttached(state: ScenarioState, id: string): ScenarioState {
  return updateCard(state, id, { zone: "attached", face: "up" });
}

