// Rules: rr.step-3-3, rr.surge, rr.blank, rr.first-player, rr.step-6-4-2, rr.attacks-outside-the-combat-phase,
// mec109.ringbearers-life (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";
import { syncConstants } from "../rules/constants.ts";
import { hasKeyword } from "../rules/keywords.ts";
import { legalIntents } from "../rules/legal.ts";
import type { ReduceContext } from "../rules/reduce.ts";
import { expireModifiers, flagged, updateCard, type ScenarioState } from "../rules/state.ts";
import { causeProblems } from "../../scripts/cause-check.ts";
import { fordTable, loadFordWorld, type FordLayout, type FordWorld } from "../../scripts/ford-scene.ts";
import { codesOf, first, FRODO, reveal, RING, SAM, send, start, type Run } from "../../scripts/past-scene.ts";

let world: FordWorld;

beforeAll(async () => {
  world = await loadFordWorld();
});

function make(layout: FordLayout = {}) {
  const made = fordTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

// Reveals the top card of a deck of [card, f0, f0, f0] in the staging step, and answers nothing.
function revealed(card: string, layout: FordLayout = {}, seats = 1) {
  const made = make({ deck: [card, "f0", "f0", "f0", "f0"], ...layout, seats: layout.seats ?? 1 });
  return { ...made, run: reveal(made.state, made.ctx, seats) };
}

function choose(run: Run, optionId: string, ctx: ReduceContext): Run {
  return send(start(run.state), { type: "Choose", optionId }, ctx);
}

const options = (state: ScenarioState): readonly string[] => (state.window?.kind === "choose" ? state.window.options : []);

describe("Stricken Dumb (141064:A:2)", () => {
  it("offers the burden and an additional card, or threat and the end of the quest phase", () => {
    const { run } = revealed("141064");
    expect(run.state.window).toEqual({ kind: "choose", seat: 0, options: ["burden", "threat"] });
  });

  it("the burden is shuffled into the encounter deck and an additional encounter card is revealed", () => {
    const { run, ctx } = revealed("141064");
    const burden = run.state.burdenDeck?.[0] ?? "";
    const done = choose(run, "burden", ctx);
    expect(done.state.burdenDeck).toHaveLength(4);
    expect(done.state.encounterDeck).toContain(burden);
    // Surge: the next card (after the burden joined the deck) is revealed too.
    expect(done.state.staging).toHaveLength(1);
    expect(done.state.cards[first(done.state, "141064")]?.zone).toBe("encounterDiscard");
    expect(causeProblems(done.steps)).toEqual([]);
  });

  it("threat is raised by 3 for each player and the quest phase ends: no more cards are revealed and the quest is not resolved", () => {
    const made = make({ seats: 2, deck: ["141064", "f0", "f0", "f0"], stage: "141028" });
    const sam = first(made.state, SAM);
    // Seat 0 commits Sam, whose Willpower beats the nothing in the staging area, and then the staging step begins.
    let run = send(start(made.state), { type: "Commit", cardIds: [sam] }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
    expect(run.state.window).toEqual({ kind: "choose", seat: 0, options: ["burden", "threat"] });
    const before = run.state.seats.map((seat) => seat.threat);
    run = choose(run, "threat", made.ctx);
    expect(run.state.seats.map((seat) => seat.threat)).toEqual(before.map((threat) => threat + 3));
    // Seat 1 revealed nothing: the quest phase was over.
    expect(run.state.encounterDeck).toHaveLength(3);
    expect(run.state.staging).toEqual([]);
    expect(run.state.phase).not.toBe("Quest");
    expect(run.state.cards[run.state.questStage ?? ""]?.progress).toBe(0);
    expect(run.state.cards[sam]).toMatchObject({ committed: false, exhausted: true });
  });

  it("offers only threat when the burden deck is empty", () => {
    const { run } = revealed("141064", { burden: [] });
    expect(options(run.state)).not.toContain("burden");
  });
});

describe("The Enemy is Upon Us! (141065)", () => {
  it("makes each engaged enemy attack at once, then reveals no additional card (141065:A:1)", () => {
    const { run, ctx, state } = revealed("141065", { seats: 2, engaged: [{ code: "grunt", seat: 0 }, { code: "grunt", seat: 1 }] }, 2);
    expect(run.state.window).toMatchObject({ kind: "defense", seat: 0 });
    let current = run;
    current = send(current, { type: "Undefended", heroId: first(state, SAM) }, ctx);
    expect(current.state.window).toMatchObject({ kind: "defense", seat: 1 });
    expect(causeProblems(current.steps)).toEqual([]);
    const sam = first(state, SAM);
    expect(current.state.cards[sam]?.damage).toBe(1);
  });

  it("gains surge when no enemy was engaged", () => {
    const { run } = revealed("141065");
    expect(codesOf(run.state, run.state.staging)).toEqual(["f0"]);
    expect(run.state.cards[first(run.state, "141065")]?.zone).toBe("encounterDiscard");
  });
});

describe("The Nine are Abroad (141067:A:1)", () => {
  it("blanks the text box of each character in play until the end of the round, keywords included and traits kept", () => {
    const { run, state, ctx } = revealed("141067", { allies: ["ally"] });
    const ally = first(state, "ally");
    expect(hasKeyword(state, ally, "sentinel", ctx.cards)).toBe(true);
    for (const id of [first(state, FRODO), first(state, SAM), ally]) expect(flagged(run.state, id, "blankText"), id).toBe(true);
    expect(hasKeyword(run.state, ally, "sentinel", ctx.cards)).toBe(false);
    // Text gained from another source is not blanked (rr.blank).
    const gained = { ...run.state, modifiers: [...run.state.modifiers, { instanceId: ally, sourceId: ally, stat: "sentinel" as const, amount: 1, until: "endOfRound" as const }] };
    expect(hasKeyword(gained, ally, "sentinel", ctx.cards)).toBe(true);
    const later = expireModifiers(run.state, ["endOfRound"]);
    expect(hasKeyword(later, ally, "sentinel", ctx.cards)).toBe(true);
    expect(flagged(later, ally, "blankText")).toBe(false);
  });

  it("a blank character has none of its Actions, and a card of another type keeps its own", () => {
    const action: Effect = { id: "ally:action:1", cardCode: "ally", lines: ["ally:A:1"], timing: "action", instructions: [{ verb: "Draw" }] };
    const made = make({ allies: ["ally"], deck: ["141067", "f0", "f0", "f0"] });
    const ctx = { ...made.ctx, effects: [...made.ctx.effects, action] };
    const ally = first(made.state, "ally");
    expect(legalIntents(made.state, ctx)).toContainEqual({ type: "Trigger", cardId: ally, effectId: "ally:action:1" });
    const run = reveal(made.state, ctx);
    expect(flagged(run.state, ally, "blankText")).toBe(true);
    // The same action window, now: the ally's Action is gone.
    const open: ScenarioState = { ...run.state, window: { kind: "pass" }, activeSeat: 0, stack: [] };
    expect(legalIntents(open, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "ally:action:1")).toBe(false);
    const later = expireModifiers(open, ["endOfRound"]);
    expect(legalIntents(later, ctx)).toContainEqual({ type: "Trigger", cardId: ally, effectId: "ally:action:1" });
  });

  it("does not blank the enemies, and gains surge only with a Nazgûl in the staging area", () => {
    const hunted = revealed("141067", { staging: ["141069"] });
    expect(hunted.run.state.staging).toHaveLength(2);
    expect(flagged(hunted.run.state, first(hunted.run.state, "141069"), "blankText")).toBe(false);
    const quiet = revealed("141067", { staging: ["f0"] });
    expect(quiet.run.state.staging).toHaveLength(1);
  });
});

describe("Fear of Discovery (141081:A:2)", () => {
  it("lets the first player exhaust the Ring-bearer or reveal an additional encounter card", () => {
    const { run, ctx, state } = revealed("141081");
    expect(run.state.window).toEqual({ kind: "choose", seat: 0, options: ["exhaust", "reveal"] });
    const frodo = first(state, FRODO);
    const exhausted = choose(run, "exhaust", ctx);
    expect(exhausted.state.cards[frodo]?.exhausted).toBe(true);
    const more = choose(run, "reveal", ctx);
    expect(more.state.cards[frodo]?.exhausted).toBe(false);
    // The additional card of the choice, and the one its Surge reveals after it (rr.surge).
    expect(exhausted.state.staging).toHaveLength(1);
    expect(more.state.staging).toHaveLength(2);
  });

  it("offers only the additional card once the Ring-bearer is exhausted", () => {
    const made = make({ deck: ["141081", "f0", "f0", "f0"] });
    const frodo = first(made.state, FRODO);
    const run = reveal(updateCard(made.state, frodo, { exhausted: true }), made.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.staging).toHaveLength(2);
  });
});

describe("Eaten Alive! (141082:A:2)", () => {
  it("deals X damage divided among the first player's heroes, X the number of players: one point alone", () => {
    const { run, ctx, state } = revealed("141082");
    // Frodo or Sam: the first player chooses.
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    const sam = first(state, SAM);
    const chosen = choose(run, sam, ctx);
    expect(chosen.state.cards[sam]?.damage).toBe(1);
    expect(chosen.state.life).toBe(15);
  });

  it("damage dealt to the Ring-bearer is a loss of life", () => {
    const { run, ctx, state } = revealed("141082");
    const chosen = choose(run, first(state, FRODO), ctx);
    expect(chosen.state.life).toBe(14);
    expect(chosen.state.cards[first(state, FRODO)]?.damage).toBe(0);
  });

  it("deals two points in a two-handed game, one choice each, to heroes the first player controls", () => {
    const { run, ctx, state } = revealed("141082", { seats: 2 }, 2);
    const sam = first(state, SAM);
    const merry = first(state, "141003");
    // The first player's heroes only: Merry is the second seat's.
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(options(run.state)).not.toContain(merry);
    const one = choose(run, sam, ctx);
    const two = choose(one, sam, ctx);
    expect(two.state.cards[sam]?.damage).toBe(2);
    expect(two.state.cards[merry]?.damage).toBe(0);
  });
});

describe("Panicked (141083:A:2)", () => {
  it("raises the first player's threat by 3 and passes the first player token to the next player", () => {
    const { run } = revealed("141083", { seats: 2 }, 2);
    expect(run.state.seats[0].threat).toBe(11);
    expect(run.state.seats[1].threat).toBe(6);
    expect(run.state.firstPlayer).toBe(1);
  });

  it("keeps the token with the only player", () => {
    const { run } = revealed("141083");
    expect(run.state.seats[0].threat).toBe(11);
    expect(run.state.firstPlayer).toBe(0);
  });
});

describe("Overcome by Terror (141084:A:2)", () => {
  it("makes the first player exhaust The One Ring", () => {
    const { run } = revealed("141084", { hand: ["filler", "filler", "filler"] });
    expect(run.state.cards[first(run.state, RING)]?.exhausted).toBe(true);
    expect(run.state.seats[0].hand).toHaveLength(3);
  });

  it("makes the first player discard 2 cards at random from their hand when The One Ring is already exhausted", () => {
    const { run } = revealed("141084", { ring: "exhausted", hand: ["filler", "filler", "filler"] });
    expect(run.state.seats[0].hand).toHaveLength(1);
    expect(run.state.seats[0].discard).toHaveLength(2);
  });

  it("the first player is the one who pays, whoever reveals it", () => {
    const made = make({ seats: 2, deck: ["f0", "141084", "f0", "f0"], ring: "exhausted", hand: ["filler", "filler", "filler"] });
    const run = reveal(made.state, made.ctx, 2);
    expect(run.state.seats[0].hand).toHaveLength(1);
  });
});
