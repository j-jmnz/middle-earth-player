// Rules: rr.play-and-put-into-play (data/rules/entries.json); ledger line 00017:B:2.
// LimitHandPlaysPerRound on a table of The Massing at Osgiliath (stage 2): each player plays or puts into play at most 1 card from his hand each round, events included; cards from the deck or the discard pile do not count.
import { describe, expect, it } from "vitest";

import { runInstruction } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { legalIntents, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout = {}) => tableFromLayout("the-massing-at-osgiliath", { phase: "Planning", stage: "00017", heroResources: 4, hand: ["ally", "ally", "filler"], ...layout });
// The seat pays 1 from its first hero (a filler event costs nothing and ignores it).
const play = (made: ReturnType<typeof table>, cardId: string): ScenarioState => send({ state: made.state, steps: [] }, { type: "PlayCard", cardId, payments: [{ heroId: made.hero, amount: made.cards.get(made.state.cards[cardId]?.code ?? "")?.cost ?? 0 }] }, made.ctx).state;
const playable = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"]) => legalIntents(state, ctx).filter((intent) => intent.type === "PlayCard").length;

describe("LimitHandPlaysPerRound (00017:B:2)", () => {
  it("00017:B:2 a player who played a card from his hand cannot play another, ally, attachment or event", () => {
    const made = table();
    expect(playable(made.state, made.ctx)).toBeGreaterThan(1);
    const cardId = legalIntents(made.state, made.ctx).find((intent) => intent.type === "PlayCard")?.cardId ?? "";
    const played = play(made, cardId);
    expect(playable(played, made.ctx)).toBe(0);
  });

  it("00017:B:2 other stages leave the plays free", () => {
    const made = table({ stage: "00016" });
    const cardId = legalIntents(made.state, made.ctx).find((intent) => intent.type === "PlayCard")?.cardId ?? "";
    const played = play(made, cardId);
    expect(playable(played, made.ctx)).toBeGreaterThan(0);
  });

  it("00017:B:2 a card put into play from his hand counts as his play for the round, one put into play from the deck does not", () => {
    const made = table({ hand: ["ally", "ally"], deckOf: ["ally"] });
    const [inHand] = made.state.seats[0]?.hand ?? [];
    const [onDeck] = made.state.seats[0]?.deck ?? [];
    const fromDeck = runInstruction(made.state, { verb: "PutIntoPlay", card: "self" }, { seat: 0, sourceId: onDeck }, made.ctx, []);
    expect(fromDeck.cards[onDeck ?? ""]?.zone).toBe("play");
    expect(playable(fromDeck, made.ctx)).toBeGreaterThan(0);
    const fromHand = runInstruction(fromDeck, { verb: "PutIntoPlay", card: "self" }, { seat: 0, sourceId: inHand }, made.ctx, []);
    expect(fromHand.cards[inHand ?? ""]?.zone).toBe("play");
    expect(playable(fromHand, made.ctx)).toBe(0);
  });

  it("00017:B:2 each player has his own count, and it ends with the round", () => {
    const made = table({ seats: 2, hand: ["ally"] });
    const [mine] = made.state.seats[0]?.hand ?? [];
    const used = runInstruction(made.state, { verb: "PutIntoPlay", card: "self" }, { seat: 0, sourceId: mine }, made.ctx, []);
    expect(used.modifiers.filter((modifier) => modifier.stat === "handPlays")).toMatchObject([{ seat: 0, amount: 1, until: "endOfRound" }]);
    // The other seat has used none: its own hand is still free to play from.
    expect(used.modifiers.some((modifier) => modifier.stat === "handPlays" && modifier.seat === 1)).toBe(false);
  });
});
