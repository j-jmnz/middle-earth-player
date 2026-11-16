import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { legalIntents } from "../../engine/reduce.ts";
import { spawn } from "../../core/zones.ts";
import { ally, hero, send, table, type TableSpec } from "../defense/table.ts";
import { STOP } from "../mount-doom/stop.ts";

// Rules: sotm.escape-test, sotm.escape-test-example, rr.running-out-of-cards (data/rules/entries.json); ledger lines 02109:A:1, 02107:A:2, 02114:A:1, 900803:A:1, 900807:A:1. The escape test: commit, one action window, deal, measure.

const card = (code: string) => definePrinted({ code, name: code, type: "treachery" });
const value = (code: string, amount: number): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:2`], timing: "constant", instructions: [{ verb: "EscapeValue", amount }] });
const RAISE_4: Instruction = { verb: "RaiseThreat", amount: 4, when: { kind: "lastEscapeFailed" } };
const RAISE_1: Instruction = { verb: "RaiseThreat", amount: 1, when: { kind: "lastEscapePassed" } };
const test = (cards: number, rest: Partial<Extract<Instruction, { verb: "EscapeTest" }>> = {}): Instruction => ({ verb: "EscapeTest", cards, ...rest });
const EFFECTS: readonly Effect[] = [value("e0", 0), value("e1", 1), value("e2", 2), value("e3", 3), value("e5", 5)];

type Options = Partial<TableSpec> & { instructions?: readonly Instruction[] };

// A table whose effect frame runs `instructions` for seat 0, settled to the first window the test opens. Hero "a" has Willpower 3, "b" 2; the threat is 30.
function begin(options: Options = {}) {
  const { instructions = [test(2), RAISE_4, RAISE_1], effects = [], ...rest } = options;
  const base = table({ cards: [hero("a", { willpower: 3, attack: 4, defense: 1 }), hero("b", { willpower: 2 }), ally("x", { willpower: 4 }), card("e0"), card("e1"), card("e2"), card("e3"), card("e5")], effects: [...EFFECTS, ...effects], heroes: [{ code: "a" }], threat: 30, ...rest });
  const pushed = pushEffectFrame({ ...base.state, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [...instructions, STOP], cancel: null, blockCancel: null }, []);
  return { ...base, state: settle(pushed, base.ctx, []) };
}

type Begun = ReturnType<typeof begin>;
const threat = (state: ScenarioState, seat = 0) => state.seats[seat]?.threat ?? 0;
const commit = (run: Begun, state: ScenarioState, ...keys: string[]) => send(state, { type: "CommitEscape", cardIds: keys.map((key) => run.ids[key] ?? "") }, run.ctx);
const pass = (state: ScenarioState, run: Begun) => send(state, { type: "Pass" }, run.ctx);
// Commit the given characters and pass the action window: the test is measured.
const resolve = (run: Begun, ...keys: string[]) => pass(commit(run, run.state, ...keys), run);

describe("EscapeTest (02109:A:1, 02107:A:2)", () => {
  it("asks the tester which ready characters to commit, and exhausts the ones committed", () => {
    const run = begin({ encounter: ["e0", "e0"] });
    expect(run.state.window).toEqual({ kind: "escapeCommit", seat: 0 });
    expect(legalIntents(run.state, run.ctx)).toEqual([{ type: "CommitEscape" }]);
    expect(commit(run, run.state, "a").cards[run.ids.a ?? ""]?.exhausted).toBe(true);
  });

  it("offers allies too, and counts the Willpower of every character committed", () => {
    const run = begin({ allies: [{ code: "x" }], encounter: ["e5", "e0"] });
    expect(threat(resolve(run, "a"))).toBe(34);
    const both = begin({ allies: [{ code: "x" }], encounter: ["e5", "e0"] });
    expect(threat(resolve(both, "a", "x"))).toBe(31);
  });

  it("deals the cards after the action window, counts each at its Escape value and passes only when the committed total is higher", () => {
    const run = begin({ encounter: ["e2", "e0", "e5"] });
    const committed = commit(run, run.state, "a");
    // The action window comes before the cards are dealt.
    expect(committed.window?.kind).toBe("frameAction");
    expect(committed.encounterDiscard).toEqual([]);
    const done = pass(committed, run);
    expect(done.encounterDiscard.map((id) => done.cards[id]?.code)).toEqual(["e2", "e0"]);
    // 3 against 2 passes: the passed branch raises the threat by 1.
    expect(threat(done)).toBe(31);
  });

  it("fails on a tie, and fails with nothing committed even against nothing dealt", () => {
    expect(threat(resolve(begin({ encounter: ["e1", "e2"] }), "a"))).toBe(34);
    expect(threat(resolve(begin({ encounter: ["e0", "e0"] })))).toBe(34);
    expect(threat(resolve(begin({ instructions: [test(0), RAISE_4, RAISE_1], encounter: ["e0"] })))).toBe(34);
  });

  it("counts a card with no Escape value as 0", () => {
    const run = begin({ cards: [hero("a", { willpower: 1 }), card("plain")], encounter: ["plain", "plain"] });
    expect(threat(resolve(run, "a"))).toBe(31);
  });

  it("counts the stat the verb names: Attack or Defense instead of Willpower", () => {
    const attack = begin({ instructions: [test(1, { stat: "attack" }), RAISE_4, RAISE_1], encounter: ["e3"] });
    // The hero has Attack 4 against Escape 3.
    expect(threat(resolve(attack, "a"))).toBe(31);
    const defense = begin({ instructions: [test(1, { stat: "defense" }), RAISE_4, RAISE_1], encounter: ["e3"] });
    expect(threat(resolve(defense, "a"))).toBe(34);
  });

  it("makes no test for a tester out of the game", () => {
    const base = table({ seatCount: 2, cards: [hero("a"), hero("b")], effects: EFFECTS, heroes: [{ code: "a" }, { code: "b", seat: 1 }], threat: 30 });
    const [first, second] = base.state.seats;
    const out = { ...base.state, window: null, seats: [first, { ...second, eliminated: true }] as unknown as typeof base.state.seats };
    const pushed = pushEffectFrame(out, { frame: "whenRevealed", sourceId: null, actor: 1, peril: false, effectId: "test", instructions: [test(1), STOP], cancel: null, blockCancel: null }, []);
    expect(settle(pushed, base.ctx, []).window?.kind).toBe("choose");
  });

  it("refills an empty encounter deck from the discard pile without the cards already dealt for the test", () => {
    const run = begin({ encounter: ["e1"], instructions: [test(3), RAISE_4, RAISE_1] });
    const piled = spawn(spawn(run.state, "e0", { zone: "encounterDiscard" }).state, "e0", { zone: "encounterDiscard" }).state;
    const done = pass(commit(run, piled, "a"), run);
    // The first card dealt is not shuffled back in: the other two are dealt and the deck is empty again.
    expect(done.encounterDeck).toEqual([]);
    expect(done.encounterDiscard.map((id) => done.cards[id]?.code).sort()).toEqual(["e0", "e0", "e1"]);
  });

  it("deals fewer cards when the deck and the discard pile run out", () => {
    const run = begin({ encounter: ["e1"], instructions: [test(4), RAISE_4, RAISE_1] });
    const done = pass(commit(run, run.state, "a"), run);
    expect(done.encounterDiscard.length).toBe(1);
    expect(threat(done)).toBe(31);
  });
});

describe("a party test (02107:A:2)", () => {
  const party = (extra: Partial<Options> = {}) => begin({ seatCount: 2, heroes: [{ code: "a" }, { code: "b", seat: 1 }], instructions: [{ verb: "EscapeTest", who: "party", cards: { players: true } }, RAISE_4, RAISE_1], ...extra });

  it("asks every player in turn, the first player first, and totals what they commit against one set of cards, one for each player", () => {
    const run = party({ encounter: ["e3", "e1", "e5"] });
    expect(run.state.window).toEqual({ kind: "escapeCommit", seat: 0 });
    const first = commit(run, run.state, "a");
    expect(first.window).toEqual({ kind: "escapeCommit", seat: 1 });
    const second = commit(run, first, "b");
    expect(second.window?.kind).toBe("frameAction");
    // Both players pass the one action window.
    const done = pass(pass(second, run), run);
    // 3 + 2 = 5 against 3 + 1 = 4: passed, and only one test ran.
    expect(done.encounterDiscard.length).toBe(2);
    expect(threat(done, 0)).toBe(31);
  });

  it("fails when the players together do not beat the cards", () => {
    const run = party({ encounter: ["e5", "e0"] });
    const done = pass(pass(commit(run, commit(run, run.state, "a"), "b"), run), run);
    expect(threat(done, 0)).toBe(34);
  });

  it("does not ask a player with no ready character", () => {
    const base = party({ encounter: ["e0", "e0"] });
    const tired = { ...base.state, cards: { ...base.state.cards, [base.ids.a ?? ""]: { ...base.state.cards[base.ids.a ?? ""]!, exhausted: true } } };
    const reset = pushEffectFrame({ ...tired, window: null, stack: [] }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [{ verb: "EscapeTest", who: "party", cards: 1 }, STOP], cancel: null, blockCancel: null }, []);
    expect(settle(reset, base.ctx, []).window).toEqual({ kind: "escapeCommit", seat: 1 });
  });
});

describe("what the table adds to an escape test (02114:A:1, 900803:A:1, 900807:A:1)", () => {
  const flag = (stat: "escapeValueBonus" | "escapeSelfValue" | "escapeCommitLimit", amount: number, instanceId: string) => ({ instanceId, sourceId: "x", stat, amount, until: "endOfGame" as const });

  it("counts escapeValueBonus on each card dealt, a card with no printed value too", () => {
    const run = begin({ encounter: ["e0", "e0"] });
    const held = { ...run.state, modifiers: [...run.state.modifiers, flag("escapeValueBonus", 1, "table")] };
    // 3 against 1 + 1 passes; against 2 cards counting 2 each it fails.
    expect(threat(pass(commit(run, held, "a"), run))).toBe(31);
    const more = { ...run.state, modifiers: [...run.state.modifiers, flag("escapeValueBonus", 2, "table")] };
    expect(threat(pass(commit(run, more, "a"), run))).toBe(34);
  });

  it("counts the Escape value of a card in play that holds escapeSelfValue, once for each card", () => {
    const base = begin({ staging: [{ code: "e2", key: "q1" }, { code: "e2", key: "q2" }], encounter: ["e0", "e0"] });
    const hold = (state: ScenarioState, ...ids: string[]) => ({ ...state, modifiers: [...state.modifiers, ...ids.map((id) => flag("escapeSelfValue", 1, base.ids[id] ?? ""))] });
    // 3 against one card in play adding 2: passes; against two adding 4: fails.
    expect(threat(pass(commit(base, hold(base.state, "q1"), "a"), base))).toBe(31);
    expect(threat(pass(commit(base, hold(base.state, "q1", "q2"), "a"), base))).toBe(34);
  });

  it("limits the characters a player may commit (escapeCommitLimit on its seat)", () => {
    const base = begin({ allies: [{ code: "x" }], encounter: ["e0", "e0"] });
    const limited = { ...base.state, modifiers: [...base.state.modifiers, flag("escapeCommitLimit", 1, "seat:0")] };
    expect(() => commit(base, limited, "a", "x")).toThrow();
    expect(commit(base, limited, "x").window?.kind).toBe("frameAction");
  });
});

describe("what hears an escape test (900804:A:1, 02106:B:2)", () => {
  it("announces committedToEscape for each character committed, before the action window", () => {
    const hurt: Effect = { id: "h:forced:1", cardCode: "h", lines: ["h:A:1"], timing: "forced", trigger: "committedToEscape", subject: { type: "character", control: "any" }, instructions: [{ verb: "DamageCard", amount: 1, target: "subject" }] };
    const run = begin({ allies: [{ code: "x" }], staging: [{ code: "h" }], cards: [hero("a", { willpower: 3 }), ally("x", { willpower: 4 }), definePrinted({ code: "h", name: "h", type: "enemy", threat: 1, attack: 1, defense: 1, health: 3, engagementCost: 20 }), card("e0")], effects: [hurt], encounter: ["e0", "e0"] });
    const committed = commit(run, run.state, "a", "x");
    expect(committed.window?.kind).toBe("frameAction");
    expect(committed.cards[run.ids.a ?? ""]?.damage).toBe(1);
    expect(committed.cards[run.ids.x ?? ""]?.damage).toBe(1);
  });

  it("announces the result only to the card whose effect made the test", () => {
    const win = (code: string): Effect => ({ id: `${code}:forced:1`, cardCode: code, lines: [`${code}:A:1`], timing: "forced", trigger: "escapePassed", instructions: [{ verb: "RaiseThreat", amount: 7 }] });
    const run = begin({ staging: [{ code: "p" }, { code: "q" }], cards: [hero("a", { willpower: 3 }), card("e0"), card("p"), card("q")], effects: [win("p"), win("q")], encounter: ["e0", "e0"] });
    const source = run.ids.p ?? "";
    const pushed = pushEffectFrame({ ...run.state, window: null, stack: [] }, { frame: "forced", sourceId: source, actor: 0, peril: false, effectId: "p:forced:9", instructions: [test(1), STOP], cancel: null, blockCancel: null }, []);
    const waiting = settle(pushed, run.ctx, []);
    const done = pass(commit(run, waiting, "a"), run);
    expect(threat(done)).toBe(37);
  });
});
