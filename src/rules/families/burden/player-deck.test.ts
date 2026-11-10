// Rules: mec112.poisoned-counsels-searching-eye, rr.forced, rr.the-word-choose (data/rules/entries.json); ledger lines 143072:A:1, 143021:A:1, 143021:A:2. A burden that functions like a player card, and the Setup
// choice that shuffles it into each deck, on a table of Helm's Deep.
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard, withSeat } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { legalIntents, reduce, startScenario } from "../../engine/reduce.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { encounterStart, encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { allyCard, finish, opening } from "../../../../test/harness/scene-kit.ts";
import { definePrinted } from "../../core/printed.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";

const COUNSELS = "143021";
let world: EncounterWorld;
const ctxOf = () => world.contexts.strong;

beforeAll(async () => {
  world = await encounterWorld("helms-deep");
});

const run = (state: ScenarioState, instruction: Parameters<typeof runInstruction>[1], steps: EngineStep[] = []) => runInstruction(state, instruction, { seat: 0, sourceId: null }, ctxOf(), steps);
const copies = (state: ScenarioState, seat: number) => (state.seats[seat]?.deck ?? []).filter((id) => state.cards[id]?.code === COUNSELS).length;

// The start of a game with `seats` players, every seat's opening hand kept, the first player at the Setup choice.
function atSetupChoice(seats: 1 | 2): ScenarioState {
  let state = startScenario(encounterStart(world, seats, 3), ctxOf());
  for (let guard = 0; guard < 6 && state.window?.kind !== "choose"; guard += 1) state = expectOk(reduce(state, { type: "Keep" }, ctxOf())).state;
  return state;
}

describe("143072:A:1 the Setup choice", () => {
  it("is asked of the first player, once the starting hands are drawn, and shuffling puts 1 copy into each deck", () => {
    const state = atSetupChoice(2);
    expect(state.window?.kind).toBe("choose");
    expect(state.seats.every((seat) => seat.hand.length === 7 || seat.hand.length === 6)).toBe(true);
    const offered = legalIntents(state, ctxOf());
    expect(offered.length).toBe(2);
    const counsels = expectOk(reduce(state, offered[0] as never, ctxOf())).state;
    expect([copies(counsels, 0), copies(counsels, 1)]).toEqual([1, 1]);
    expect(counsels.cards[counsels.questStage ?? ""]?.code).toBe("143072");
    for (const seat of counsels.seats) expect(seat.hand.some((id) => counsels.cards[id]?.code === COUNSELS)).toBe(false);
  });

  it("the other option advances to stage 2A and leaves the decks as they were; stage 1B's When Revealed does not resolve", () => {
    const state = atSetupChoice(1);
    const offered = legalIntents(state, ctxOf());
    const bypass = expectOk(reduce(state, offered[1] as never, ctxOf())).state;
    expect(copies(bypass, 0)).toBe(0);
    expect(bypass.cards[bypass.questStage ?? ""]?.code).toBe("143073");
    expect(bypass.window?.kind).not.toBe("choose");
  });
});

describe("143021:A:1 functions like a player card", () => {
  it("is drawn into the hand, and discarded from the hand to its owner's discard pile", () => {
    const table = probeTable(world);
    const placed = spawn(table, COUNSELS, { zone: "hand", seat: 0 });
    expect(placed.state.seats[0]?.hand).toContain(placed.id);
    const discarded = run(placed.state, { verb: "DiscardEach", pick: { type: "card", control: "you", from: "hand" } });
    expect(discarded.seats[0]?.discard).toContain(placed.id);
    expect(discarded.cards[placed.id]?.zone).toBe("discard");
  });

  it("is never played: the engine offers no play of it and refuses one", () => {
    const table = { ...probeTable(world), ...opening("Planning") };
    const placed = spawn(table, COUNSELS, { zone: "hand", seat: 0 });
    const state = { ...placed.state, window: { kind: "pass" } as const };
    expect(legalIntents(state, ctxOf()).some((intent) => intent.type === "PlayCard" && "cardId" in intent && intent.cardId === placed.id)).toBe(false);
    expect(reduce(state, { type: "PlayCard", cardId: placed.id, payments: [] } as never, ctxOf()).ok).toBe(false);
  });
});

describe("143021:A:2 after it is drawn the rest of the hand is discarded", () => {
  it("discards every other card in the hand and keeps itself", () => {
    const table = probeTable(world);
    const hand = table.seats[0]?.hand ?? [];
    expect(hand.length).toBeGreaterThan(1);
    const top = spawn(table, COUNSELS, { zone: "deck", seat: 0 });
    const held = top.state.seats[0];
    const onTop = withSeat(top.state, 0, { ...held, deck: [top.id, ...held.deck.filter((id) => id !== top.id)] });
    const steps: EngineStep[] = [];
    const drawn = run(onTop, { verb: "Draw", amount: 1 }, steps);
    const done = finish({ state: settle({ ...drawn, window: null }, ctxOf(), steps), steps }, ctxOf()).state;
    expect(done.seats[0]?.hand).toEqual([top.id]);
    for (const id of hand) expect(done.seats[0]?.discard).toContain(id);
  });

  it("DiscardEach from the hand leaves the source card in the hand", () => {
    const table = probeTable(world);
    const placed = spawn(table, COUNSELS, { zone: "hand", seat: 0 });
    const done = runInstruction(placed.state, { verb: "DiscardEach", pick: { type: "card", control: "you", from: "hand" } }, { seat: 0, sourceId: placed.id }, ctxOf(), []);
    expect(done.seats[0]?.hand).toEqual([placed.id]);
    expect(updateCard(done, placed.id, {}).seats[0]?.discard.length).toBe(table.seats[0]?.hand.length);
  });
});

describe("143072:B:1 each player puts an ally that matches a hero's sphere into play", () => {
  // The stand-in heroes are Tactics: a Tactics ally matches, a neutral one matches no sphere, a Spirit one is another sphere.
  let ctx: ReturnType<typeof ctxOf>;
  beforeAll(() => {
    const cards = new Map(ctxOf().cards);
    cards.set("t-tactics", definePrinted({ code: "t-tactics", name: "t-tactics", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
    cards.set("t-spirit", definePrinted({ code: "t-spirit", name: "t-spirit", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
    cards.set("t-neutral", allyCard("t-neutral", 1));
    ctx = { ...ctxOf(), cards };
  });

  const inHand = (state: ScenarioState, extra: readonly string[]): ScenarioState => extra.reduce((current, code) => spawn(current, code, { zone: "hand", seat: 0 }).state, state);
  const codesIn = (state: ScenarioState, zone: string): string[] => Object.values(state.cards).filter((card) => card.zone === zone && card.controller === 0).map((card) => card.code);

  it("puts the matching ally into play at stage 1B's When Revealed, whatever else is held, and no other", () => {
    let state = startScenario(encounterStart(world, 1, 3), ctx);
    state = inHand(state, ["t-neutral", "t-spirit", "t-tactics"]);
    for (let guard = 0; guard < 6 && state.window?.kind !== "choose"; guard += 1) state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    const offered = legalIntents(state, ctx);
    state = finish({ state: expectOk(reduce(state, offered[0] as never, ctx)).state, steps: [] }, ctx).state;
    expect(codesIn(state, "play")).toContain("t-tactics");
    expect(codesIn(state, "play")).not.toContain("t-neutral");
    expect(codesIn(state, "play")).not.toContain("t-spirit");
  });

  it("143072:A:1 bypassing stage 1B puts nothing into play: its When Revealed never resolves", () => {
    let state = startScenario(encounterStart(world, 1, 3), ctx);
    state = inHand(state, ["t-tactics"]);
    for (let guard = 0; guard < 6 && state.window?.kind !== "choose"; guard += 1) state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    const offered = legalIntents(state, ctx);
    state = finish({ state: expectOk(reduce(state, offered[1] as never, ctx)).state, steps: [] }, ctx).state;
    expect(state.cards[state.questStage ?? ""]?.code).toBe("143073");
    expect(codesIn(state, "play")).not.toContain("t-tactics");
  });
});
