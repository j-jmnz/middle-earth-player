// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, faq.blood-of-gondor-hidden-cards, rr.running-out-of-cards (data/rules/entries.json); ledger lines 06117:B:1, 06118:B:3, 06119:A:1, 06123:A:3, 06128:A:3, 06129:A:1.
// The engine facts of the hidden cards the pelargir family adds, each on the table of The Blood of Gondor with the verb run for real: taking, the refill of an empty deck, turning one card at a time, the cards held when a turn starts, a discard that is no turn, the amount, and the hidden information (no step names a hidden card). The printed lines and the moments of a game (the combat phase, an attack, an Action, a round) are in src/campaign/scenarios/the-blood-of-gondor/.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { CODES, hiddenCodes, idByCode, run, table, takes, where } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";

const { ambusher, crow, southern, arsonist, rabble, lyingInWait, looms } = CODES;

describe("TakeHiddenCard", () => {
  it("sets the top cards of the encounter deck aside facedown in the player's play area, in the order taken, owned by that seat", () => {
    const t = table({ seats: 2, deck: [ambusher, southern, looms, arsonist] });
    const two = takes(t, t.state, 0, 2);
    const one = takes(t, two, 1);
    expect(hiddenCodes(one, 0)).toEqual([ambusher, southern]);
    expect(hiddenCodes(one, 1)).toEqual([looms]);
    expect(one.encounterDeck.map((id) => one.cards[id]?.code)).toEqual([arsonist]);
    for (const id of one.setAside.filter((candidate) => one.cards[candidate]?.hiddenAt != null)) expect(one.cards[id]).toMatchObject({ zone: "setAside", face: "down", controller: null });
  });

  it("is not a reveal: no When Revealed, no surge, no shadow effect and no event, and no step names the card", () => {
    const t = table({ deck: [looms, ambusher] });
    const steps: EngineStep[] = [];
    const taken = run(t, t.state, { verb: "TakeHiddenCard" }, { steps });
    expect(hiddenCodes(taken)).toEqual([looms]);
    // Mordor Looms has surge and a When Revealed that would take a card for each player: the deck is untouched below the first card.
    expect(taken.encounterDeck).toHaveLength(1);
    expect(taken.staging.filter((id) => taken.cards[id]?.code === looms)).toEqual([]);
    expect(JSON.stringify(steps)).not.toContain(idByCode(taken, looms));
  });

  it("shuffles the discard pile into an empty deck first, and takes nothing when both piles are empty", () => {
    const refilled = table({ deck: [], discard: [ambusher, southern] });
    const taken = takes(refilled, refilled.state, 0);
    expect(hiddenCodes(taken)).toHaveLength(1);
    expect(taken.encounterDeck).toHaveLength(1);
    expect(taken.encounterDiscard).toHaveLength(0);
    const empty = table({ deck: [], discard: [] });
    const none = takes(empty, empty.state, 0, 2);
    expect(hiddenCodes(none)).toEqual([]);
    expect(none.setAside.filter((id) => none.cards[id]?.hiddenAt != null)).toEqual([]);
  });

  it("takes the first player's card when the instruction names him, and 2 cards as one instruction", () => {
    const t = table({ seats: 2, firstPlayer: 1, deck: [ambusher, southern, looms] });
    const taken = run(t, t.state, { verb: "TakeHiddenCard", who: "firstPlayer", amount: 2 }, { seat: 0 });
    expect(hiddenCodes(taken, 1)).toEqual([ambusher, southern]);
    expect(hiddenCodes(taken, 0)).toEqual([]);
  });

  it("is the same cards for the same seed, so a replay and an Undo take the same cards", () => {
    const t = table({ seed: 7, deck: [ambusher, southern, looms] });
    expect(hiddenCodes(takes(t, t.state, 0, 2))).toEqual(hiddenCodes(takes(t, t.state, 0, 2)));
  });
});

describe("the amount hidden", () => {
  it("counts the cards in the acting player's play area (own) or in every play area (all)", () => {
    const t = table({ seats: 2, deck: [ambusher, southern, looms, arsonist] });
    const state = takes(t, takes(t, t.state, 0, 2), 1);
    const own = (seat: number) => resolveAmount(state, { hidden: "own" }, { actor: seat, sourceId: null }, t.ctx);
    expect([own(0), own(1)]).toEqual([2, 1]);
    expect(resolveAmount(state, { hidden: "all" }, { actor: 0, sourceId: null }, t.ctx)).toBe(3);
    expect(resolveAmount(t.state, { hidden: "all" }, { actor: 0, sourceId: null }, t.ctx)).toBe(0);
  });
});

describe("TurnHiddenCards", () => {
  it("engages an enemy whatever its engagement cost, discards a treachery and a location, and leaves the hidden list empty", () => {
    const t = table({ deck: [ambusher, looms, southern] });
    const held = takes(t, t.state, 0, 3);
    const turned = run(t, held, { verb: "TurnHiddenCards", who: "actor" });
    expect(turned.seats[0]?.engaged.map((id) => turned.cards[id]?.code)).toContain(ambusher);
    expect(where(turned, looms)).toBe("encounterDiscard");
    expect(where(turned, southern)).toBe("encounterDiscard");
    expect(turned.cards[idByCode(turned, ambusher)]).toMatchObject({ face: "up", zone: "engaged" });
    expect(hiddenCodes(turned)).toEqual([]);
  });

  it("turns only the cards held when it starts: a card taken by what the turn does stays facedown (Evil Crow)", () => {
    const t = table({ deck: [crow, southern, ambusher] });
    const turned = run(t, takes(t, t.state, 0), { verb: "TurnHiddenCards", who: "actor" });
    expect(turned.seats[0]?.engaged.map((id) => turned.cards[id]?.code)).toEqual([crow]);
    expect(hiddenCodes(turned)).toEqual([southern]);
  });

  it("goes in player order for each player, every list taken before any card is turned", () => {
    const t = table({ seats: 2, firstPlayer: 1, deck: [rabble, ambusher, southern] });
    const state = takes(t, takes(t, t.state, 1), 0, 2);
    const turned = run(t, state, { verb: "TurnHiddenCards", who: "eachPlayer" });
    expect(turned.seats[1]?.engaged.map((id) => turned.cards[id]?.code)).toEqual([rabble]);
    expect(turned.seats[0]?.engaged.map((id) => turned.cards[id]?.code)).toEqual([ambusher]);
    expect(hiddenCodes(turned)).toEqual([]);
  });

  it("with shadow deals each enemy it turns a shadow card, and with no flag deals none", () => {
    const t = table({ deck: [ambusher, rabble, "f0", "f0"] });
    const held = takes(t, t.state, 0, 2);
    const plain = run(t, held, { verb: "TurnHiddenCards", who: "actor" });
    expect(Object.values(plain.cards).filter((card) => card.zone === "shadow")).toHaveLength(0);
    const shadowed = run(t, held, { verb: "TurnHiddenCards", who: "actor", shadow: true });
    expect(Object.values(shadowed.cards).filter((card) => card.zone === "shadow")).toHaveLength(2);
  });

  it("with resolve runs each treachery's When Revealed effects and adds a location to the staging area, and no surge fires", () => {
    const t = table({ seats: 2, deck: [looms, southern, ambusher, "f0", "f0"] });
    const held = takes(t, t.state, 0, 2);
    const turned = run(t, held, { verb: "TurnHiddenCards", who: "firstPlayer", resolve: true });
    // Mordor Looms: each player takes 1 hidden card (the cards below the first two), and it surges nowhere.
    expect(hiddenCodes(turned, 0)).toHaveLength(1);
    expect(hiddenCodes(turned, 1)).toHaveLength(1);
    expect(where(turned, looms)).toBe("encounterDiscard");
    expect(where(turned, southern)).toBe("staging");
    expect(turned.staging.map((id) => turned.cards[id]?.code)).not.toContain(ambusher);
    expect(turned.encounterDeck).toHaveLength(1);
  });

  it("with resolve, Lying in Wait turned by another Lying in Wait turns nothing twice", () => {
    const t = table({ deck: [lyingInWait, lyingInWait, ambusher] });
    const held = takes(t, t.state, 0, 2);
    const turned = run(t, held, { verb: "TurnHiddenCards", who: "firstPlayer", resolve: true });
    expect(hiddenCodes(turned)).toEqual([]);
    expect(turned.encounterDiscard.map((id) => turned.cards[id]?.code)).toEqual([lyingInWait, lyingInWait]);
  });

  it("does nothing for a player with no hidden card and for a player who left the game", () => {
    const t = table({ seats: 2, deck: [ambusher] });
    const held = takes(t, t.state, 0);
    expect(run(t, held, { verb: "TurnHiddenCards", who: "actor" }, { seat: 1 }).seats[1]?.engaged).toEqual([]);
    const gone = { ...held, seats: held.seats.map((seat, index) => (index === 0 ? { ...seat, eliminated: true } : seat)) } as typeof held;
    expect(run(t, gone, { verb: "TurnHiddenCards", who: "actor" }).seats[0]?.engaged).toEqual([]);
  });
});

describe("DiscardHiddenCard", () => {
  it("discards one hidden card of the player chosen with the game's seed, unresolved: nothing engages", () => {
    const t = table({ seed: 3, deck: [ambusher, rabble, arsonist] });
    const held = takes(t, t.state, 0, 3);
    const again = (state: typeof held) => run(t, state, { verb: "DiscardHiddenCard", who: "firstPlayer" });
    const gone = again(held);
    expect(hiddenCodes(gone)).toHaveLength(2);
    expect(gone.encounterDiscard).toHaveLength(1);
    expect(gone.seats[0]?.engaged).toEqual([]);
    expect(hiddenCodes(again(held))).toEqual(hiddenCodes(gone));
  });

  it("discards nothing from a player with no hidden card", () => {
    const t = table({ deck: [ambusher] });
    expect(run(t, t.state, { verb: "DiscardHiddenCard", who: "firstPlayer" }).encounterDiscard).toHaveLength(0);
  });
});
