// Rules: rm.raven-deck, faq.reveal-and-add, rr.then (data/rules/entries.json); ledger lines 08147:A:1, 08148:A:1, 08148:B:2. The Raven deck of The Antlered Crown as a named deck beside the encounter deck (core/piles.ts DECKS): created from the
// set-aside enemies, taken from without a reveal and revealed from, refilled from its discard pile, and the place its enemies go when they leave play. A game that does not deal it is not touched.
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { shuffleDiscardIntoPile } from "./decks.ts";
import { reshuffleIntoDeck } from "../../core/decks.ts";
import type { EngineStep } from "../../core/intents.ts";
import { DECKS, pileOf } from "../../core/piles.ts";
import { moveCard, shadowCards, spawn } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { codesOf, ctxOf, deal, record, table } from "./fixture.ts";

// "orc" prints a When Revealed effect that puts 2 resource tokens on it: what a reveal does and an add does not.
const REVEALED = record("orc:whenRevealed:1", "orc", "whenRevealed", [{ verb: "PlaceResourceTokens", amount: 2, on: "self" }]);
const ctx = ctxOf([REVEALED]);

function run(state: ScenarioState, instruction: Instruction | readonly Instruction[], sourceId = "none"): ScenarioState {
  const instructions = Array.isArray(instruction) ? [...instruction] : [instruction as Instruction];
  return settle(pushEffectFrame(state, { frame: "whenRevealed", sourceId, actor: 0, peril: false, effectId: "fixture:whenRevealed:1", instructions, cancel: null, blockCancel: null }, []), ctx, []);
}

const withRaven = (codes: readonly string[], discarded: readonly string[] = []) => {
  const base: ScenarioState = { ...table(2), piles: { ravenDeck: [], ravenDiscard: [] } };
  return deal(deal(base, codes, { zone: "ravenDeck" }).state, discarded, { zone: "ravenDiscard" }).state;
};

describe("FormPile (rm.raven-deck)", () => {
  it("moves each set-aside copy of the codes, and only those, facedown into the deck, and makes the empty discard pile", () => {
    const { state } = deal(deal(table(), ["ec1", "orc", "ec1"], { zone: "setAside" }).state, ["ec2"], { zone: "encounterDeck" });
    const next = run(state, { verb: "FormPile", pile: "raven", codes: ["ec1", "orc"] });
    expect(codesOf(next, pileOf(next, "ravenDeck")).sort()).toEqual(["ec1", "ec1", "orc"]);
    expect(pileOf(next, "ravenDiscard")).toEqual([]);
    expect(next.setAside).toEqual([]);
    expect(next.encounterDeck).toHaveLength(1);
    for (const id of pileOf(next, "ravenDeck")) expect(next.cards[id]).toMatchObject({ zone: "ravenDeck", face: "down", deck: "raven" });
  });

  it("leaves a set-aside card of another code where it is, and makes an empty deck when no copy is set aside", () => {
    const { state } = deal(table(), ["ec2"], { zone: "setAside" });
    const next = run(state, { verb: "FormPile", pile: "raven", codes: ["ec1"] });
    expect(next.setAside).toHaveLength(1);
    expect(next.piles).toMatchObject({ ravenDeck: [], ravenDiscard: [] });
  });
});

describe("the Raven deck's shuffles (rm.raven-deck)", () => {
  it("ShufflePile shuffles the deck with the game's seed", () => {
    const state = withRaven(["ec1", "ec2", "orc", "ec1", "ec2", "orc"]);
    const shuffled = run(state, { verb: "ShufflePile", pile: "raven" });
    expect([...pileOf(shuffled, "ravenDeck")].sort()).toEqual([...pileOf(state, "ravenDeck")].sort());
    expect(pileOf(shuffled, "ravenDeck")).not.toEqual(pileOf(state, "ravenDeck"));
  });

  it("ShuffleDiscardIntoPile puts the discard pile back into the deck, facedown, and shuffles", () => {
    const state = withRaven(["ec1", "ec1", "ec1"], ["ec2", "orc", "orc"]);
    const next = run(state, { verb: "ShuffleDiscardIntoPile", pile: "raven" });
    expect(pileOf(next, "ravenDiscard")).toEqual([]);
    expect(codesOf(next, pileOf(next, "ravenDeck")).sort()).toEqual(["ec1", "ec1", "ec1", "ec2", "orc", "orc"]);
    expect(next.seedCursor).toBeGreaterThan(state.seedCursor);
    for (const id of pileOf(state, "ravenDiscard")) expect(next.cards[id]?.face).toBe("down");
  });

  it("the shuffle of the discard pile is logged as a reshuffleDeck step, as the refill is", () => {
    const steps: EngineStep[] = [];
    reshuffleIntoDeck(withRaven(["ec1"], ["ec2", "orc"]), DECKS.raven, pileOf(withRaven(["ec1"], ["ec2", "orc"]), "ravenDiscard"), steps);
    expect(steps.map((step) => (step.kind === "reshuffleDeck" ? [step.deck, step.count] : step.kind))).toEqual([["ravenDeck", 2]]);
    const run2: EngineStep[] = [];
    shuffleDiscardIntoPile(withRaven(["ec1"], ["ec2"]), { verb: "ShuffleDiscardIntoPile", pile: "raven" }, run2);
    expect(run2[0]).toMatchObject({ kind: "reshuffleDeck", cause: { rule: "rr.effects" } });
    const none: EngineStep[] = [];
    reshuffleIntoDeck(withRaven(["ec1"]), DECKS.raven, [], none);
    expect(none).toEqual([]);
  });

  it("rr.then: with an empty discard pile the shuffle cannot fail, so each player still takes the top card after it", () => {
    const state = withRaven(["ec1", "ec2"]);
    const next = run(state, [{ verb: "ShuffleDiscardIntoPile", pile: "raven" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "AddFromPile", pile: "raven", to: "staging" }] }]);
    expect(next.staging).toHaveLength(2);
    expect(pileOf(next, "ravenDeck")).toEqual([]);
  });

  it("does nothing in a game that did not deal the deck", () => {
    const next = run(table(), { verb: "ShuffleDiscardIntoPile", pile: "raven" });
    expect(next.piles).toBeUndefined();
    expect(next.seedCursor).toBe(table().seedCursor);
  });
});

describe("taking from the Raven deck (rm.raven-deck, faq.reveal-and-add)", () => {
  it("an add puts the top card into the staging area with no When Revealed effect", () => {
    const next = run(withRaven(["orc", "ec1"]), { verb: "AddFromPile", pile: "raven", to: "staging" });
    expect(codesOf(next, next.staging)).toEqual(["orc"]);
    expect(next.cards[next.staging[0] ?? ""]?.resources).toBe(0);
    expect(codesOf(next, pileOf(next, "ravenDeck"))).toEqual(["ec1"]);
  });

  it("a reveal resolves the card's When Revealed effect, then adds it to the staging area", () => {
    const next = run(withRaven(["orc", "ec1"]), { verb: "AddFromPile", pile: "raven", to: "staging", reveal: true });
    expect(codesOf(next, next.staging)).toEqual(["orc"]);
    expect(next.cards[next.staging[0] ?? ""]?.resources).toBe(2);
  });

  it("each player in turn, the first player first, takes a card and is engaged with it", () => {
    const next = run({ ...withRaven(["ec1", "ec2", "orc"]), firstPlayer: 1 }, { verb: "AddFromPile", pile: "raven", to: "engaged", who: "eachSeat" });
    expect(codesOf(next, next.seats[1]?.engaged ?? [])).toEqual(["ec1"]);
    expect(codesOf(next, next.seats[0]?.engaged ?? [])).toEqual(["ec2"]);
  });
});

describe("an enemy of the Raven deck that leaves play (rm.raven-deck)", () => {
  it("goes to the Raven discard pile, not the encounter discard pile, even with Victory points", () => {
    const staged = run(withRaven(["ec2", "orc"]), { verb: "AddFromPile", pile: "raven", to: "staging" });
    const id = staged.staging[0] ?? "";
    const gone = moveCard(staged, id, { zone: "victory" });
    expect(gone.cards[id]?.zone).toBe("ravenDiscard");
    expect(pileOf(gone, "ravenDiscard")).toEqual([id]);
    expect(gone.victory).toEqual([]);
    expect(moveCard(staged, id, { zone: "encounterDiscard" }).encounterDiscard).toEqual([]);
  });

  it("an enemy of the encounter deck goes to the encounter discard pile as before", () => {
    const other = deal(withRaven(["orc"]), ["ec1"], { zone: "staging" });
    expect(moveCard(other.state, other.ids[0] ?? "", { zone: "encounterDiscard" }).encounterDiscard).toEqual(other.ids);
  });

  it("the deck is shuffled from the discard pile at once when it is empty", () => {
    const staged = run(withRaven(["ec1"]), { verb: "AddFromPile", pile: "raven", to: "staging" });
    const id = staged.staging[0] ?? "";
    const refilled = settle(moveCard(staged, id, { zone: "encounterDiscard" }), ctx, []);
    expect(pileOf(refilled, "ravenDeck")).toEqual([id]);
    expect(pileOf(refilled, "ravenDiscard")).toEqual([]);
    expect(refilled.cards[id]).toMatchObject({ zone: "ravenDeck", face: "down" });
  });

  it("an add from an empty deck refills it from the discard pile first, and adds nothing with both empty", () => {
    const next = run(withRaven([], ["ec1"]), { verb: "AddFromPile", pile: "raven", to: "staging" });
    expect(codesOf(next, next.staging)).toEqual(["ec1"]);
    expect(run(withRaven([]), { verb: "AddFromPile", pile: "raven", to: "staging", count: 2 }).staging).toEqual([]);
  });
});

describe("shadow cards from the Raven deck (08156:A:2, rm.raven-deck)", () => {
  const TWO: Instruction[] = [{ verb: "DealShadowTo", target: "self", from: "raven" }, { verb: "DealShadowTo", target: "self", from: "raven" }];
  const engagedEnemy = (raven: readonly string[], discarded: readonly string[] = []) => {
    const enemy = spawn(deal(withRaven(raven, discarded), ["mist", "mist"], { zone: "encounterDeck" }).state, "ec1", { zone: "engaged", seat: 0 });
    return { state: enemy.state, id: enemy.id };
  };

  it("the two shadow cards come one after the other from the top of the Raven deck, and the encounter deck is not touched", () => {
    const { state, id } = engagedEnemy(["orc", "ec2", "orc"]);
    const next = run(state, TWO, id);
    expect(codesOf(next, shadowCards(next.cards[id]))).toEqual(["orc", "ec2"]);
    expect(codesOf(next, pileOf(next, "ravenDeck"))).toEqual(["orc"]);
    expect(next.encounterDeck).toHaveLength(2);
  });

  it("a shadow card from the Raven deck that is discarded goes to the Raven discard pile", () => {
    const { state, id } = engagedEnemy(["orc", "ec2", "orc"]);
    const dealt = run(state, TWO, id);
    const shadow = shadowCards(dealt.cards[id])[0] ?? "";
    const gone = moveCard(dealt, shadow, { zone: "encounterDiscard" });
    expect(pileOf(gone, "ravenDiscard")).toEqual([shadow]);
    expect(gone.encounterDiscard).toEqual([]);
  });

  it("an empty Raven deck is refilled from its discard pile first, and an empty discard pile deals nothing", () => {
    const refilled = engagedEnemy([], ["orc", "ec2"]);
    const next = run(refilled.state, TWO, refilled.id);
    expect(shadowCards(next.cards[refilled.id])).toHaveLength(2);
    const empty = engagedEnemy([]);
    expect(shadowCards(run(empty.state, TWO, empty.id).cards[empty.id])).toEqual([]);
  });

  it("a game that dealt no Raven deck deals from the encounter deck, as a Balrog flag does without a Balrog deck", () => {
    const enemy = spawn(deal(table(), ["mist", "mist"], { zone: "encounterDeck" }).state, "ec1", { zone: "engaged", seat: 0 });
    expect(codesOf(enemy.state, shadowCards(run(enemy.state, TWO, enemy.id).cards[enemy.id]))).toEqual(["mist", "mist"]);
  });
});
