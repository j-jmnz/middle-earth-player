// Rules: rm.out-of-play-deck, rm.mugash-player-card-backs, rm.searches-x, rr.in-play-and-out-of-play, rr.engaged (data/rules/entries.json); ledger lines 07062:A:1, 07029:A:1, 07027:A:2, 07028:A:1, 07026:A:1, 07025:A:1, 07025:A:2.
// The engine the ring-maker family adds for To Catch an Orc: the out-of-play decks, the reveals and searches from them, a hand card shuffled into one, the Guard that engages the holder of Mugash and Mugash's return to the staging area.
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { pileOf } from "../../core/piles.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard, attachTo } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { idOf, idsOf, run, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "to-catch-an-orc";
const MUGASH = "07024";
const GUARD = "07025";
const ORC_HOUND = "07040";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout, { extra: ["02079"] });
const DECK = ["filler", "ally", "event", "ally", "filler", "event", "ally", "filler"] as const;
const CREATE: Instruction = { verb: "CreateOutOfPlayDecks", count: 3 };
const SHUFFLE_IN: Instruction = { verb: "ShuffleIntoOutOfPlayDecks", once: MUGASH, perOtherPlayer: GUARD };

describe("CreateOutOfPlayDecks (07062:A:1)", () => {
  const two = () => table({ seats: 2, deckOf: DECK.flatMap((code) => [code, { code, seat: 1 }]) });

  it("07062:A:1 each seat moves the top cards of its deck into its own facedown pile, in order, owned by it", () => {
    const t = two();
    const before = [0, 1].map((seat) => t.state.seats[seat]?.deck ?? []);
    const state = run(t, t.state, CREATE);
    expect(pileOf(state, "outOfPlay0")).toEqual(before[0]?.slice(0, 3));
    expect(pileOf(state, "outOfPlay1")).toEqual(before[1]?.slice(0, 3));
    expect(state.seats[0]?.deck).toEqual(before[0]?.slice(3));
    const card = state.cards[pileOf(state, "outOfPlay1")[0] ?? ""];
    expect(card).toMatchObject({ zone: "outOfPlay1", face: "down", owner: 1 });
    expect(card?.controller ?? null).toBeNull();
  });

  it("a deck of fewer cards than the count gives all it holds, and a seat with none still has a pile", () => {
    const t = table({ seats: 1, deckOf: ["filler", "ally"] });
    const state = run(t, t.state, CREATE);
    expect(pileOf(state, "outOfPlay0")).toHaveLength(2);
    expect(state.seats[0]?.deck).toEqual([]);
    const bare = table({ seats: 1 });
    expect(run(bare, bare.state, CREATE).piles?.outOfPlay0).toEqual([]);
  });
});

describe("ShuffleIntoOutOfPlayDecks (07062:A:1)", () => {
  it("07062:A:1 two players: Mugash and one Guard go one into each pile, facedown and owned by nobody; two Guards stay aside", () => {
    const t = table({ seats: 2, setAside: [MUGASH, GUARD, GUARD, GUARD], deckOf: DECK.flatMap((code) => [code, { code, seat: 1 }]) });
    const state = run(t, run(t, t.state, CREATE), SHUFFLE_IN);
    const codes = (seat: 0 | 1) => pileOf(state, seat === 0 ? "outOfPlay0" : "outOfPlay1").map((id) => state.cards[id]?.code);
    expect(codes(0)).toHaveLength(4);
    expect(codes(1)).toHaveLength(4);
    const dealt = [...codes(0), ...codes(1)].filter((code) => code === MUGASH || code === GUARD).sort();
    expect(dealt).toEqual([MUGASH, GUARD]);
    expect([codes(0), codes(1)].filter((list) => list.includes(MUGASH) || list.includes(GUARD))).toHaveLength(2);
    expect(state.setAside.map((id) => state.cards[id]?.code)).toEqual([GUARD, GUARD]);
    const mugash = state.cards[idOf(state, MUGASH)];
    expect(mugash).toMatchObject({ face: "down" });
    expect(mugash?.owner).toBeUndefined();
  });

  it("07062:A:1 one player: Mugash alone goes into the pile and every Guard stays aside", () => {
    const t = table({ seats: 1, setAside: [MUGASH, GUARD, GUARD, GUARD], deckOf: [...DECK] });
    const state = run(t, run(t, t.state, CREATE), SHUFFLE_IN);
    expect(pileOf(state, "outOfPlay0").map((id) => state.cards[id]?.code)).toContain(MUGASH);
    expect(pileOf(state, "outOfPlay0")).toHaveLength(4);
    expect(idsOf(state, GUARD).every((id) => state.cards[id]?.zone === "setAside")).toBe(true);
  });
});

describe("RevealOutOfPlay (07029:A:1, 07027:A:2, 07028:A:1)", () => {
  // The pile holds, top first: a filler, Orc Hound (an enemy), an ally, an event.
  const pile = (layout: Layout = {}) => {
    const t = table({ seats: 1, deckOf: ["filler", ORC_HOUND, "ally", "event", "filler"], ...layout });
    return { t, state: run(t, t.state, { verb: "CreateOutOfPlayDecks", count: 4 }) };
  };

  it("07029:A:1 reveals the top card: an enemy joins the staging area, any other card goes to its owner's discard pile, and a deck that is empty reveals nothing", () => {
    const { t, state } = pile();
    const plain = run(t, state, { verb: "RevealOutOfPlay", amount: 1 });
    expect(plain.seats[0]?.discard).toHaveLength(1);
    expect(pileOf(plain, "outOfPlay0")).toHaveLength(3);
    const enemy = run(t, plain, { verb: "RevealOutOfPlay", amount: 1 });
    expect(enemy.staging).toContain(idOf(enemy, ORC_HOUND));
    expect(enemy.cards[idOf(enemy, ORC_HOUND)]).toMatchObject({ zone: "staging", face: "up" });
    const empty = run(t, run(t, enemy, { verb: "RevealOutOfPlay", amount: 5 }), { verb: "RevealOutOfPlay", amount: 5 });
    expect(pileOf(empty, "outOfPlay0")).toEqual([]);
    expect(empty).toMatchObject({ staging: enemy.staging });
  });

  it("07027:A:2 Searches 3 reveals three cards, stages the enemy, picks one of the others for the hand and discards the rest unshuffled", () => {
    const { t, state } = pile();
    const found = run(t, state, { verb: "RevealOutOfPlay", amount: 3, chooseForHand: true });
    expect(found.staging).toContain(idOf(found, ORC_HOUND));
    expect(found.seats[0]?.hand).toHaveLength(1);
    expect(found.seats[0]?.discard).toHaveLength(1);
    expect(found.cards[found.seats[0]?.hand[0] ?? ""]).toMatchObject({ zone: "hand", owner: undefined });
    expect(pileOf(found, "outOfPlay0")).toHaveLength(1);
    expect(found.seedCursor).toBe(state.seedCursor);
  });

  it("07028:A:1 only the acting seat searches its own pile", () => {
    const t = table({ seats: 2, deckOf: DECK.flatMap((code) => [code, { code, seat: 1 }]) });
    const state = run(t, t.state, CREATE);
    const found = run(t, state, { verb: "RevealOutOfPlay", amount: 2, chooseForHand: true }, { seat: 1 });
    expect(pileOf(found, "outOfPlay0")).toHaveLength(3);
    expect(pileOf(found, "outOfPlay1")).toHaveLength(1);
    expect(found.seats[1]?.hand).toHaveLength(1);
    expect(found.seats[0]?.hand).toHaveLength(0);
  });
});

describe("ShuffleHandCardIntoOutOfPlay (07026:A:1)", () => {
  const withPile = (layout: Layout) => {
    const t = table({ seats: 1, deckOf: [...DECK], ...layout });
    return { t, state: run(t, t.state, CREATE) };
  };

  it("07026:A:1 one random hand card goes facedown into the pile at a random place, owned by the player", () => {
    const { t, state } = withPile({ hand: ["filler", "ally", "event"] });
    const done = run(t, state, { verb: "ShuffleHandCardIntoOutOfPlay", random: true });
    expect(done.seats[0]?.hand).toHaveLength(2);
    expect(pileOf(done, "outOfPlay0")).toHaveLength(4);
    const moved = pileOf(done, "outOfPlay0").find((id) => !pileOf(state, "outOfPlay0").includes(id)) ?? "";
    expect(done.cards[moved]).toMatchObject({ zone: "outOfPlay0", face: "down", owner: 0 });
    expect(done.seedCursor).toBeGreaterThan(state.seedCursor);
  });

  it("07026:A:1 an empty hand does nothing", () => {
    const { t, state } = withPile({ hand: [] });
    expect(run(t, state, { verb: "ShuffleHandCardIntoOutOfPlay", random: true })).toEqual(state);
  });

  it("07026:A:1 a card that cannot leave the hand is never the card drawn at random", () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      const { t, state } = withPile({ seed, hand: ["ally", "event"], heldInHand: ["ally"] });
      const done = run(t, state, { verb: "ShuffleHandCardIntoOutOfPlay", random: true });
      expect(done.seats[0]?.hand.map((id) => done.cards[id]?.code)).toEqual(["ally"]);
    }
    const lone = withPile({ hand: ["ally"], heldInHand: ["ally"] });
    expect(run(lone.t, lone.state, { verb: "ShuffleHandCardIntoOutOfPlay", random: true })).toEqual(lone.state);
  });
});

describe("Mugash held by a hero (07025:A:1, 07025:A:2)", () => {
  // Mugash attached to the first hero as an attachment, a Guard in the staging area.
  const held = () => {
    const t = table({ seats: 2, staging: [GUARD] });
    return { t, state: t.state };
  };

  it("07025:A:1 nothing engages while no hero holds Mugash", () => {
    const { t, state } = held();
    const settled = settle(state, t.ctx, []);
    expect(settled.cards[idOf(settled, GUARD)]?.zone).toBe("staging");
  });

  it("07025:A:2 ReturnAttachedEnemy sends an attached Mugash back to the staging area and leaves one elsewhere alone", () => {
    const t = table({ seats: 1, staging: [MUGASH] });
    const id = idOf(t.state, MUGASH);
    const hero = t.state.seats[0]?.heroes[0] ?? "";
    const attached = updateCard(attachTo(moveCard(t.state, id, { zone: "attached" }), id, hero), id, { asAttachment: true });
    expect(attached.cards[hero]?.attachments).toContain(id);
    const returned = run(t, attached, { verb: "ReturnAttachedEnemy", name: "Mugash" });
    expect(returned.cards[id]).toMatchObject({ zone: "staging", face: "up" });
    expect(returned.cards[id]?.host ?? null).toBeNull();
    expect(returned.cards[hero]?.attachments).not.toContain(id);
    expect(run(t, t.state, { verb: "ReturnAttachedEnemy", name: "Mugash" })).toEqual(t.state);
  });

  it("07025:A:1 the Guard engages the player who controls the hero Mugash lies on, at once", () => {
    const t = table({ seats: 2, staging: [GUARD, MUGASH] });
    const mugash = idOf(t.state, MUGASH);
    const hero = t.state.seats[1]?.heroes[0] ?? "";
    const lying = updateCard(attachTo(moveCard(t.state, mugash, { zone: "attached" }), mugash, hero), mugash, { asAttachment: true });
    const flagged: ScenarioState = { ...lying, modifiers: [...lying.modifiers, { instanceId: idOf(lying, GUARD), sourceId: idOf(lying, GUARD), stat: "engagesCaptiveHolder", amount: 1, until: "endOfGame" }] };
    const settled = settle(flagged, t.ctx, []);
    const guard = settled.cards[idOf(settled, GUARD)];
    expect(guard?.zone).toBe("engaged");
    expect(guard?.controller).toBe(1);
  });
});
