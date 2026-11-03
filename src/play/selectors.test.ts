import { describe, expect, it } from "vitest";

import { fixtureDefinition } from "../rules/core/test-fixture.ts";
import { blankScenario, withSeat, type ScenarioState } from "../rules/core/state.ts";

import { tableLayout } from "./layout.ts";
import { seaFixture, seaViews } from "./sea-fixture.ts";
import { twoHanded } from "./seat-fixture.ts";
import { actingSeat, isDiscardPile, opensList, PILE_WORDS, pileSelector, SECOND_PILES, secondPilesOf, shownSeat, threatSelector, tickKeySelector, victoryPileSelector, zoneIds, zoneSelector } from "./selectors.ts";
import { headingReadout } from "./widgets.ts";

// The seat the table draws (phase 26): the seat the player peeks at, else the acting seat. A peek changes only what is drawn.
describe("shownSeat", () => {
  const { state } = twoHanded();
  const turned = { ...state, activeSeat: 1 };

  it("is the acting seat with no viewed seat", () => {
    expect(shownSeat(state, null)).toBe(0);
    expect(shownSeat(turned, null)).toBe(1);
  });

  it("is the viewed seat when there is one, whoever acts", () => {
    expect(shownSeat(state, 1)).toBe(1);
    expect(shownSeat(turned, 0)).toBe(0);
    // Viewing the acting seat is no peek: the same seat.
    expect(shownSeat(state, 0)).toBe(0);
  });

  it("falls back to the acting seat for a seat outside the game, and to seat 0 for an acting seat outside it", () => {
    expect(shownSeat(state, 2)).toBe(0);
    expect(shownSeat(state, -1)).toBe(0);
    expect(shownSeat({ ...state, activeSeat: 5 }, null)).toBe(0);
    expect(actingSeat({ ...state, activeSeat: 5 })).toBe(0);
    expect(actingSeat(turned)).toBe(1);
  });

  it("is seat 0 in a true solo game, viewed or not", () => {
    const solo = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    expect(shownSeat(solo, null)).toBe(0);
    expect(shownSeat(solo, 1)).toBe(0);
  });
});

describe("what a peek swaps", () => {
  const { state, seats, staging } = twoHanded();

  it("is the seat's own zones and piles: hand, play area, engaged enemies, deck and discard pile", () => {
    for (const seat of [0, 1]) {
      const own = seats[seat];
      expect(zoneIds(state, "hand", seat)).toEqual(own?.hand);
      expect(zoneIds(state, "play", seat)).toEqual([own?.hero]);
      expect(zoneIds(state, "engaged", seat)).toEqual(own?.engaged);
    }
    expect(zoneSelector("hand", 0)(state).entries.map((entry) => entry.card.id)).not.toEqual(zoneSelector("hand", 1)(state).entries.map((entry) => entry.card.id));
    expect(pileSelector("deck", 1)(state).ids).toEqual(seats[1].deck);
    expect(pileSelector("discard", 0)(state).ids).toEqual(seats[0].discard);
  });

  it("leaves staging, the quest and the encounter piles shared", () => {
    expect(zoneIds(state, "staging", 0)).toEqual(staging);
    expect(zoneIds(state, "staging", 1)).toEqual(staging);
    expect(pileSelector("encounterDeck", 0)(state).ids).toBe(pileSelector("encounterDeck", 1)(state).ids);
  });

  it("is empty for a seat that is out of the game", () => {
    const out = withSeat(state, 1, { ...state.seats[1], eliminated: true, hand: [], heroes: [], play: [], engaged: [], deck: [], discard: [] });
    expect(zoneIds(out, "hand", 1)).toEqual([]);
    expect(zoneIds(out, "play", 1)).toEqual([]);
    expect(pileSelector("deck", 1)(out).ids).toEqual([]);
  });
});

// The store runs every selector on each `set`, also one that changed no game (a card picked, a peek). A game object is never changed once the
// reducer returns it, so the same object gives the previous result without reading the game again.
describe("selectors on the same game", () => {
  const { state, ctx } = twoHanded();

  // A copy of the state that counts how often the selector reads its cards, seats and staging.
  function counted() {
    const reads = { n: 0 };
    const game = { ...state };
    for (const key of ["cards", "seats", "staging"] as const) {
      const value = state[key];
      Object.defineProperty(game, key, {
        get() {
          reads.n += 1;
          return value;
        },
      });
    }
    return { game: game as typeof state, reads };
  }

  it("does not read the game again for a zone, a pile, the threats or the ticks", () => {
    const { game, reads } = counted();
    const selectors = [zoneSelector("hand", 0), zoneSelector("engaged", 1), pileSelector("discard", 0), threatSelector(), tickKeySelector(ctx)] as const;
    for (const select of selectors) {
      const first = select(game);
      const after = reads.n;
      expect(after).toBeGreaterThan(0);
      expect(select(game)).toBe(first);
      expect(reads.n).toBe(after);
    }
  });

  it("still answers a new game object, also one with the same contents", () => {
    const hand = zoneSelector("hand", 0);
    const first = hand(state);
    expect(hand({ ...state })).toBe(first);
    const changed = hand({ ...state, seats: [{ ...state.seats[0], hand: state.seats[0].hand.slice(1) }, state.seats[1]] });
    expect(changed).not.toBe(first);
    expect(changed.entries.length).toBe(first.entries.length - 1);
  });

  it("gives the engagement costs of the staging enemies that can be engaged, as one string", () => {
    const ticks = tickKeySelector(ctx);
    // The wolf in staging costs 20 to engage.
    expect(ticks(state)).toBe("20");
    expect(threatSelector()(state).map((row) => row.seat)).toEqual([0, 1]);
  });
});

// Rules: dcce.corsair-deck, dcce.heading (data/rules/entries.json). The second slot's piles and the Heading dial are shared pieces: a peek at the other seat leaves them where they are.
describe("the Corsair piles and the second slot (phase 39b)", () => {
  const duo = seaFixture({ seatCount: 2, heading: "Rain", ships: [{ code: "dream-chaser", seat: 0 }, { code: "dawn-star", seat: 1 }], corsairDeck: 4, corsairDiscard: 2 });

  it("views the Corsair deck as a pile of its cards with no top, and its discard pile with the last card put there on top", () => {
    const deck = pileSelector("corsairDeck", 0)(duo.state);
    const discard = pileSelector("corsairDiscard", 0)(duo.state);
    expect(deck.ids).toBe(duo.state.corsairDeck);
    expect(deck.top).toBeNull();
    expect(discard.ids).toHaveLength(2);
    expect(discard.top?.id).toBe(duo.state.corsairDiscard?.at(-1));
    expect(PILE_WORDS.corsairDeck).toBe("Corsair deck");
    expect(PILE_WORDS.corsairDiscard).toBe("Corsair discard pile");
    expect(isDiscardPile("corsairDiscard")).toBe(true);
    expect(isDiscardPile("corsairDeck")).toBe(false);
  });

  it("has the pair only while the game has a Corsair deck: none before it is prepared, none after it ends", () => {
    expect(secondPilesOf(duo.state)).toEqual(["corsairDeck", "corsairDiscard"]);
    const without = seaFixture({ heading: "Sun" });
    expect(secondPilesOf(without.state)).toEqual([]);
    expect(pileSelector("corsairDeck", 0)(without.state).ids).toEqual([]);
  });

  it("keeps the second slot and the Heading dial when the table peeks at the other seat: the piles are shared and the dial is the game's", () => {
    for (const pile of SECOND_PILES) expect(pileSelector(pile, 1)(duo.state).ids).toBe(pileSelector(pile, 0)(duo.state).ids);
    expect(headingReadout(duo.state)).toEqual({ step: "Rain", cardId: duo.ids.heading });
    const seat0 = seaViews(duo, 0);
    const seat1 = seaViews(duo, 1);
    expect(Object.keys(seat1.piles).sort()).toEqual(Object.keys(seat0.piles).sort());
    const at = tableLayout(591, 338, seat1.views, seat1.piles, {});
    const home = tableLayout(591, 338, seat0.views, seat0.piles, {});
    expect(at.piles.corsairDeck).toEqual(home.piles.corsairDeck);
    expect(at.piles.corsairDiscard).toEqual(home.piles.corsairDiscard);
    expect(at.zones.engaged.w).toBe(home.zones.engaged.w);
  });

  it("stands each seat's own ships in its own row: the other seat's ship is seen by peeking at that seat", () => {
    const first = zoneIds(duo.state, "play", 0, duo.facts);
    const second = zoneIds(duo.state, "play", 1, duo.facts);
    expect(first).toContain(duo.ids.ship0);
    expect(first).not.toContain(duo.ids.ship1);
    expect(second).toContain(duo.ids.ship1);
  });
});

describe("victoryPileSelector", () => {
  const made = (ids: readonly string[]) => {
    const cards = Object.fromEntries(ids.map((id) => [id, { id, code: `c${id}`, zone: "victory" }]));
    return { victory: ids, cards, modifiers: [] } as unknown as ScenarioState;
  };

  it("is null while the display is empty", () => {
    expect(victoryPileSelector(() => 1)(made([]))).toBeNull();
  });

  it("shows the newest card on top, fans the two before it, oldest first, and totals the points", () => {
    const view = victoryPileSelector((_, id) => (id === "a" ? 3 : 1))(made(["a", "b", "c", "d"]));
    expect(view?.top?.id).toBe("d");
    expect(view?.fan?.map((card) => card.id)).toEqual(["b", "c"]);
    expect(view?.points).toBe(6);
    expect(view?.ids).toHaveLength(4);
  });

  it("returns the same view while the display, its cards and the modifiers are the same", () => {
    const select = victoryPileSelector(() => 1);
    const game = made(["a", "b"]);
    const first = select(game);
    expect(select({ ...game })).toBe(first);
  });

  it("opens a list, as a discard pile does, and is named in words", () => {
    expect(opensList("victory")).toBe(true);
    expect(opensList("deck")).toBe(false);
    expect(PILE_WORDS.victory).toBe("Victory display");
  });
});
