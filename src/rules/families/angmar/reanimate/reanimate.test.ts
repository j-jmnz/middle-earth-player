// Rules: mec108.reanimated-dead, rr.engaged, rr.destroy (data/rules/entries.json); ledger lines 10150:A:1, 10150:B:1, 101158:A:1, 101159:A:1, 101162:A:2.
// Reanimated Dead on tables of The Dread Realm, built from data/ by the layout kit: a player card turned facedown into an Undead enemy that leaves to its owner's discard pile.
import { describe, expect, it } from "vitest";

import { printedOf } from "../../../core/printed.ts";
import { destroyCard, modifiedStat } from "../../../core/keywords.ts";
import { runInstruction } from "../../../interpret/interpret.ts";
import { hasTrait } from "../../../interpret/conditions.ts";
import type { Instruction } from "../../../../catalog/boundary.ts";
import { tableFromLayout, type Layout } from "../../../../../test/harness/scene-kit.ts";

const built = (layout: Layout = {}) => tableFromLayout("the-dread-realm", { seats: 2, ...layout });
type Table = ReturnType<typeof built>;
// Runs an instruction on the table, or on a state it has already reached.
const run = (t: Table, instruction: Instruction, seat = 0, from: Table["state"] = t.state) => runInstruction(from, instruction, { seat, sourceId: null }, t.ctx, []);

describe("a card reanimated is a facedown Undead enemy (mec108.reanimated-dead)", () => {
  it("10150:A:1 turns the top card of the deck facedown into an enemy engaged with that player, with 0 engagement cost, 2 Threat, 2 Attack, 2 Defense and 2 hit points", () => {
    const t = built({ deckOf: ["filler", "event"] });
    const top = t.state.seats[0].deck[0]!;
    const next = run(t, { verb: "Reanimate", from: "deckTop" });
    const card = next.cards[top]!;
    expect(card.zone).toBe("engaged");
    expect(card.face).toBe("down");
    expect(card.owner).toBe(0);
    expect(next.seats[0].engaged).toEqual([top]);
    expect(next.seats[0].deck).toHaveLength(t.state.seats[0].deck.length - 1);
    const printed = printedOf(t.ctx.cards, card.code);
    expect([printed.type, printed.engagementCost, printed.threat, printed.attack, printed.defense, printed.health]).toEqual(["enemy", 0, 2, 2, 2, 2]);
    expect(hasTrait(next, top, "Undead", t.ctx)).toBe(true);
    expect(modifiedStat(next, card, "attack", t.ctx.cards)).toBe(2);
  });

  it("10150:A:1 reanimates for each player separately and nothing from an empty deck", () => {
    const t = built({ deckOf: [{ code: "filler", seat: 1 }] });
    const next = run(t, { verb: "Reanimate", from: "deckTop" }, 1, run(t, { verb: "Reanimate", from: "deckTop" }, 0));
    expect(next.seats[0].engaged).toHaveLength(0);
    expect(next.seats[1].engaged).toHaveLength(1);
  });

  it("rr.engaged: reanimating counts as engaging, so the player's engaged Responses hear it", () => {
    const t = built({ deckOf: ["filler"] });
    const top = t.state.seats[0].deck[0]!;
    const next = run(t, { verb: "Reanimate", from: "deckTop" });
    expect(next.pendingEvents?.some((event) => event.trigger === "engaged" && event.seat === 0 && event.subject === top)).toBe(true);
  });

  it("mec108.reanimated-dead: destroyed or leaving play for any other reason, it is placed in its owner's discard pile as the card it is", () => {
    const t = built({ deckOf: ["filler"] });
    const top = t.state.seats[0].deck[0]!;
    const next = run(t, { verb: "Reanimate", from: "deckTop" });
    const gone = destroyCard(next, top, t.ctx.cards, []);
    expect(gone.cards[top]).toMatchObject({ code: "filler", zone: "discard", face: "up" });
    expect(gone.seats[0].discard).toContain(top);
    expect(gone.seats[0].engaged).toEqual([]);
    expect(gone.encounterDiscard).not.toContain(top);
  });

  it("10150:B:1 counts a Reanimated Dead in the staging area for the quest, and it can join the staging area instead of engaging (101162:A:2)", () => {
    const t = built({ deckOf: ["filler"] });
    const top = t.state.seats[0].deck[0]!;
    const home = run(t, { verb: "Reanimate", from: "deckTop", to: "staging" });
    expect(home.cards[top]?.zone).toBe("staging");
    expect(home.staging).toContain(top);
    expect(home.seats[0].engaged).toEqual([]);
  });

  it("101158:A:1 chooses a card of the hand by the game's seed, and an empty hand reanimates nothing", () => {
    const t = built({ hand: ["filler"] });
    const next = run(t, { verb: "Reanimate", from: "handRandom" });
    expect(next.seats[0].engaged).toHaveLength(1);
    expect(next.seats[0].hand).toHaveLength(t.state.seats[0].hand.length - 1);
    const empty = built({});
    const none = run(empty, { verb: "Reanimate", from: "handRandom" }, 0, { ...empty.state, seats: [{ ...empty.state.seats[0], hand: [] }, empty.state.seats[1]] });
    expect(none.seats[0].engaged).toEqual([]);
  });
});
