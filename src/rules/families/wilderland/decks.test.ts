// Rules: emce.caves-deck, emce.evil-creatures-deck, emce.setup-lost-in-mirkwood (data/rules/entries.json). The decks of Ered Mithrin beside the encounter deck: dealt and shuffled by the Setup, joined by a card, revealed from, and the Evil
// Creatures deck's own discard pile (an enemy of the deck goes there when it leaves play, even with Victory points; an empty deck is refilled from it). Dream-chaser's Corsair deck and Uncharted deck share the code (sea/corsair.test.ts, uncharted/*.test.ts).
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { pileOf } from "../../core/piles.ts";
import { startScenario } from "../../setup/setup.ts";
import { fixtureDefinition } from "../../core/test-fixture.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { dealtPiles, encounterCodes, parseScenarioData } from "../../../catalog/scenario-data.ts";
import anduin from "../../../../data/scenarios/journey-up-the-anduin.json";
import gundabad from "../../../../data/scenarios/mount-gundabad.json";
import { codesOf, ctxOf, deal, table } from "./fixture.ts";

const ctx = ctxOf([]);

// An instruction run as a When Revealed effect of the source card (a frame that settles to its end), the source being `sourceId`.
function run(state: ScenarioState, instruction: Instruction, sourceId = "none"): ScenarioState {
  const framed = pushEffectFrame(state, { frame: "whenRevealed", sourceId, actor: 0, peril: false, effectId: "fixture:whenRevealed:1", instructions: [instruction], cancel: null, blockCancel: null }, []);
  return settle(framed, ctx, []);
}

describe("dealing the decks (emce.caves-deck, emce.evil-creatures-deck)", () => {
  const start = (piles: Parameters<typeof startScenario>[0]["piles"]) =>
    startScenario(
      { seatCount: 1, seed: 5, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["frodo"], deck: [] }, { heroes: [], deck: [] }], encounterDeck: ["mist"], questDeck: ["stage"], piles },
      ctx,
    );

  it("puts each pile's cards into its zone, out of play, and gives the Evil Creatures deck a discard pile", () => {
    const state = start({ cavesDeck: ["cave1", "cave2"], evilCreaturesDeck: ["ec1", "ec2"] });
    expect(codesOf(state, pileOf(state, "cavesDeck"))).toEqual(["cave1", "cave2"]);
    expect(codesOf(state, pileOf(state, "evilCreaturesDeck"))).toEqual(["ec1", "ec2"]);
    expect(state.piles?.evilCreaturesDiscard).toEqual([]);
    expect(state.encounterDeck).toHaveLength(1);
    expect(state.cards[pileOf(state, "cavesDeck")[0] ?? ""]?.zone).toBe("cavesDeck");
  });

  it("leaves a game that deals no such pile without any of them", () => {
    expect(start(undefined).piles).toBeUndefined();
  });
});

describe("the decks a scenario's data deals (emce.caves-deck, emce.evil-creatures-deck)", () => {
  it("are the cards of the scenario's deck piles, copy by copy, and not part of the encounter deck", () => {
    const data = parseScenarioData(anduin);
    const piles = dealtPiles(data);
    expect(Object.keys(piles)).toEqual(["evilCreaturesDeck"]);
    const wilderlands = data.cards.filter((card) => card.pile === "evilCreaturesDeck");
    expect(piles.evilCreaturesDeck).toHaveLength(wilderlands.reduce((sum, card) => sum + card.normal, 0));
    const inEncounter = new Set(encounterCodes(data));
    expect(wilderlands.some((card) => inEncounter.has(card.code))).toBe(false);
  });

  it("deal the Caves deck of a scenario that has one, and none for the difficulty that drops a card", () => {
    const data = parseScenarioData(gundabad);
    expect(dealtPiles(data).cavesDeck?.length).toBeGreaterThan(0);
    expect(dealtPiles(data, "Easy").cavesDeck?.length).toBeLessThanOrEqual(dealtPiles(data).cavesDeck?.length ?? 0);
  });
});

describe("ShufflePile and ShuffleIntoPile (emce.caves-deck)", () => {
  it("shuffles the Caves deck with the game's seed", () => {
    const { state } = deal(table(), ["cave1", "cave2", "sign", "cave1", "cave2", "cave1"], { zone: "cavesDeck" });
    const shuffled = run(state, { verb: "ShufflePile", pile: "caves" });
    expect(pileOf(shuffled, "cavesDeck")).not.toEqual(pileOf(state, "cavesDeck"));
    expect([...pileOf(shuffled, "cavesDeck")].sort()).toEqual([...pileOf(state, "cavesDeck")].sort());
    expect(shuffled.seedCursor).toBeGreaterThan(state.seedCursor);
  });

  it("does nothing for a deck the scenario did not deal", () => {
    const next = run(table(), { verb: "ShufflePile", pile: "evilCreatures" });
    expect(next.piles).toBeUndefined();
    expect(next.seedCursor).toBe(table().seedCursor);
  });

  it("adds a new copy of a card to the deck and shuffles it in", () => {
    const { state } = deal(table(), ["cave1", "cave2"], { zone: "cavesDeck" });
    const next = run(state, { verb: "ShuffleIntoPile", pile: "caves", code: "sign" });
    expect(codesOf(next, pileOf(next, "cavesDeck")).sort()).toEqual(["cave1", "cave2", "sign"]);
    expect(next.cards[pileOf(next, "cavesDeck")[0] ?? ""]?.zone).toBe("cavesDeck");
  });

  it("starts the deck when the game had dealt none", () => {
    const next = run(table(), { verb: "ShuffleIntoPile", pile: "caves", code: "cave1" });
    expect(codesOf(next, pileOf(next, "cavesDeck"))).toEqual(["cave1"]);
  });
});

describe("the Evil Creatures deck (emce.evil-creatures-deck)", () => {
  function withDeck(codes: readonly string[]): ScenarioState {
    const dealt = deal({ ...table(), piles: { evilCreaturesDeck: [], evilCreaturesDiscard: [] } }, codes, { zone: "evilCreaturesDeck" });
    return dealt.state;
  }

  it("adds the top card to the staging area, entering play", () => {
    const state = withDeck(["ec1", "ec2"]);
    const next = run(state, { verb: "AddFromPile", pile: "evilCreatures", to: "staging" });
    expect(codesOf(next, next.staging)).toEqual(["ec1"]);
    expect(codesOf(next, pileOf(next, "evilCreaturesDeck"))).toEqual(["ec2"]);
  });

  it("puts the top card into play engaged with the first player, a card for each of `count`", () => {
    const state = withDeck(["ec1", "ec2", "orc"]);
    const next = run(state, { verb: "AddFromPile", pile: "evilCreatures", to: "engaged", who: "firstPlayer", count: 2 });
    expect(codesOf(next, next.seats[0].engaged)).toEqual(["ec1", "ec2"]);
    expect(codesOf(next, pileOf(next, "evilCreaturesDeck"))).toEqual(["orc"]);
  });

  it("engages each player with a card when the verb says each seat", () => {
    const state = deal({ ...table(2), piles: { evilCreaturesDeck: [], evilCreaturesDiscard: [] } }, ["ec1", "ec2"], { zone: "evilCreaturesDeck" }).state;
    const next = run(state, { verb: "AddFromPile", pile: "evilCreatures", to: "engaged", who: "eachSeat" });
    expect(codesOf(next, next.seats[0].engaged)).toEqual(["ec1"]);
    expect(codesOf(next, next.seats[1].engaged)).toEqual(["ec2"]);
  });

  it("sends an enemy of the deck that leaves play to the Evil Creatures discard pile, not the encounter discard pile", () => {
    const state = withDeck(["ec1", "orc"]);
    const staged = run(state, { verb: "AddFromPile", pile: "evilCreatures", to: "staging" });
    const id = staged.staging[0] ?? "";
    const gone = moveCard(staged, id, { zone: "encounterDiscard" });
    expect(gone.cards[id]?.zone).toBe("evilCreaturesDiscard");
    expect(pileOf(gone, "evilCreaturesDiscard")).toEqual([id]);
    expect(gone.encounterDiscard).toEqual([]);
  });

  it("does so even when the enemy has Victory points, which would send it to the victory display", () => {
    const staged = run(withDeck(["ec2", "orc"]), { verb: "AddFromPile", pile: "evilCreatures", to: "staging" });
    const id = staged.staging[0] ?? "";
    const gone = moveCard(staged, id, { zone: "victory" });
    expect(gone.cards[id]?.zone).toBe("evilCreaturesDiscard");
    expect(gone.victory).toEqual([]);
  });

  it("leaves an enemy that was not dealt into the deck to the ordinary piles, Victory display included", () => {
    const state = withDeck(["orc"]);
    const other = spawn(state, "ec2", { zone: "staging" });
    expect(moveCard(other.state, other.id, { zone: "encounterDiscard" }).cards[other.id]?.zone).toBe("encounterDiscard");
    expect(moveCard(other.state, other.id, { zone: "victory" }).cards[other.id]?.zone).toBe("victory");
  });

  it("shuffles its discard pile back into the deck at once when the deck runs out", () => {
    const staged = run(withDeck(["ec1"]), { verb: "AddFromPile", pile: "evilCreatures", to: "staging" });
    const id = staged.staging[0] ?? "";
    // The only card of the deck leaves play: the deck is empty, so the settle that follows refills it.
    const refilled = settle(moveCard(staged, id, { zone: "encounterDiscard" }), ctx, []);
    expect(pileOf(refilled, "evilCreaturesDeck")).toEqual([id]);
    expect(pileOf(refilled, "evilCreaturesDiscard")).toEqual([]);
    expect(refilled.cards[id]).toMatchObject({ zone: "evilCreaturesDeck", face: "down" });
  });

  it("refills from the discard pile before revealing, and reveals nothing with both empty", () => {
    const discarded = deal({ ...table(), piles: { evilCreaturesDeck: [], evilCreaturesDiscard: [] } }, ["ec1"], { zone: "evilCreaturesDiscard" }).state;
    const next = run(discarded, { verb: "AddFromPile", pile: "evilCreatures", to: "staging" });
    expect(codesOf(next, next.staging)).toEqual(["ec1"]);
    const empty = run({ ...table(), piles: { evilCreaturesDeck: [], evilCreaturesDiscard: [] } }, { verb: "AddFromPile", pile: "evilCreatures", to: "staging", count: 3 });
    expect(empty.staging).toEqual([]);
  });

  it("leaves a game with no Evil Creatures deck alone", () => {
    expect(run(table(), { verb: "AddFromPile", pile: "evilCreatures", to: "staging" }).staging).toEqual([]);
  });
});

describe("ShufflePileIntoEncounterDeck (emce.setup-lost-in-mirkwood)", () => {
  it("shuffles the set-aside deck into the encounter deck, facedown, leaving the deck empty", () => {
    const base = deal(table(), ["mist"], { zone: "encounterDeck" }).state;
    const { state } = deal(base, ["orc", "ec1"], { zone: "spidersDeck" });
    const next = run(state, { verb: "ShufflePileIntoEncounterDeck", pile: "spiders" });
    expect(codesOf(next, next.encounterDeck).sort()).toEqual(["ec1", "mist", "orc"]);
    expect(pileOf(next, "spidersDeck")).toEqual([]);
    expect(next.cards[next.encounterDeck[0] ?? ""]?.zone).toBe("encounterDeck");
  });
});
