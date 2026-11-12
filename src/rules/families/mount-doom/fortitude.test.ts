import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { legalIntents } from "../../engine/reduce.ts";
import { pruneRoundRecords } from "../../quest/hide.ts";
import { hero, send, table, type TableSpec } from "../defense/table.ts";
import { STOP } from "./stop.ts";

// Rules: mec113.fortitude-tests, mec113.player-actions-during-fortitude-tests (data/rules/entries.json); ledger line 146043:A:3. The Fortitude test: commit, discard, count, actions, measure.

const card = (code: string, eyeIcons?: number) => definePrinted({ code, name: code, type: "treachery", keywords: eyeIcons ? { eyeIcons } : {} });
const RAISE_4: Instruction = { verb: "RaiseThreat", amount: 4, when: { kind: "lastFortitudeFailed" } };
const TEST: Instruction = { verb: "FortitudeTest" };

type Options = Partial<TableSpec> & { instructions?: readonly Instruction[]; effects?: readonly Effect[] };

// A table whose effect frame runs `instructions` for seat 0, settled to the first window the test opens. Hero "a" has Willpower 3, "b" 2; the threat is 30 (X = 3).
function begin(options: Options = {}) {
  const { instructions = [TEST, RAISE_4], ...rest } = options;
  const base = table({ cards: [hero("a", { willpower: 3 }), hero("b", { willpower: 2 }), card("e0"), card("e1", 1), card("e2", 2), card("e3", 3)], effects: [], heroes: [{ code: "a" }], threat: 30, ...rest });
  const pushed = pushEffectFrame({ ...base.state, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [...instructions, STOP], cancel: null, blockCancel: null }, []);
  return { ...base, state: settle(pushed, base.ctx, []) };
}

type Begun = ReturnType<typeof begin>;
const threat = (state: ScenarioState, seat = 0) => state.seats[seat]?.threat ?? 0;
const commit = (run: Begun, ...keys: string[]) => send(run.state, { type: "CommitFortitude", cardIds: keys.map((key) => run.ids[key] ?? "") }, run.ctx);
const pass = (state: ScenarioState, run: Begun) => send(state, { type: "Pass" }, run.ctx);
// Commit the given heroes and pass the action window: the test is measured.
const resolve = (run: Begun, ...keys: string[]) => pass(commit(run, ...keys), run);

describe("FortitudeTest (146043:A:3)", () => {
  it("asks the tester which ready heroes to commit, and exhausts the ones committed", () => {
    const run = begin({ encounter: ["e1", "e1", "e1"] });
    expect(run.state.window).toEqual({ kind: "fortitudeCommit", seat: 0 });
    expect(legalIntents(run.state, run.ctx)).toEqual([{ type: "CommitFortitude" }]);
    expect(commit(run, "a").cards[run.ids.a ?? ""]?.exhausted).toBe(true);
  });

  it("discards the top X cards, X the tens digit of the tester's threat, and passes when the Willpower is greater than the icons", () => {
    const run = begin({ encounter: ["e1", "e1", "e0", "e3"] });
    const committed = commit(run, "a");
    expect(committed.window?.kind).toBe("frameAction");
    expect(committed.encounterDiscard.map((id) => committed.cards[id]?.code)).toEqual(["e1", "e1", "e0"]);
    const done = pass(committed, run);
    expect(threat(done)).toBe(30);
    expect(done.window?.kind).toBe("choose");
  });

  it("fails on a tie: Willpower 3 against 3 icons", () => {
    const run = begin({ encounter: ["e1", "e2", "e0"] });
    expect(threat(resolve(run, "a"))).toBe(34);
  });

  it("fails with X = 0 and no hero committed, and passes with X = 0 and a hero committed", () => {
    const none = begin({ threat: 9, encounter: ["e1"] });
    expect(threat(resolve(none))).toBe(13);
    const one = begin({ threat: 9, encounter: ["e1"] });
    expect(threat(resolve(one, "a"))).toBe(9);
  });

  it("adds the Willpower of every hero committed", () => {
    const run = begin({ heroes: [{ code: "a" }, { code: "b" }], encounter: ["e2", "e1", "e0"] });
    expect(threat(resolve(run, "a", "b"))).toBe(30);
    const alone = begin({ heroes: [{ code: "a" }, { code: "b" }], encounter: ["e2", "e1", "e0"] });
    expect(threat(resolve(alone, "a"))).toBe(34);
  });

  it("does not ask a player with no ready hero to commit", () => {
    const tired = table({ cards: [hero("a", { willpower: 3 }), card("e0")], effects: [], heroes: [{ code: "a" }], threat: 30, encounter: ["e0", "e0", "e0"] });
    const id = tired.ids.a ?? "";
    const exhausted = { ...tired.state, window: null, cards: { ...tired.state.cards, [id]: { ...tired.state.cards[id]!, exhausted: true } } };
    const pushed = pushEffectFrame(exhausted, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [TEST, RAISE_4, STOP], cancel: null, blockCancel: null }, []);
    expect(settle(pushed, tired.ctx, []).window?.kind).toBe("frameAction");
  });

  it("refuses a hero that is exhausted or committed twice", () => {
    const run = begin({ encounter: ["e0", "e0", "e0"] });
    const id = run.ids.a ?? "";
    expect(() => send(run.state, { type: "CommitFortitude", cardIds: [id, id] }, run.ctx)).toThrow();
  });

  it("counts the icons the verb adds when its condition holds", () => {
    const extra = (amount: number, phase: "Encounter" | "Quest"): Instruction => ({ verb: "FortitudeTest", extraEyes: { amount, when: { kind: "phase", is: phase } } });
    const loses = begin({ instructions: [extra(3, "Encounter"), RAISE_4], encounter: ["e0", "e0", "e0"] });
    expect(threat(resolve(loses, "a"))).toBe(34);
    const wins = begin({ instructions: [extra(2, "Encounter"), RAISE_4], encounter: ["e0", "e0", "e0"] });
    expect(threat(resolve(wins, "a"))).toBe(30);
    const unmet = begin({ instructions: [extra(3, "Quest"), RAISE_4], encounter: ["e0", "e0", "e0"] });
    expect(threat(resolve(unmet, "a"))).toBe(30);
  });

  it("counts what the table adds to each test (the flag fortitudeEyes)", () => {
    const run = begin({ encounter: ["e0", "e0", "e0"] });
    const held = { ...run.state, modifiers: [...run.state.modifiers, { instanceId: "table", sourceId: "x", stat: "fortitudeEyes" as const, amount: 3, until: "endOfGame" as const }] };
    expect(threat(pass(send(held, { type: "CommitFortitude", cardIds: [run.ids.a ?? ""] }, run.ctx), run))).toBe(34);
  });

  it("bars a hero that holds noFortitudeCommit", () => {
    const run = begin({ encounter: ["e0", "e0", "e0"] });
    const barred = { ...run.state, modifiers: [...run.state.modifiers, { instanceId: run.ids.a ?? "", sourceId: "x", stat: "noFortitudeCommit" as const, amount: 1, until: "endOfGame" as const }] };
    expect(() => send(barred, { type: "CommitFortitude", cardIds: [run.ids.a ?? ""] }, run.ctx)).toThrow();
    expect(send(barred, { type: "CommitFortitude", cardIds: [] }, run.ctx).window?.kind).toBe("frameAction");
  });

  it("discards one extra card for each player when the verb says so, counted with the rest", () => {
    const run = begin({ instructions: [{ verb: "FortitudeTest", extraCards: { players: true } }, RAISE_4], encounter: ["e0", "e0", "e0", "e3", "e1"] });
    const committed = commit(run, "a");
    expect(committed.encounterDiscard).toHaveLength(4);
    expect(threat(pass(committed, run))).toBe(34);
  });

  it("shuffles the encounter discard pile into an empty deck to go on discarding", () => {
    // One card in all: the discard pile goes back into the deck, so the same 1-icon card is discarded for the test three times.
    const run = begin({ encounter: ["e1"] });
    expect(threat(pass(commit(run, "a"), run))).toBe(34);
  });

  it("shuffles the discard pile back when the last discard empties the deck, so the failed test's reveal has a card (Orc Captain, 146051:A:1)", () => {
    // X = 4 and exactly 4 cards in the deck: the 4 icons beat Willpower 3, and the refilled deck gives the reveal its card.
    const reveal: Instruction = { verb: "RevealEncounter", who: "actor", when: { kind: "lastFortitudeFailed" } };
    const run = begin({ instructions: [TEST, reveal], threat: 40, encounter: ["e1", "e1", "e1", "e1"] });
    const committed = commit(run, "a");
    expect(committed.encounterDeck).toHaveLength(4);
    const done = pass(committed, run);
    // One of the four was revealed (a treachery with no text goes to the discard pile); the other three are the deck.
    expect(done.encounterDeck).toHaveLength(3);
    expect(done.encounterDiscard).toHaveLength(1);
  });

  it("lets the players act before the Willpower is measured: the window is an action window inside the test", () => {
    const committed = commit(begin({ encounter: ["e2", "e0", "e0"] }), "a");
    expect(committed.window?.kind).toBe("frameAction");
    expect(committed.stack.at(-1)?.frame).toBe("fortitude");
  });
});

describe("the result of a Fortitude test", () => {
  it("is read by lastFortitudePassed and lastFortitudeFailed on the effect that made it", () => {
    const run = begin({ instructions: [TEST, { verb: "RaiseThreat", amount: 1, when: { kind: "lastFortitudePassed" } }, RAISE_4], encounter: ["e0", "e0", "e0"] });
    expect(threat(resolve(run, "a"))).toBe(31);
  });

  it("is false for both before the effect has made a test", () => {
    const run = begin({ instructions: [{ verb: "RaiseThreat", amount: 1, when: { kind: "lastFortitudePassed" } }, { verb: "RaiseThreat", amount: 2, when: { kind: "lastFortitudeFailed" } }] });
    expect(threat(run.state)).toBe(30);
  });

  it("is remembered for the round, for the player who failed, and the next round forgets it", () => {
    const run = begin({ encounter: ["e3", "e0", "e0"] });
    const done = resolve(run, "a");
    expect(done.fortitudeFailures).toEqual([{ seat: 0, round: done.round, phase: done.phase }]);
    expect(pruneRoundRecords(done).fortitudeFailures).toHaveLength(1);
    expect(pruneRoundRecords({ ...done, round: done.round + 1 }).fortitudeFailures).toEqual([]);
  });

  it("is not recorded when the test is passed", () => {
    const run = begin({ encounter: ["e0", "e0", "e0"] });
    expect(resolve(run, "a").fortitudeFailures).toBeUndefined();
  });
});
