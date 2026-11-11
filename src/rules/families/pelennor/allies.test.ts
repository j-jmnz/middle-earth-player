import { describe, expect, it } from "vitest";

import { definePrinted } from "../../core/printed.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { ruleCause } from "../../core/cause.ts";
import { placeDamage } from "../../core/keywords.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { updateCard } from "../../core/state.ts";
import { ally, hero, table } from "../defense/table.ts";

// Rules: rr.in-play-and-out-of-play, rr.ownership-and-control, rr.destroy (data/rules/entries.json); ledger lines 145074:A:1, 145074:B:1, 145074:B:2, 145074:B:3, 145075:A:1.
// Allies in the staging area: discarded from a deck into it, counted for X, damaged by assignment, taken back by their owner.

const focus = (seat: number) => ({ seat, sourceId: null });
const unique = (code: string) => ally(code, { cost: 3, isUnique: true });

function withDeck(codes: readonly string[], extra: Partial<Parameters<typeof table>[0]> = {}) {
  const built = table({ seatCount: 2, effects: [], heroes: [{ code: "h" }, { code: "g", seat: 1 }], ...extra, cards: [hero("h"), hero("g"), ally("a1", { cost: 2 }), ally("a2", { cost: 4 }), unique("u"), definePrinted({ code: "spell", name: "Spell", type: "event", cost: 1 })] });
  let state = built.state;
  const ids: Record<string, string> = { ...built.ids };
  codes.forEach((code, index) => {
    const spawned = spawn(state, code, { zone: "deck", seat: 0 });
    state = spawned.state;
    ids[`${code}#${index}`] = spawned.id;
  });
  return { state, ids, ctx: built.ctx };
}

describe("DiscardAllyToStaging (145074:A:1)", () => {
  it("discards from the top until an ally is discarded and stages it, owned, uncontrolled and blank", () => {
    const { state, ids, ctx } = withDeck(["spell", "a1", "a2"]);
    const next = runInstruction(state, { verb: "DiscardAllyToStaging" }, focus(0), ctx, []);
    const staged = next.cards[ids["a1#1"]!]!;
    expect(staged.zone).toBe("staging");
    expect(staged.controller).toBeNull();
    expect(staged.owner).toBe(0);
    expect(next.cards[ids["spell#0"]!]?.zone).toBe("discard");
    expect(next.cards[ids["a2#2"]!]?.zone).toBe("deck");
    expect(next.modifiers.some((modifier) => modifier.instanceId === staged.id && modifier.stat === "blankText")).toBe(true);
  });

  it("skips a unique ally whose title is already in play and goes on", () => {
    const { state, ids, ctx } = withDeck(["u", "a2"], { allies: [{ code: "u", key: "inPlay" }] });
    const next = runInstruction(state, { verb: "DiscardAllyToStaging" }, focus(0), ctx, []);
    expect(next.cards[ids["u#0"]!]?.zone).toBe("discard");
    expect(next.cards[ids["a2#1"]!]?.zone).toBe("staging");
  });

  it("empties the deck and adds nothing when no ally is there", () => {
    const { state, ids, ctx } = withDeck(["spell"]);
    const next = runInstruction(state, { verb: "DiscardAllyToStaging" }, focus(0), ctx, []);
    expect(next.cards[ids["spell#0"]!]?.zone).toBe("discard");
    expect(next.staging).toEqual([]);
  });
});

describe("allies in the staging area (145074:B:1, 145074:B:3)", () => {
  function staged() {
    const { state, ids, ctx } = withDeck(["a1", "a2"]);
    const one = runInstruction(state, { verb: "DiscardAllyToStaging" }, focus(0), ctx, []);
    const two = runInstruction(one, { verb: "DiscardAllyToStaging" }, focus(0), ctx, []);
    return { state: two, ids, ctx };
  }

  it("counts the total printed cost of the staged allies for X", () => {
    const { state, ctx } = staged();
    expect(resolveAmount(state, { stagedAlliesCost: true }, frameScope(state, 0, null), ctx)).toBe(6);
  });

  it("offers them to an assignment and sends a destroyed one to its owner's discard pile", () => {
    const { state, ids, ctx } = staged();
    const picks = pickCandidates(state, { type: "ally", control: "any", stagingOnly: true }, 0, [], null, ctx);
    expect(picks.sort()).toEqual([ids["a1#0"]!, ids["a2#1"]!].sort());
    const destroyed = placeDamage(state, ids["a1#0"]!, 3, ctx.cards, [], "framework", ruleCause("rr.damage"));
    expect(destroyed.cards[ids["a1#0"]!]?.zone).toBe("discard");
    expect(destroyed.seats[0].discard).toContain(ids["a1#0"]!);
    expect(destroyed.staging).toEqual([ids["a2#1"]!]);
  });

  it("returns control to the owner, exhausted, at 3A (145075:A:1)", () => {
    const { state, ids, ctx } = staged();
    const next = runInstruction(state, { verb: "TakeControlOfStagedAllies" }, focus(0), ctx, []);
    for (const key of ["a1#0", "a2#1"]) {
      const card = next.cards[ids[key]!]!;
      expect([card.zone, card.controller, card.exhausted]).toEqual(["play", 0, true]);
    }
    expect(next.staging).toEqual([]);
    expect(next.seats[1].play).toEqual([]);
  });

  it("leaves another seat's staged ally alone", () => {
    const { state, ids, ctx } = staged();
    const mine = updateCard(moveCard(state, ids["a2#1"]!, { zone: "staging" }), ids["a2#1"]!, { owner: 1, controller: null });
    const next = runInstruction(mine, { verb: "TakeControlOfStagedAllies" }, focus(0), ctx, []);
    expect(next.cards[ids["a2#1"]!]?.zone).toBe("staging");
    expect(next.cards[ids["a1#0"]!]?.zone).toBe("play");
  });
});
