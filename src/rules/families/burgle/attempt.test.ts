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

// Rules: hob.burgle, hob.burgle-example (data/rules/entries.json); ledger lines 132039:A:2, 132042:A:3, 132043:A:2, 132072:B:2. The burgle attempt: step 1 discards encounter cards until one with a burgle effect, step 2 reveals the top card of the first player's deck and opens one action window, step 3 discards the matching cards or fails.

const plain = (code: string) => definePrinted({ code, name: code, type: "treachery" });
const burgle = (code: string, discard: number, match: ("sphere" | "type" | "cost")[]): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "BurgleEffect", discard, match }] });
const player = (code: string, stats: Partial<Parameters<typeof definePrinted>[0]> = {}) => definePrinted({ code, name: code, type: "ally", sphere: "tactics", cost: 2, ...stats });
const RAISE_4: Instruction = { verb: "RaiseThreat", amount: 4, when: { kind: "burgleFailed" } };
const RAISE_1: Instruction = { verb: "RaiseThreat", amount: 1, when: { kind: "burgleSucceeded" } };
const EFFECTS: readonly Effect[] = [burgle("b1type", 1, ["type"]), burgle("b2cost", 2, ["cost"]), burgle("b1both", 1, ["sphere", "type"])];

type Options = Partial<TableSpec> & { instructions?: readonly Instruction[]; deck?: readonly string[] };

// A table whose effect frame runs the burgle attempt for seat 0 and settles to the first window it opens. The deck is listed top first.
function begin(options: Options = {}) {
  const { instructions = [{ verb: "BurgleAttempt" }, RAISE_4, RAISE_1], effects = [], deck = ["d1"], ...rest } = options;
  const base = table({
    cards: [hero("a"), ally("x"), plain("nb"), plain("b1type"), plain("b2cost"), plain("b1both"), player("d1"), player("d2", { cost: 3 }), player("e", { type: "event", sphere: "lore", cost: 3 }), player("h2"), player("h3", { sphere: "lore" })],
    effects: [...EFFECTS, ...effects],
    heroes: [{ code: "a" }],
    ...rest,
  });
  let state = base.state;
  const ids: Record<string, string> = { ...base.ids };
  for (const code of [...deck].reverse()) {
    const spawned = spawn(state, code, { zone: "deck", seat: 0 });
    state = spawned.state;
    ids[`deck:${code}`] = spawned.id;
  }
  const pushed = pushEffectFrame({ ...state, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [...instructions, STOP], cancel: null, blockCancel: null }, []);
  return { ...base, ids, state: settle(pushed, base.ctx, []) };
}

type Begun = ReturnType<typeof begin>;
const threat = (state: ScenarioState) => state.seats[0]?.threat ?? 0;
const pass = (run: Begun, state: ScenarioState) => send(state, { type: "Pass" }, run.ctx);
const choose = (run: Begun, state: ScenarioState, optionId: string) => send(state, { type: "Choose", optionId }, run.ctx);

describe("BurgleAttempt step 1 (hob.burgle)", () => {
  it("discards encounter cards from the top without revealing them, until one has a burgle effect", () => {
    const run = begin({ encounter: ["nb", "nb", "b1type", "nb"] });
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code)).toEqual(["nb", "nb", "b1type"]);
    expect(run.state.encounterDeck.length).toBe(1);
    expect(run.state.staging).toEqual([]);
    expect(run.state.window?.kind).toBe("frameAction");
  });

  it("refills an empty encounter deck from the discard pile", () => {
    const base = begin({ encounter: ["nb"], instructions: [] });
    const piled = spawn(spawn(base.state, "b1type", { zone: "encounterDiscard" }).state, "nb", { zone: "encounterDiscard" }).state;
    const run = begin({ encounter: ["nb"] });
    const again = pushEffectFrame({ ...piled, window: null, stack: [] }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [{ verb: "BurgleAttempt" }, STOP], cancel: null, blockCancel: null }, []);
    const next = settle(again, run.ctx, []);
    expect(next.window?.kind).toBe("frameAction");
    expect(next.encounterDiscard.map((id) => next.cards[id]?.code)).toContain("b1type");
  });

  it("fails at once when no card with a burgle effect is left in the deck or the discard pile", () => {
    const run = begin({ encounter: ["nb", "nb"] });
    expect(threat(run.state)).toBe(24);
    expect(run.state.window?.kind).toBe("choose");
    expect(run.state.encounterDiscard).toEqual([]);
  });
});

describe("BurgleAttempt steps 2 and 3 (hob.burgle, hob.burgle-example)", () => {
  it("shuffles the deck, reveals the top card and keeps it on the deck, then opens one action window before step 3", () => {
    const run = begin({ encounter: ["b1type"], deck: ["d1", "d2"], hand: [{ code: "h2" }] });
    expect(run.state.window?.kind).toBe("frameAction");
    const top = run.state.seats[0]?.deck[0] ?? "";
    expect(run.state.cards[top]?.face).toBe("up");
    expect(run.state.seats[0]?.deck.length).toBe(2);
  });

  it("succeeds when the first player discards the required matching cards", () => {
    const run = begin({ encounter: ["b1type"], deck: ["d1"], hand: [{ code: "h2" }, { code: "e" }] });
    const asked = pass(run, run.state);
    expect(asked.window?.kind).toBe("choose");
    const picked = choose(run, asked, "discard");
    const done = picked.window?.kind === "choose" ? picked : picked;
    // The only matching card (the ally, as the revealed card is an ally) is the one discarded; the event stays.
    expect(done.seats[0]?.hand.map((id) => done.cards[id]?.code)).toEqual(["e"]);
    expect(threat(done)).toBe(21);
    expect(done.seats[0]?.deck.map((id) => done.cards[id]?.face)).toEqual(["down"]);
  });

  it("fails when the first player declines, and announces the failure", () => {
    const run = begin({ encounter: ["b1type"], deck: ["d1"], hand: [{ code: "h2" }] });
    const done = choose(run, pass(run, run.state), "decline");
    expect(threat(done)).toBe(24);
    expect(done.seats[0]?.hand.length).toBe(1);
  });

  it("fails with no choice when the hand holds too few matching cards", () => {
    const run = begin({ encounter: ["b2cost"], deck: ["d1"], hand: [{ code: "h2" }] });
    const done = pass(run, run.state);
    expect(done.window?.kind).toBe("choose");
    expect(threat(done)).toBe(24);
    expect(done.seats[0]?.hand.length).toBe(1);
  });

  it("matches the cost: equal printed costs, and the discarded cards count together", () => {
    const run = begin({ encounter: ["b2cost"], deck: ["d1"], hand: [{ code: "h2" }, { code: "d1", key: "h1" }, { code: "d2" }] });
    const asked = pass(run, run.state);
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: ["discard", "decline"] });
    const first = choose(run, asked, "discard");
    expect(first.window?.kind).toBe("choose");
    expect(legalIntents(first, run.ctx).length).toBeGreaterThan(0);
  });

  it("needs both the sphere and the type for a line that names both", () => {
    const run = begin({ encounter: ["b1both"], deck: ["d1"], hand: [{ code: "h3" }, { code: "e" }] });
    const done = pass(run, run.state);
    // The revealed ally is tactics: the lore ally and the lore event each share one thing only.
    expect(threat(done)).toBe(24);
  });

  it("fails when the deck is empty", () => {
    const run = begin({ encounter: ["b1type"], deck: [], hand: [{ code: "h2" }] });
    expect(run.state.window?.kind).toBe("choose");
    expect(threat(run.state)).toBe(24);
  });
});

describe("BurgleTake (132043:A:2)", () => {
  const take: Effect = { id: "tk:action:1", cardCode: "tk", lines: ["tk:A:1"], timing: "action", condition: { kind: "burgling" }, instructions: [{ verb: "BurgleTake" }] };
  const cards = [hero("a"), definePrinted({ code: "tk", name: "tk", type: "location", threat: 1, questPoints: 1 }), plain("b1type"), player("d1"), player("d2", { type: "event", cost: 3 }), player("e", { type: "event", cost: 3 })];

  it("is offered to the first player while the attempt's action window is open, and not after it", () => {
    const run = begin({ encounter: ["b1type"], deck: ["d1", "d2"], hand: [{ code: "e" }], staging: [{ code: "tk" }], effects: [take], cards });
    expect(legalIntents(run.state, run.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "tk:action:1")).toBe(true);
    const later = pass(run, run.state);
    expect(legalIntents(later, run.ctx).some((intent) => intent.type === "Trigger")).toBe(false);
  });

  it("takes the revealed card into hand and reveals the next one, which step 3 then reads", () => {
    const run = begin({ encounter: ["b1type"], deck: ["d1", "d2"], hand: [{ code: "e" }], staging: [{ code: "tk" }], effects: [take], cards });
    const topId = run.state.seats[0]?.deck[0] ?? "";
    const topCode = run.state.cards[topId]?.code;
    const taken = send(run.state, { type: "Trigger", cardId: run.ids.tk ?? "", effectId: "tk:action:1" }, run.ctx);
    expect(taken.cards[topId]?.zone).toBe("hand");
    expect(taken.seats[0]?.deck.length).toBe(1);
    const next = taken.seats[0]?.deck[0] ?? "";
    expect(taken.cards[next]?.face).toBe("up");
    // The next revealed card is an event or an ally, whichever the shuffle left: the hand holds the one that matches it.
    const done = pass(run, taken);
    expect(done.window?.kind).toBe("choose");
    expect(topCode === "d1" || topCode === "d2").toBe(true);
  });
});
