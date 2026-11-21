// Rules: docs/brief.md (The Battle of Lake-town: the Smaug deck, from the Quest Companion), rr.reveal, rr.first-player; ledger lines 50201:A:1, 50206:A:3.
// The Smaug deck and its discard pile: dealt out of the encounter deck, revealed into the play area or the staging area, handing its damage to the next Smaug as that one is revealed, refilled from its discard pile, asked once at the beginning of the quest phase.
import { describe, expect, it } from "vitest";

import { askSmaug } from "./deck.ts";
import { pileOf } from "../../core/piles.ts";
import { settle } from "../../engine/machine.ts";
import { updateCard } from "../../core/state.ts";
import { MAGNIFICENT, MIGHTY, TERRIBLE, damageOn, lakeTable, run } from "./fixture.ts";

const codes = (state: { cards: Record<string, { code: string }> }, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

describe("the Smaug deck is a deck of its own with a discard pile", () => {
  it("holds the Smaug cards out of play, apart from the encounter deck", () => {
    const made = lakeTable({ smaugDeck: [MIGHTY, TERRIBLE, MAGNIFICENT] });
    expect(codes(made.state, pileOf(made.state, "smaugDeck"))).toEqual([MIGHTY, TERRIBLE, MAGNIFICENT]);
    expect(made.state.encounterDeck).toHaveLength(0);
    expect(made.state.piles?.smaugDiscard).toEqual([]);
    expect(made.state.cards[pileOf(made.state, "smaugDeck")[0] ?? ""]?.zone).toBe("smaugDeck");
  });
});

describe("RevealSmaug (the Quest Companion's Smaug deck)", () => {
  it("reveals the top card into the staging area", () => {
    const made = lakeTable({ smaugDeck: [MIGHTY, TERRIBLE] });
    const next = run(made, made.state, { verb: "RevealSmaug", to: "staging" });
    expect(codes(next, next.staging)).toContain(MIGHTY);
    expect(codes(next, pileOf(next, "smaugDeck"))).toEqual([TERRIBLE]);
  });

  it("reveals it into the play area, engaged with the first player, when that is chosen", () => {
    const made = lakeTable({ smaugDeck: [MIGHTY, TERRIBLE] });
    const next = run(made, made.state, { verb: "RevealSmaug", to: "play" });
    expect(codes(next, next.seats[0]?.engaged ?? [])).toEqual([MIGHTY]);
    expect(next.staging.some((id) => next.cards[id]?.code === MIGHTY)).toBe(false);
  });

  it("gives the new Smaug all the old one's damage and discards the old one to the Smaug discard pile", () => {
    const made = lakeTable({ smaugDeck: [MIGHTY, TERRIBLE] });
    const first = run(made, made.state, { verb: "RevealSmaug", to: "staging" });
    const old = first.staging.find((id) => first.cards[id]?.code === MIGHTY) ?? "";
    const hurt = updateCard(first, old, { damage: 5 });
    const second = run(made, hurt, { verb: "RevealSmaug", to: "staging" });
    expect(codes(second, second.staging).filter((code) => code === MIGHTY || code === TERRIBLE)).toEqual([TERRIBLE]);
    expect(damageOn(second, TERRIBLE)).toBe(5);
    expect(codes(second, pileOf(second, "smaugDiscard"))).toEqual([MIGHTY]);
    // The encounter discard pile never saw it.
    expect(second.encounterDiscard).toHaveLength(0);
  });

  it("shuffles the Smaug discard pile back when the deck is empty", () => {
    const made = lakeTable({ smaugDeck: [MIGHTY, TERRIBLE] });
    const first = run(made, made.state, { verb: "RevealSmaug", to: "staging" });
    const second = run(made, first, { verb: "RevealSmaug", to: "staging" });
    expect(pileOf(second, "smaugDeck")).toHaveLength(0);
    expect(codes(second, pileOf(second, "smaugDiscard"))).toEqual([MIGHTY]);
    const third = run(made, second, { verb: "RevealSmaug", to: "staging" });
    expect(codes(third, third.staging).filter((code) => code === MIGHTY || code === TERRIBLE)).toEqual([MIGHTY]);
    expect(codes(third, pileOf(third, "smaugDiscard"))).toEqual([TERRIBLE]);
  });
});

describe("the first player's question at the beginning of the quest phase", () => {
  it("is asked once a round, naming the play area and the staging area", () => {
    const made = lakeTable({ smaugDeck: [MIGHTY, TERRIBLE] });
    const stage = { ...made.state, questStage: Object.values(made.state.cards)[0]?.id ?? null, round: 1 };
    const asked = askSmaug(stage, made.ctx, []);
    expect(asked?.smaugAsked).toBe(1);
    const settled = settle({ ...(asked ?? stage), window: null }, made.ctx, []);
    expect(settled.window).toMatchObject({ kind: "choose", seat: 0, options: ["play", "staging"] });
    // The same round it is not asked again; with no Smaug deck it is never asked.
    expect(askSmaug(asked ?? stage, made.ctx, [])).toBeNull();
    expect(askSmaug({ ...stage, piles: undefined }, made.ctx, [])).toBeNull();
  });
});
