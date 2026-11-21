// Rules: mec108.create-staging-area, mec108.joining-another-player, mec108.captured-cards, mec108.captured-deck, rr.first-player, rr.lasting-effects, faq.lasting-effects, rr.effects (data/rules/entries.json);
// ledger lines 10039:B:2, 10044:A:2, 10046:A:2, 10049:A:2, 10051:A:1, 10174:B:1.
// Two players in separate staging areas (the game as the Setup leaves it): who "the first player" is inside an area, what each effect reaches, and the joining of one area to another over a played round.
import { beforeAll, describe, expect, it } from "vitest";

import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { legalIntents, reduce } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { capturedUnder } from "../../../rules/families/captured/pile.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { rescueRandom } from "../../../rules/families/captured/rescue.ts";
import { resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { begin as begun } from "../../../../test/scenarios/escape-from-mount-gram/begun.ts";
import { gramIntent, gramWorld } from "../../../../test/scenarios/escape-from-mount-gram/game.ts";

describe("Separate staging areas", () => {
  let world: Awaited<ReturnType<typeof gramWorld>>;
  let ctx: ReduceContext;
  beforeAll(async () => {
    world = await gramWorld("strong");
    ctx = world.ctx;
  }, 120_000);

  const two = () => begun(ctx, 2);
  const areaOf = (state: ScenarioState, seat: number, code: string) => state.seats[seat]?.staging.find((id) => state.cards[id]?.code === code) ?? "";
  // A card of the seat's area, with its own captured cards underneath it.
  function hostWith(state: ScenarioState, seat: number, code: string, held: readonly string[]): { state: ScenarioState; id: string } {
    // The card's own Capture X took cards on entering play; the test places the ones it wants under it.
    const entered = spawn(state, code, { zone: "staging", area: seat }, "up");
    const made = { id: entered.id, state: capturedUnder(entered.state, entered.id).reduce((next, taken) => moveCard(next, taken, { zone: "removed" }), entered.state) };
    return { id: made.id, state: held.reduce((next, held_) => spawn(next, held_, { zone: "captured", hostId: made.id, seat }, "down").state, made.state) };
  }
  const settled = (state: ScenarioState): ScenarioState => settle({ ...state, window: null }, ctx, []);
  const offered = (state: ScenarioState) => legalIntents(state, ctx).filter((intent) => intent.type === "Trigger");

  it("10044:A:2 is answered by the first player of the area Dungeon Guard was in, not by the first player of the table", () => {
    const base = hostWith(two(), 1, "10044", ["10176", "10178"]);
    expect(base.state.firstPlayer).toBe(0);
    const gone = settled(moveCard(base.state, base.id, { zone: "encounterDiscard" }));
    expect(gone.activeSeat).toBe(1);
    const trigger = offered(gone)[0];
    expect(trigger).toMatchObject({ type: "Trigger", cardId: base.id });
    // The player chooses one of the rescued cards (their own) and it goes into play under its owner, at no cost.
    let run = expectOk(reduce(gone, trigger!, ctx)).state;
    for (let guard = 0; guard < 5 && run.window?.kind === "choose"; guard += 1) run = expectOk(reduce(run, { type: "Choose", optionId: run.window.options[0] ?? "" }, ctx)).state;
    expect(run.seats[1].play.length).toBe(1);
    expect(run.seats[0].play.length).toBe(0);
  });

  it("10046:A:2 is answered by the first player of the area, after the players of that area travel to Prison Cell", () => {
    const state = two();
    const cell = areaOf(state, 1, "10046");
    // The second player's area travels there: its cards are looked at and one is put into play under its owner.
    const traveled = settled({ ...state, seats: state.seats.map((seat, index) => (index === 1 ? { ...seat, active: cell, staging: seat.staging.filter((id) => id !== cell) } : seat)) as unknown as ScenarioState["seats"], pendingEvents: [{ trigger: "traveled", seat: 1, cardId: cell, subject: cell }] });
    const trigger = offered(traveled).find((intent) => intent.type === "Trigger" && intent.cardId === cell);
    expect(trigger).toBeTruthy();
    expect(traveled.activeSeat).toBe(1);
  });

  // The first player joined the second: both share the second player's area (mec108.joining-another-player).
  const joined = (state: ScenarioState): ScenarioState => {
    const [first, second] = state.seats;
    const { stage: _stage, active: _active, ...rest } = first;
    return { ...state, seats: [{ ...rest, staging: [], joined: 1 }, second] as unknown as ScenarioState["seats"] };
  };
  const firstOption = (current: ScenarioState) => (current.window?.kind === "choose" ? (current.window.options[0] ?? "") : "");

  it("10047:A:1 a player the Travel cost eliminates (threat 48, 3 more) leaves the game and the travel effect ends: the intent is accepted, not refused", () => {
    const room = spawn(joined(two()), "10047", { zone: "staging", area: 1 }, "up");
    const seats = room.state.seats.map((seat, index) => (index === 1 ? { ...seat, threat: 48 } : seat)) as unknown as ScenarioState["seats"];
    const state: ScenarioState = { ...room.state, seats, phase: "Travel", activeSeat: 1, window: { kind: "travel" } as ScenarioState["window"] };
    const result = expectOk(reduce(state, { type: "Travel", locationId: room.id }, ctx));
    expect(result.state.seats[1]?.eliminated).toBe(true);
  });

  it("10051:A:1 captures only the ally of the player who has one, whichever player it is, and nothing of the earlier player's picks", () => {
    // Only the first player has an ally: the second player, with none, picks nothing and captures nothing.
    const mine = spawn(joined(two()), "10176", { zone: "play", seat: 0 }, "up");
    const run = resolveRecords(mine.state, ctx, "10051", "whenRevealed", undefined, firstOption);
    expect(run.state.cards[mine.id]).toMatchObject({ zone: "captured", owner: 0 });
    // Only the second player has one: the first player, with none, captures nothing, and the second player's ally is captured under a card of the area.
    const theirs = spawn(joined(two()), "10178", { zone: "play", seat: 1 }, "up");
    const second = resolveRecords(theirs.state, ctx, "10051", "whenRevealed", undefined, firstOption);
    expect(second.state.cards[theirs.id]).toMatchObject({ zone: "captured", owner: 1 });
    expect(second.state.seats[0].play).toHaveLength(0);
    // Both have one: each is captured, under a card of the area.
    const both = spawn(spawn(joined(two()), "10176", { zone: "play", seat: 0 }, "up").state, "10178", { zone: "play", seat: 1 }, "up");
    const all = resolveRecords(both.state, ctx, "10051", "whenRevealed", undefined, firstOption);
    expect(all.state.seats[0].play.length + all.state.seats[1].play.length).toBe(0);
  });

  it("10051:A:1 leaves a player's ally alone when the area is not theirs: only the players of the area the card is revealed in capture an ally", () => {
    const theirs = spawn(two(), "10178", { zone: "play", seat: 1 }, "up");
    const run = resolveRecords(theirs.state, ctx, "10051", "whenRevealed", undefined, firstOption);
    expect(run.state.cards[theirs.id]?.zone).toBe("play");
  });

  it("10049:A:2 reaches the enemies of its own staging area only, and an enemy it adds gets the bonus too; an enemy in another area is not 'in play' for it", () => {
    const state = two();
    // An enemy in the second player's area; the first player's area holds none.
    const elsewhere = spawn(state, "10043", { zone: "staging", area: 1 }, "up");
    const run = resolveRecords(elsewhere.state, ctx, "10049", "whenRevealed", undefined, (current) => (current.window?.kind === "choose" ? (current.window.options[0] ?? "") : ""));
    const torturer = elsewhere.id;
    // The other area's enemy keeps its printed Attack and engagement cost.
    expect(modifiedStat(run.state, run.state.cards[torturer]!, "attack", ctx.cards)).toBe(3);
    expect(modifiedStat(run.state, run.state.cards[torturer]!, "engagementCost", ctx.cards)).toBe(36);
    // The first player's area has no enemy, so one is searched for and added to it: an enemy of the deck or discard, with -10 and +1.
    const found = Object.values(run.state.cards).filter((card) => card.zone === "staging" && ctx.cards.get(card.code)?.type === "enemy" && card.id !== torturer);
    for (const card of found) {
      const printed = ctx.cards.get(card.code)!;
      const without = { ...run.state, modifiers: run.state.modifiers.filter((modifier) => modifier.until !== "endOfRound") };
      expect(modifiedStat(run.state, card, "attack", ctx.cards)).toBe(modifiedStat(without, card, "attack", ctx.cards) + 1);
      expect(modifiedStat(run.state, card, "engagementCost", ctx.cards)).toBe(Math.max(0, (printed.engagementCost ?? 0) - 10));
    }
    expect(found.length).toBeGreaterThan(0);
  });

  // The auto-player plays until `done` holds; every intent is one the reducer listed.
  function runUntil(start: ScenarioState, done: (state: ScenarioState) => boolean): ScenarioState {
    let state = start;
    const memory = new Set<string>();
    for (let guard = 0; guard < 400 && !done(state) && !state.lost && !state.stageCleared; guard += 1) {
      const intent = gramIntent(state, ctx, memory);
      state = expectOk(reduce(state, intent, ctx)).state;
    }
    return state;
  }

  it("10039:B:2 joins the second player's area at the beginning of the travel phase of a played round once the first player's stage 2B holds no captured card, and the second player's stage goes on", () => {
    let state = two();
    // The first player's stage holds nothing (progress rescued every card); the second player's holds many more cards than a round's progress rescues.
    state = rescueRandom(state, state.seats[0].stage ?? "", 7);
    const second = state.seats[1].stage ?? "";
    for (let count = 0; count < 60; count += 1) state = spawn(state, "10176", { zone: "captured", hostId: second, seat: 1 }, "down").state;
    const played = runUntil(state, (current) => current.seats[0].joined != null);
    expect(played.phase).toBe("Travel");
    expect(played.seats[0].joined).toBe(1);
    expect(played.seats[0].stage).toBeUndefined();
    expect(played.seats[1].stage).toBe(second);
    expect(played.separate).toBe(true);
    // The joined player takes part in the rest of the round (travel, encounter, combat, refresh): the quest and the travel phase of a game with a joined seat play through.
    const later = runUntil(played, (current) => current.round > played.round);
    expect(later.round).toBeGreaterThan(played.round);
    expect(later.lost).toBeFalsy();
  });

  it("10039:B:2 advances all players together to stage 3A when no captured card is left under any stage, Southern Gate and Jailor Gornákh joining the shared staging area", () => {
    let state = two();
    for (const seat of [0, 1]) state = rescueRandom(state, state.seats[seat]?.stage ?? "", 7);
    const played = runUntil(state, (current) => current.separate !== true);
    expect(played.separate).not.toBe(true);
    expect(played.cards[played.questStage ?? ""]?.code).toBe("10040");
    const staged = Object.values(played.cards).filter((card) => card.zone === "staging").map((card) => card.code);
    expect(staged).toContain("10042");
    expect(staged).toContain("10041");
  });
});
