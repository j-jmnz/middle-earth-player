// Rules: dcce.corsair-deck, dcce.uncharted-deck, emce.caves-deck, emce.evil-creatures-deck (data/rules/entries.json). The accessor the decks beside the encounter deck share: the Corsair deck and the Uncharted deck of the Dream-chaser box
// and the decks of Ered Mithrin read and write their lists the same way, and a card of a deck with a discard pile of its own remembers it.
import { describe, expect, it } from "vitest";

import { deckRoute, isDeckZone, joinPile, leavePile, pileOf, shufflePile, withPile } from "./piles.ts";
import { idleScenario } from "./test-fixture.ts";
import { spawn } from "./zones.ts";

describe("deck zones", () => {
  it("name every list the accessor reads", () => {
    for (const zone of ["corsairDeck", "corsairDiscard", "unchartedDeck", "cavesDeck", "evilCreaturesDeck", "evilCreaturesDiscard", "spidersDeck", "orcsDeck"]) expect(isDeckZone(zone)).toBe(true);
    for (const zone of ["encounterDeck", "encounterDiscard", "deck", "staging"]) expect(isDeckZone(zone)).toBe(false);
  });

  it("read and write the Corsair lists, the Uncharted deck inside `uncharted`, and Ered Mithrin's inside `piles`", () => {
    const state = idleScenario(1);
    expect(pileOf(state, "corsairDeck")).toEqual([]);
    expect(withPile(state, "corsairDeck", ["a"]).corsairDeck).toEqual(["a"]);
    expect(withPile(state, "corsairDiscard", ["b"]).corsairDiscard).toEqual(["b"]);
    expect(withPile(state, "cavesDeck", ["c"]).piles).toEqual({ cavesDeck: ["c"] });
    expect(pileOf(withPile(state, "cavesDeck", ["c"]), "cavesDeck")).toEqual(["c"]);
    // The Uncharted deck lives in the state's `uncharted`; a game without one has no deck to write.
    expect(withPile(state, "unchartedDeck", ["d"])).toBe(state);
    const uncharted = { ...state, uncharted: { deck: ["x"], codes: [] } };
    expect(pileOf(uncharted, "unchartedDeck")).toEqual(["x"]);
    expect(withPile(uncharted, "unchartedDeck", ["y"]).uncharted?.deck).toEqual(["y"]);
  });

  it("join once at the bottom, leave by id, and leave a state as it is when the card is not in the list", () => {
    const state = idleScenario(1);
    const joined = joinPile(joinPile(joinPile(state, "cavesDeck", "a"), "cavesDeck", "b"), "cavesDeck", "a");
    expect(pileOf(joined, "cavesDeck")).toEqual(["a", "b"]);
    expect(pileOf(leavePile(joined, "cavesDeck", "a"), "cavesDeck")).toEqual(["b"]);
    expect(leavePile(joined, "cavesDeck", "zzz")).toBe(joined);
  });

  it("shuffle with the game's seed, moving it even for a list of one", () => {
    const state = withPile(idleScenario(1), "cavesDeck", ["a", "b", "c", "d", "e", "f"]);
    const shuffled = shufflePile(state, "cavesDeck");
    expect([...pileOf(shuffled, "cavesDeck")].sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(shuffled.seedCursor).toBe(state.seedCursor + 5);
    expect(shufflePile(withPile(idleScenario(1), "cavesDeck", ["a"]), "cavesDeck").seedCursor).toBe(idleScenario(1).seedCursor);
  });

  it("mark a card dealt into a deck with a discard pile of its own, and route its discard and its Victory to that pile", () => {
    const made = spawn(idleScenario(1), "x", { zone: "evilCreaturesDeck" });
    const card = made.state.cards[made.id]!;
    expect(card.deck).toBe("evilCreatures");
    expect(deckRoute(card, { zone: "encounterDiscard" }, true)).toEqual({ zone: "evilCreaturesDiscard" });
    expect(deckRoute(card, { zone: "victory" }, true)).toEqual({ zone: "evilCreaturesDiscard" });
    // A card that was not in play does not go to the victory display anyway; any other destination is kept.
    expect(deckRoute(card, { zone: "victory" }, false)).toEqual({ zone: "victory" });
    expect(deckRoute(card, { zone: "staging" }, true)).toEqual({ zone: "staging" });
    const plain = spawn(idleScenario(1), "x", { zone: "cavesDeck" });
    expect(plain.state.cards[plain.id]?.deck).toBeUndefined();
  });
});
