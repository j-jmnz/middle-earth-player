import { describe, expect, it } from "vitest";

import { fixtureDefinition } from "../rules/fixture.ts";
import { blankScenario, withSeat } from "../rules/state.ts";

import { twoHanded } from "./seat-fixture.ts";
import { actingSeat, pileSelector, shownSeat, threatSelector, tickKeySelector, zoneIds, zoneSelector } from "./selectors.ts";

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
