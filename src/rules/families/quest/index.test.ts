// Rules: rr.step-3-2, rr.step-3-4, rr.response, rr.threat-threat-dial, rr.initial-threat-level, rr.threat-elimination-level,
// rr.player-elimination, rr.delayed-effects, rr.resources, rr.framework-steps (data/rules/entries.json).
// The quest family's engine: what committed characters hear when the quest resolves, the threat a failed quest raises (waived,
// or held back for the Responses to the failed quest), threat reductions and raises, the starting threat level, a card that
// keeps its player in the game, skipping the quest phase, committing by effect, choosing X and spending resources.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { pushCardEffects } from "../../effect-frames.ts";
import { cardMap, expectOk, hero, idleScenario } from "../../fixture.ts";
import type { EngineStep } from "../../intents.ts";
import { committedWillpower } from "../../quest.ts";
import { legalTargets, reduce } from "../../reduce.ts";
import { settle } from "../../machine.ts";
import { definePrinted } from "../../printed.ts";
import { updateCard, withThreat, type ScenarioState } from "../../state.ts";
import { spawn } from "../../zones.ts";
import { recordStartingThreat } from "./threat.ts";

const stage = definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 20 });
const goblin = definePrinted({ code: "goblin", name: "Goblin", type: "enemy", traits: ["Orc"], engagementCost: 30, threat: 3, attack: 2, defense: 1, health: 3 });
const escort = definePrinted({ code: "escort", name: "Escort", type: "ally", sphere: "spirit", cost: 2, willpower: 2, attack: 0, defense: 0, health: 1 });
const eagle = definePrinted({ code: "eagle", name: "Eagle", type: "ally", sphere: "tactics", cost: 2, willpower: 1, attack: 2, defense: 1, health: 2 });
const onward = definePrinted({ code: "onward", name: "Onward", type: "event", sphere: "leadership", cost: 0 });
const pipe = definePrinted({ code: "pipe", name: "Pipe", type: "attachment", sphere: "spirit", cost: 1 });
const favor = definePrinted({ code: "favor", name: "Favor", type: "attachment", sphere: "neutral", cost: 3 });
const lead = hero("lead", "leadership", 10, 2);
const tact = hero("tact", "tactics", 9, 1);
const spirit = hero("spirit", "spirit", 8, 3);
const cards = cardMap([stage, goblin, escort, eagle, onward, pipe, favor, lead, tact, spirit]);

function record(id: string, cardCode: string, timing: Effect["timing"], instructions: Instruction[], extra: Partial<Effect> = {}): Effect {
  return { id, cardCode, lines: [`${cardCode}:A:1`], timing, instructions, ...extra };
}

// A quest stage, heroes for each seat (lead and tact for seat 0, spirit for seat 1), each seat at threat 20.
function table(seatCount: 1 | 2 = 1, phase: ScenarioState["phase"] = "Quest"): { state: ScenarioState; heroes: string[][] } {
  let state: ScenarioState = { ...idleScenario(seatCount, phase), stages: [{ code: "stage" }] };
  const placed = spawn(state, "stage", { zone: "questStage" });
  state = updateCard(placed.state, placed.id, { face: "B" });
  const heroes: string[][] = [];
  for (let seat = 0; seat < seatCount; seat += 1) {
    const ids: string[] = [];
    for (const code of seat === 0 ? ["lead", "tact"] : ["spirit"]) {
      const made = spawn(state, code, { zone: "heroes", seat });
      state = made.state;
      ids.push(made.id);
    }
    heroes.push(ids);
    state = withThreat(state, seat, 20);
  }
  return { state, heroes };
}

function add(state: ScenarioState, code: string, zone: "hand" | "play" | "staging", seat = 0) {
  return zone === "staging" ? spawn(state, code, { zone }) : spawn(state, code, { zone, seat });
}

// The quest resolves: the round is in the resolution step and settle runs it (and stops at the travel window).
function resolve(state: ScenarioState, effects: readonly Effect[], committed: readonly string[]): ScenarioState {
  let next: ScenarioState = { ...state, mode: "resolution" };
  for (const id of committed) next = updateCard(next, id, { committed: true, exhausted: true });
  return settle(next, { effects, cards }, []);
}

function run(state: ScenarioState, effect: Effect, sourceId: string, effects: readonly Effect[], seat = 0, steps: EngineStep[] = []): ScenarioState {
  return settle(pushCardEffects(state, "ResolveEffect", sourceId, seat, false, [effect], { effects, cards }, steps), { effects, cards }, steps);
}

describe("what each committed character hears when the quest resolves (rr.step-3-4)", () => {
  const resolved = record("escort:forced:1", "escort", "forced", [{ verb: "Discard", target: { kind: "self" } }], { trigger: "committedQuestResolved", subject: "self" });
  const succeeded = record("eagle:forced:1", "eagle", "forced", [{ verb: "Discard", target: { kind: "self" } }], { trigger: "questedSuccessfully", subject: "self" });
  const effects = [resolved, succeeded];

  it("a successful quest is heard by each committed character: after resolving the quest, and after questing successfully", () => {
    const { state: base } = table();
    const a = add(base, "escort", "play");
    const b = add(a.state, "eagle", "play");
    const idle = add(b.state, "escort", "play");
    const done = resolve(idle.state, effects, [a.id, b.id]);
    expect(done.cards[a.id]?.zone).toBe("discard");
    expect(done.cards[b.id]?.zone).toBe("discard");
    expect(done.cards[idle.id]?.zone).toBe("play");
  });

  it("a failed quest is heard only as resolved, and a character that was not committed hears nothing", () => {
    const { state: base } = table();
    const a = add(base, "escort", "play");
    const b = add(a.state, "eagle", "play");
    const enemy = add(b.state, "goblin", "staging");
    const quiet = add(enemy.state, "goblin", "staging");
    const done = resolve(quiet.state, effects, [a.id, b.id]);
    expect(done.seats[0]?.threat).toBe(23);
    expect(done.cards[a.id]?.zone).toBe("discard");
    expect(done.cards[b.id]?.zone).toBe("play");
  });
});

describe("the threat a failed quest raises (rr.step-3-4)", () => {
  const waive = record("doom:action:1", "onward", "action", [{ verb: "WaiveQuestThreat", who: "eachSeat", until: "endOfRound" }]);
  const answer = record("onward:response:1", "onward", "response", [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "WaiveQuestThreat", who: "picked", until: "endOfPhase" }], { trigger: "questFailed", eventSeat: "you", cost: { kind: "playEvent" } });

  it("is not raised for a seat that does not raise threat from questing unsuccessfully (10117:A:1)", () => {
    const { state: base, heroes } = table(2);
    const source = add(base, "onward", "hand");
    const waived = run(source.state, waive, source.id, [waive]);
    const enemy = add(waived, "goblin", "staging");
    const done = resolve(enemy.state, [waive], [heroes[0]?.[0] ?? ""]);
    expect(done.seats.map((seat) => seat.threat)).toEqual([20, 20]);
  });

  it("waits for the Responses to the failed quest, which can waive it for the player they choose (03005:A:1)", () => {
    const { state: base, heroes } = table(2);
    const card = add(base, "onward", "hand");
    const enemy = add(card.state, "goblin", "staging");
    const asked = resolve(enemy.state, [answer], [heroes[0]?.[1] ?? ""]);
    expect(asked.window?.kind).toBe("response");
    expect(asked.seats.map((seat) => seat.threat)).toEqual([20, 20]);
    const used = expectOk(reduce(asked, { type: "Trigger", cardId: card.id, effectId: answer.id, payments: [] }, { effects: [answer], cards }));
    expect(used.state.window?.kind).toBe("choose");
    const chosen = expectOk(reduce(used.state, { type: "Choose", optionId: "seat:1" }, { effects: [answer], cards }));
    expect(chosen.state.seats.map((seat) => seat.threat)).toEqual([22, 20]);
    expect(chosen.state.cards[card.id]?.zone).toBe("discard");
  });

  it("is raised at once when no card could answer the failed quest", () => {
    const { state: base, heroes } = table(1);
    const enemy = add(base, "goblin", "staging");
    const done = resolve(enemy.state, [answer], [heroes[0]?.[1] ?? ""]);
    expect(done.seats[0]?.threat).toBe(22);
    expect(done.stack).toEqual([]);
  });

  it("is heard as a raise by questing unsuccessfully, like an encounter card's raise, and not a player card's (02100:A:1)", () => {
    const elfhelm = record("escort:response:1", "escort", "response", [{ verb: "LowerThreat", amount: 1, who: "actor" }], { trigger: "threatRaisedByEncounter", eventSeat: "you" });
    const { state: base, heroes } = table(1);
    const ally = add(base, "escort", "play");
    const enemy = add(ally.state, "goblin", "staging");
    const asked = resolve(enemy.state, [elfhelm], [heroes[0]?.[1] ?? ""]);
    expect(asked.window?.kind).toBe("response");
    expect(asked.seats[0]?.threat).toBe(22);
    const used = expectOk(reduce(asked, { type: "Trigger", cardId: ally.id, effectId: elfhelm.id, payments: [] }, { effects: [elfhelm], cards }));
    expect(used.state.seats[0]?.threat).toBe(21);
    const raise = record("goblin:whenRevealed:1", "goblin", "whenRevealed", [{ verb: "RaiseThreat", amount: 2 }]);
    const fresh = add(table(1).state, "escort", "play");
    const revealed = add(fresh.state, "goblin", "staging");
    const byEncounter = run(revealed.state, raise, revealed.id, [elfhelm, raise]);
    expect(byEncounter.window?.kind).toBe("response");
    const played = add(fresh.state, "eagle", "play");
    const byPlayer = run(played.state, { ...raise, cardCode: "eagle" }, played.id, [elfhelm, raise]);
    expect(byPlayer.seats[0]?.threat).toBe(22);
    expect(byPlayer.window).toBeNull();
  });
});

describe("committing by an effect (rr.step-3-2)", () => {
  it("commits without exhausting, can quest with Attack, and is heard as a commitment (11005:A:2)", () => {
    const heard = record("eagle:forced:1", "eagle", "forced", [{ verb: "Ready" }], { trigger: "committed" });
    const hook = record("pipe:action:1", "pipe", "action", [{ verb: "CommitToQuest", target: "picked", stat: "attack" }]);
    const { state: base } = table();
    const ally = add(base, "eagle", "play");
    const exhausted = updateCard(ally.state, ally.id, { exhausted: true });
    const source = add(exhausted, "pipe", "play");
    const picked = run(source.state, { ...hook, instructions: [{ verb: "Pick", pick: { type: "ally", control: "you" } }, ...hook.instructions] }, source.id, [heard, hook]);
    expect(picked.cards[ally.id]?.committed).toBe(true);
    expect(picked.cards[ally.id]?.exhausted).toBe(false);
    expect(committedWillpower(picked, cards)).toBe(2);
  });

  it("lets a character that can commit while exhausted be committed in the commitment step (11009:A:1)", () => {
    const navigator = record("escort:constant:1", "escort", "constant", [{ verb: "ModifyStat", stat: "commitsExhausted", amount: 1, until: "whileSourceInPlay" }]);
    const { state: base } = table();
    const ally = add(base, "escort", "play");
    const state: ScenarioState = { ...updateCard(ally.state, ally.id, { exhausted: true }), mode: "questCommit", window: { kind: "pass" } };
    const ctx = { effects: [navigator], cards };
    expect(legalTargets(state, { type: "Commit" }, ctx)).not.toContain(ally.id);
    const synced = settle({ ...state, window: null, mode: "stopped" }, ctx, []);
    expect(legalTargets({ ...synced, mode: "questCommit", window: { kind: "pass" } }, { type: "Commit" }, ctx)).toContain(ally.id);
  });

  it("hears a character removed from the quest by an effect, which an attachment can commit again (12116:A:3)", () => {
    const windfola = record("pipe:response:1", "pipe", "response", [{ verb: "CommitToQuest", target: "host" }], { trigger: "removedFromQuest", subject: "host", cost: { kind: "exhaustSelf" } });
    const remove = record("onward:action:1", "onward", "action", [{ verb: "Pick", pick: { type: "hero", control: "you", committed: true } }, { verb: "RemoveFromQuest" }]);
    const { state: base, heroes } = table();
    const host = heroes[0]?.[0] ?? "";
    const attached = add(base, "pipe", "play");
    let state = updateCard(attached.state, attached.id, { host });
    state = updateCard(state, host, { attachments: [attached.id], committed: true });
    const source = add(state, "onward", "hand");
    const asked = run(source.state, remove, source.id, [windfola, remove]);
    expect(asked.cards[host]?.committed).toBe(false);
    expect(asked.window?.kind).toBe("response");
    const used = expectOk(reduce(asked, { type: "Trigger", cardId: attached.id, effectId: windfola.id, payments: [] }, { effects: [windfola, remove], cards }));
    expect(used.state.cards[host]?.committed).toBe(true);
  });
});

describe("a delayed effect that waits for the players to quest successfully (rr.delayed-effects, 19112:A:1)", () => {
  const bilbo = record("eagle:response:1", "eagle", "response", [
    { verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true } },
    { verb: "Delay", until: "questSucceeded", subject: "picked", instructions: [{ verb: "DamageCard", amount: 1 }] },
  ]);

  it("resolves when the quest succeeds and is dropped when it does not", () => {
    for (const success of [true, false]) {
      const { state: base, heroes } = table();
      const ally = add(base, "eagle", "play");
      const enemy = add(ally.state, "goblin", "staging");
      const scheduled = run(enemy.state, bilbo, ally.id, [bilbo]);
      expect(scheduled.delayed).toHaveLength(1);
      const done = resolve(scheduled, [bilbo], success ? [heroes[0]?.[0] ?? "", heroes[0]?.[1] ?? "", ally.id] : []);
      expect(done.delayed).toEqual([]);
      expect(done.cards[enemy.id]?.damage).toBe(success ? 1 : 0);
    }
  });
});

describe("choosing X (rr.the-word-choose)", () => {
  it("asks for a number from 1 to the least maximum, and the instructions after it read it (12036:A:2)", () => {
    const elevenses = record("onward:action:1", "onward", "action", [
      { verb: "ChooseX", max: [{ count: { type: "hero", control: "you", committed: true } }] },
      { verb: "Repeat", times: { x: true }, instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", committed: true } }, { verb: "Ready", target: "picked" }, { verb: "RemoveFromQuest" }] },
      { verb: "LowerThreat", amount: { x: true }, who: "actor" },
    ]);
    const { state: base, heroes } = table();
    let state = base;
    for (const id of heroes[0] ?? []) state = updateCard(state, id, { committed: true, exhausted: true });
    const source = add(state, "onward", "hand");
    const ctx = { effects: [elevenses], cards };
    const asked = run(source.state, elevenses, source.id, [elevenses]);
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: ["x1", "x2"] });
    const one = expectOk(reduce(asked, { type: "Choose", optionId: "x1" }, ctx));
    expect(one.state.window?.kind).toBe("choose");
    const picked = expectOk(reduce(one.state, { type: "Choose", optionId: heroes[0]?.[1] ?? "" }, ctx));
    expect(picked.state.cards[heroes[0]?.[1] ?? ""]).toMatchObject({ committed: false, exhausted: false });
    expect(picked.state.cards[heroes[0]?.[0] ?? ""]?.committed).toBe(true);
    expect(picked.state.seats[0]?.threat).toBe(19);
  });
});

describe("spending resources in an effect (rr.resources)", () => {
  const pay = record("eagle:forced:1", "eagle", "forced", [{ verb: "Choose", who: "actor", options: [
    { id: "pay", requires: { kind: "resources", min: 2, sphere: "tactics", group: true }, instructions: [{ verb: "SpendResources", amount: 2, sphere: "tactics", group: true }] },
    { id: "discard", instructions: [{ verb: "Discard", target: { kind: "self" } }] },
  ] }]);

  it("offers to pay only when the heroes hold enough of the sphere, and pays from the only pools that can when they hold just enough", () => {
    const { state: base, heroes } = table(2);
    const ally = add(base, "eagle", "play");
    const broke = run(ally.state, pay, ally.id, [pay]);
    expect(broke.cards[ally.id]?.zone).toBe("discard");
    let rich = updateCard(ally.state, heroes[0]?.[1] ?? "", { resources: 1 });
    rich = updateCard(rich, heroes[1]?.[0] ?? "", { resources: 1 });
    const tactics = hero("tact2", "tactics", 9, 1);
    const ctx = { effects: [pay], cards: new Map([...cards, ["tact2", tactics]]) };
    const second = spawn(rich, "tact2", { zone: "heroes", seat: 1 });
    rich = updateCard(second.state, second.id, { resources: 1 });
    const asked = settle(pushCardEffects(rich, "forced", ally.id, 0, false, [pay], ctx, []), ctx, []);
    expect(asked.window?.kind).toBe("choose");
    // Two Tactics pools hold one resource each: both pay, with nothing to choose (families/costs/verbs.ts spendResources).
    const first = expectOk(reduce(asked, { type: "Choose", optionId: "pay" }, ctx));
    expect(first.state.cards[second.id]?.resources).toBe(0);
    expect(first.state.cards[heroes[0]?.[1] ?? ""]?.resources).toBe(0);
    expect(first.state.cards[heroes[1]?.[0] ?? ""]?.resources).toBe(1);
    expect(first.state.cards[ally.id]?.zone).toBe("play");
  });
});

describe("threat a player card reduces, and the starting threat level (rr.threat-threat-dial, rr.initial-threat-level)", () => {
  const cap = record("lead:constant:1", "lead", "constant", [{ verb: "ModifyStat", stat: "threatReductionToOne", amount: 1, until: "whileSourceInPlay", target: "actorSeat" }]);
  const lower = record("onward:action:1", "onward", "action", [{ verb: "LowerThreat", amount: 3, who: "actor" }]);
  const pipeHears = record("pipe:response:1", "pipe", "response", [{ verb: "Draw" }], { trigger: "threatLowered", eventSeat: "you", subject: { type: "card", control: "any", cardType: "event" }, cost: { kind: "exhaustSelf" } });

  it("is reduced by at most 1 while the player holds the cap (22054:A:1), and the reduction is heard with the card that made it (141015:A:2)", () => {
    const { state: base } = table();
    const source = add(base, "onward", "hand");
    const plain = run(source.state, lower, source.id, [lower]);
    expect(plain.seats[0]?.threat).toBe(17);
    const synced = settle(source.state, { effects: [cap, lower], cards }, []);
    const capped = run(synced, lower, source.id, [cap, lower]);
    expect(capped.seats[0]?.threat).toBe(19);
    const attached = add(source.state, "pipe", "play");
    const top = spawn(attached.state, "escort", { zone: "deck", seat: 0 });
    const asked = run(top.state, lower, source.id, [lower, pipeHears]);
    expect(asked.window?.kind).toBe("response");
    const drawn = expectOk(reduce(asked, { type: "Trigger", cardId: attached.id, effectId: pipeHears.id, payments: [] }, { effects: [lower, pipeHears], cards }));
    expect(drawn.state.cards[top.id]?.zone).toBe("hand");
  });

  it("goes back to the starting threat level, kept at setup when a card reads it (04053:A:2)", () => {
    const reset = record("lead:action:1", "lead", "action", [{ verb: "ResetThreat" }]);
    const { state: base, heroes } = table();
    const kept = recordStartingThreat(withThreat(base, 0, 25), { effects: [reset], cards });
    expect(kept.startingThreat).toEqual([25]);
    expect(recordStartingThreat(base, { effects: [], cards }).startingThreat).toBeUndefined();
    const raised = withThreat(kept, 0, 33);
    expect(run(raised, reset, heroes[0]?.[0] ?? "", [reset]).seats[0]?.threat).toBe(25);
    expect(run(withThreat(kept, 0, 21), reset, heroes[0]?.[0] ?? "", [reset]).seats[0]?.threat).toBe(21);
    // Without a kept level, the heroes' threat costs (rr.initial-threat-level).
    expect(run(withThreat(base, 0, 30), reset, heroes[0]?.[0] ?? "", [reset]).seats[0]?.threat).toBe(19);
  });
});

describe("a card that keeps its player in the game at the threat elimination level (rr.threat-elimination-level, 10124:A:2)", () => {
  const save = record("favor:forced:1", "favor", "forced", [{ verb: "SetThreat", value: 45 }, { verb: "Discard", target: { kind: "self" } }], { trigger: "wouldBeEliminated", eventSeat: "you" });
  const raise = record("goblin:whenRevealed:1", "goblin", "whenRevealed", [{ verb: "RaiseThreat", amount: 5 }]);

  it("is asked instead of the player being eliminated, and is discarded; without it the player is eliminated", () => {
    const { state: base } = table();
    const card = add(base, "favor", "play");
    const enemy = add(card.state, "goblin", "staging");
    const ctx = { effects: [save, raise], cards };
    const ready = settle(withThreat(enemy.state, 0, 48), ctx, []);
    expect(ready.threatSaves).toEqual([0]);
    const saved = run(ready, raise, enemy.id, [save, raise]);
    expect(saved.seats[0]).toMatchObject({ eliminated: false, threat: 45 });
    expect(saved.cards[card.id]?.zone).toBe("discard");
    expect(saved.threatSaves).toBeUndefined();
    const lost = run(saved, { ...raise, instructions: [{ verb: "RaiseThreat", amount: 5 }] }, enemy.id, [save, raise]);
    expect(lost.seats[0]?.eliminated).toBe(true);
  });
});

describe("skipping the quest phase (rr.framework-steps, 10117:A:2)", () => {
  it("follows the planning phase with the travel phase", () => {
    const skip = record("onward:action:1", "onward", "action", [{ verb: "SkipQuestPhase" }]);
    const { state: base } = table(1, "Planning");
    const source = add(base, "onward", "hand");
    const skipped = run(source.state, skip, source.id, [skip]);
    const planning: ScenarioState = { ...skipped, mode: "planning", window: { kind: "pass" }, activeSeat: 0, planningSeat: 0 };
    const passed = expectOk(reduce(planning, { type: "Pass" }, { effects: [skip], cards }));
    expect(passed.state.phase).toBe("Travel");
    const normal = expectOk(reduce({ ...planning, modifiers: [] }, { type: "Pass" }, { effects: [skip], cards }));
    expect(normal.state.phase).toBe("Quest");
  });
});
