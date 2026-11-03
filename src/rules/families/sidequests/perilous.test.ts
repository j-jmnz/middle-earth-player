// Rules: rr.threat-elimination-level, rr.player-elimination, rr.deckbuilding, rr.cost (data/rules/entries.json).
// A Perilous Voyage (40047): flips instead of eliminating its player at the threat elimination level, and what each side does.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/sidequests.ts";
import { ruleCause } from "../../cause.ts";
import { lowerThreat, raiseThreat } from "../../keywords.ts";
import { lowerThreatByEffect } from "../quest/threat.ts";
import { updateCard, withThreat } from "../../state.ts";
import { put, run, seat, send, sideCtx, synced, trigger, withContract } from "./fixture.ts";

const ctx = sideCtx(RECORDS);

function table(heroes: readonly string[] = ["gondor", "rohan"]) {
  const base = seat(1, heroes);
  const contract = withContract(base.state, "40047");
  return { base, contract, state: synced(withThreat(contract.state, 0, 30), ctx) };
}

describe("A Perilous Voyage side A (40047:A:1)", () => {
  it("the threat cannot be reduced by player card effects, but is by the game", () => {
    const { state } = table();
    const ally = put(state, "helper", "play");
    const steps: never[] = [];
    const player = lowerThreatByEffect(synced(ally.state, ctx), 0, 5, ally.id, ctx, steps, ruleCause("rr.damage"));
    expect(player.seats[0].threat).toBe(30);
    expect(lowerThreat(state, 0, 5, steps, ruleCause("rr.damage")).seats[0].threat).toBe(25);
  });

  it("the Action looks at the top 2 cards of the deck, draws 1 and puts the other on the bottom", () => {
    const { contract, state } = table();
    let next = state;
    const deck: string[] = [];
    for (const code of ["helper", "cheap", "dear", "rider"]) {
      const made = put(next, code, "deck");
      next = made.state;
      deck.push(made.id);
    }
    next = trigger(next, contract.id, "40047:action:1", ctx);
    expect(next.window).toMatchObject({ kind: "look" });
    next = send(next, { type: "Pass" }, ctx);
    next = send(next, { type: "Choose", optionId: next.cards[deck[1] ?? ""]?.id ?? "" }, ctx);
    expect(next.seats[0].hand).toEqual([deck[1]]);
    // The other of the two looked-at cards goes to the bottom; the rest keep their order.
    expect(next.seats[0].deck).toEqual([deck[2], deck[3], deck[0]]);
    expect(next.cards[contract.id]?.exhausted).toBe(true);
    expect(next.seats[0].threat).toBe(31);
  });
});

describe("A Perilous Voyage flipped (40047:A:2, B:1, B:2)", () => {
  it("reaching 50 threat flips it instead of eliminating the player, and the flip reduces threat by 10 and searches the deck", () => {
    const { contract, state } = table();
    let next = state;
    next = put(next, "helper", "deck").state;
    next = put(next, "cheap", "deck").state;
    next = { ...next, cards: { ...next.cards } };
    next = raiseThreat(withThreat(next, 0, 45), 0, 6, [], ruleCause("rr.damage"));
    next = run(next, ctx);
    expect(next.seats[0].eliminated).toBe(false);
    expect(next.cards[contract.id]?.face).toBe("B");
    // 51 less 10.
    expect(next.seats[0].threat).toBe(41);
    expect(next.window).toMatchObject({ kind: "choose" });
    const found = Object.values(next.cards).find((card) => card.code === "cheap")?.id ?? "";
    next = send(next, { type: "Choose", optionId: found }, ctx);
    expect(next.window).toMatchObject({ kind: "choose", options: ["hand", "play"] });
    next = send(next, { type: "Choose", optionId: "hand" }, ctx);
    expect(next.cards[found]?.zone).toBe("hand");
  });

  it("the card found can be played, its cost reduced by 3 (40047:B:2)", () => {
    const { base, state } = table(["dwarf", "rohan"]);
    const dear = put(put(state, "helper", "deck").state, "dear", "deck");
    let next = raiseThreat(withThreat(dear.state, 0, 49), 0, 2, [], ruleCause("rr.damage"));
    next = run(next, ctx);
    next = send(next, { type: "Choose", optionId: dear.id }, ctx);
    next = send(next, { type: "Choose", optionId: "play" }, ctx);
    // Dear Ally costs 4 (Leadership): 1 after the reduction, paid from Dain's pool (the only one that can), and it enters play.
    expect(next.cards[dear.id]?.zone).toBe("play");
    expect(next.cards[base.heroes[0] ?? ""]?.resources).toBe(4);
  });

  it("an attachment found is played on a host the player names", () => {
    const { base, state } = table(["dwarf", "rohan"]);
    const charm = put(put(state, "helper", "deck").state, "cheap1", "deck");
    let next = raiseThreat(withThreat(charm.state, 0, 49), 0, 2, [], ruleCause("rr.damage"));
    next = run(next, ctx);
    next = send(next, { type: "Choose", optionId: charm.id }, ctx);
    next = send(next, { type: "Choose", optionId: "play" }, ctx);
    // A Charm costs 1 (0 after the reduction): the host is chosen among the two heroes.
    expect(next.window).toMatchObject({ kind: "choose", options: expect.arrayContaining(base.heroes) });
    next = send(next, { type: "Choose", optionId: base.heroes[1] ?? "" }, ctx);
    expect(next.cards[charm.id]).toMatchObject({ zone: "play", host: base.heroes[1] });
  });

  it("side B: heroes do not exhaust to quest, and only contracts can reduce threat (40047:B:1)", () => {
    const { contract, state } = table();
    const onB = synced(updateCard(state, contract.id, { face: "B" }), ctx);
    const quested = send({ ...onB, mode: "questCommit", phase: "Quest", boundaryPhase: "Quest", window: { kind: "pass" }, activeSeat: 0, passed: [] }, { type: "Commit", cardIds: [onB.seats[0].heroes[0] ?? ""] }, ctx);
    expect(quested.cards[onB.seats[0].heroes[0] ?? ""]).toMatchObject({ committed: true, exhausted: false });
    const ally = put(onB, "helper", "play");
    const synced2 = synced(ally.state, ctx);
    expect(lowerThreatByEffect(synced2, 0, 5, ally.id, ctx, [], ruleCause("rr.damage")).seats[0].threat).toBe(30);
    expect(lowerThreatByEffect(synced2, 0, 5, contract.id, ctx, [], ruleCause("rr.damage")).seats[0].threat).toBe(25);
  });

  it("without the contract's save a player at 50 threat is eliminated", () => {
    const base = seat(1, ["gondor", "rohan"]);
    const next = run(raiseThreat(withThreat(base.state, 0, 49), 0, 2, [], ruleCause("rr.damage")), ctx);
    expect(next.seats[0].eliminated || next.lost).toBe(true);
  });
});
