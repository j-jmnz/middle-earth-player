import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { fireForced } from "../../windows/triggers.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { codesIn, idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { attachedCost, namelessCards } from "./attach.ts";

// Rules: rr.attachment-cards, rr.hit-points, rr.reveal, rr.travel, rr.forced, rr.first-player, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger lines 04125:A:1, 04125:A:2, 04126:A:1, 04126:A:2, 04123:A:2, 901704:A:1, 901704:A:2, 901705:A:1, 901705:A:2, 901706:A:1, 901706:A:2, 901708:A:2.
// The nameless family on tables of the scenario's own cards: player cards attached from a deck, the printed cost they add up to, the enemy that is discarded at 0, and Nest of Horrors' travel.
const table = (layout: Parameters<typeof tableFromLayout>[1] = {}) => tableFromLayout("foundations-of-stone", layout);
const focus = (seat: number, sourceId: string | null = null) => ({ seat, sourceId });
const synced = (state: ScenarioState, ctx: Parameters<typeof syncConstants>[1]) => syncConstants({ ...state, window: null, mode: "stopped" }, ctx);
const attach = (instruction: Instruction): Instruction => instruction;

describe("AttachDeckTop (04125:A:1, 04126:A:1)", () => {
  it("04125:A:1 attaches the top 2 cards of the engaged player's deck faceup, owned by that seat, as attachments with no title and no text", () => {
    const t = table({ engaged: ["04125"], deckOf: ["c3", "c2", "c1"] });
    const thing = idOf(t.state, "04125");
    const run = runInstruction({ ...t.state, window: null }, attach({ verb: "AttachDeckTop", count: 2 }), focus(0, thing), t.ctx, []);
    const held = namelessCards(run, thing);
    expect(held.map((id) => run.cards[id]?.code)).toEqual(["c3", "c2"]);
    expect(run.cards[held[0] ?? ""]).toMatchObject({ zone: "attached", host: thing, face: "up", controller: null, owner: 0, nameless: true });
    expect(run.seats[0].deck.map((id) => run.cards[id]?.code)).toEqual(["c1"]);
    expect(run.pendingEvents).toEqual([{ trigger: "attachedFromDeck", seat: 0, subject: thing }]);
  });

  it("04125:A:1 attaches fewer cards from a shorter deck, and none from an empty one (no event)", () => {
    const t = table({ engaged: ["04125"], deckOf: ["c3"] });
    const thing = idOf(t.state, "04125");
    const one = runInstruction({ ...t.state, window: null }, attach({ verb: "AttachDeckTop", count: 2 }), focus(0, thing), t.ctx, []);
    expect(namelessCards(one, thing)).toHaveLength(1);
    const none = runInstruction({ ...t.state, window: null, seats: [{ ...t.state.seats[0], deck: [] }, t.state.seats[1]] as ScenarioState["seats"] }, attach({ verb: "AttachDeckTop", count: 2 }), focus(0, thing), t.ctx, []);
    expect(namelessCards(none, thing)).toHaveLength(0);
    expect(none.pendingEvents ?? []).toEqual([]);
  });

  it("04126:A:1 attaches the top 3 cards", () => {
    const t = table({ engaged: ["04126"], deckOf: ["c1", "c1", "c2", "c3"] });
    const elder = idOf(t.state, "04126");
    const run = runInstruction({ ...t.state, window: null }, attach({ verb: "AttachDeckTop", count: 3 }), focus(0, elder), t.ctx, []);
    expect(namelessCards(run, elder)).toHaveLength(3);
    expect(run.seats[0].deck).toHaveLength(1);
  });

  it("901705:A:1 attaches the first player's cards one after another until the attached cards cost 6 or more, or the deck is empty", () => {
    const t = table({ staging: ["901705"], deckOf: ["c3", "c2", "c1", "c3"] });
    const thing = idOf(t.state, "901705");
    const run = runInstruction({ ...t.state, window: null }, attach({ verb: "AttachDeckTop", deck: "firstPlayer", untilCost: 6 }), focus(0, thing), t.ctx, []);
    expect(namelessCards(run, thing).map((id) => run.cards[id]?.code)).toEqual(["c3", "c2", "c1"]);
    expect(attachedCost(run, thing, t.ctx.cards)).toBe(6);
    const short = table({ staging: ["901705"], deckOf: ["c2"] });
    const poor = runInstruction({ ...short.state, window: null }, attach({ verb: "AttachDeckTop", deck: "firstPlayer", untilCost: 6 }), focus(0, idOf(short.state, "901705")), short.ctx, []);
    expect(namelessCards(poor, idOf(short.state, "901705"))).toHaveLength(1);
  });

  it("04125:A:1 hears the engagement: the enemy attaches 2 cards when it engages the player", () => {
    const t = table({ engaged: ["04125"], deckOf: ["c3", "c2", "c1"] });
    const thing = idOf(t.state, "04125");
    const heard = fireForced({ ...t.state, window: null }, { trigger: "engaged", seat: 0, cardId: thing }, t.ctx, []);
    const run = settle({ ...heard, mode: "stopped" }, t.ctx, []);
    expect(namelessCards(run, thing)).toHaveLength(2);
  });
});

describe("The printed cost of the attached cards (04125:A:2, 901704:A:2)", () => {
  it("04125:A:2 makes X its Attack and hit points: 3 with nothing attached, the attached cards' printed cost otherwise", () => {
    const t = table({ engaged: ["04125"], deckOf: ["c3", "c2"] });
    const thing = idOf(t.state, "04125");
    const bare = synced(t.state, t.ctx);
    expect(modifiedStat(bare, bare.cards[thing]!, "attack", t.ctx.cards)).toBe(3);
    expect(modifiedStat(bare, bare.cards[thing]!, "hitPoints", t.ctx.cards)).toBe(3);
    const run = synced(runInstruction({ ...t.state, window: null }, attach({ verb: "AttachDeckTop", count: 2 }), focus(0, thing), t.ctx, []), t.ctx);
    expect(modifiedStat(run, run.cards[thing]!, "attack", t.ctx.cards)).toBe(5);
    expect(modifiedStat(run, run.cards[thing]!, "hitPoints", t.ctx.cards)).toBe(5);
  });

  it("04125:A:2 counts a hero or a card with no printed cost as 0", () => {
    const t = table({ engaged: ["04125"], deckOf: ["dh1", "c2"] });
    const thing = idOf(t.state, "04125");
    expect(printedOf(t.ctx.cards, "dh1").cost).toBeNull();
    const run = synced(runInstruction({ ...t.state, window: null }, attach({ verb: "AttachDeckTop", count: 2 }), focus(0, thing), t.ctx, []), t.ctx);
    expect(attachedCost(run, thing, t.ctx.cards)).toBe(2);
    expect(modifiedStat(run, run.cards[thing]!, "hitPoints", t.ctx.cards)).toBe(2);
  });

  it("901704:A:2 makes X 5 with nothing attached, and Elder Nameless Thing's 04126:A:2 X 4", () => {
    const t = table({ engaged: ["901704", "04126"] });
    const state = synced(t.state, t.ctx);
    expect(modifiedStat(state, state.cards[idOf(state, "901704")]!, "attack", t.ctx.cards)).toBe(5);
    expect(modifiedStat(state, state.cards[idOf(state, "04126")]!, "hitPoints", t.ctx.cards)).toBe(4);
  });

  it("04125:A:2 discards the enemy at once when the attached cards cost 0 in all (not destroyed: it takes no Victory), and their owner's discard pile gets the cards", () => {
    const t = table({ engaged: ["04125"], deckOf: ["c0", "c0"] });
    const thing = idOf(t.state, "04125");
    const attached = runInstruction({ ...t.state, window: null }, attach({ verb: "AttachDeckTop", count: 2 }), focus(0, thing), t.ctx, []);
    const run = settle({ ...attached, mode: "stopped" }, t.ctx, []);
    expect(run.cards[thing]?.zone).toBe("encounterDiscard");
    expect(run.seats[0].discard.map((id) => run.cards[id]?.code)).toEqual(["c0", "c0"]);
    expect(run.cards[run.seats[0].discard[0] ?? ""]?.nameless).toBeUndefined();
  });

  it("04125:A:2 is destroyed by the damage that reaches X, goes to the victory display (Victory 1) and the attached cards go to their owners' discard piles", () => {
    const t = table({ engaged: [{ code: "04125", damage: 4 }], deckOf: ["c2", "c3"] });
    const thing = idOf(t.state, "04125");
    const attached = synced(runInstruction({ ...t.state, window: null }, attach({ verb: "AttachDeckTop", count: 2 }), focus(0, thing), t.ctx, []), t.ctx);
    expect(attached.cards[thing]?.zone).toBe("engaged");
    const hurt = settle({ ...attached, cards: { ...attached.cards, [thing]: { ...attached.cards[thing]!, damage: 5 } }, mode: "stopped" }, t.ctx, []);
    expect(hurt.cards[thing]?.zone).toBe("victory");
    expect(codesIn(hurt, "discard")).toEqual(["c2", "c3"]);
  });
});

describe("Nest of Horrors (901706:A:1, 901706:A:2)", () => {
  it("901706:A:1 attaches one additional card from the same deck for each event, which is not a new event", () => {
    const t = table({ engaged: ["901704"], staging: ["901706"], deckOf: ["c1", "c1", "c1", "c1"] });
    const thing = idOf(t.state, "901704");
    const attached = runInstruction({ ...t.state, window: null }, attach({ verb: "AttachDeckTop" }), focus(0, thing), t.ctx, []);
    const run = settle({ ...attached, mode: "stopped" }, t.ctx, []);
    expect(namelessCards(run, thing)).toHaveLength(2);
    expect(run.seats[0].deck).toHaveLength(2);
  });

  it("901706:A:1 is heard once by each Nest in the staging area, and by none outside it", () => {
    const two = table({ engaged: ["901704"], staging: ["901706", "901706"], deckOf: ["c1", "c1", "c1", "c1", "c1"] });
    const thing = idOf(two.state, "901704");
    const attached = runInstruction({ ...two.state, window: null }, attach({ verb: "AttachDeckTop" }), focus(0, thing), two.ctx, []);
    expect(namelessCards(settle({ ...attached, mode: "stopped" }, two.ctx, []), thing)).toHaveLength(3);
    const away = table({ engaged: ["901704"], active: "901706", deckOf: ["c1", "c1", "c1"] });
    const lone = runInstruction({ ...away.state, window: null }, attach({ verb: "AttachDeckTop" }), focus(0, idOf(away.state, "901704")), away.ctx, []);
    expect(namelessCards(settle({ ...lone, mode: "stopped" }, away.ctx, []), idOf(away.state, "901704"))).toHaveLength(1);
  });

  it("901706:A:2 discards the top card of the encounter deck for each player and reveals each Nameless enemy discarded", () => {
    const t = table({ seats: 2, staging: ["901706"], deck: ["04125", "f3", "04126"] });
    const nest = idOf(t.state, "901706");
    const run = resolveRecords(t.state, t.ctx, "901706", "travel", nest);
    // Two players discard two cards: the Nameless Thing is revealed and enters the staging area; the other card stays discarded.
    expect(run.state.cards[idOf(run.state, "04125")]?.zone).toBe("staging");
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f3"]);
    expect(run.state.encounterDeck.map((id) => run.state.cards[id]?.code)).toEqual(["04126"]);
  });

  it("901706:A:2 reveals nothing when no Nameless enemy was discarded, and discards fewer cards from a short deck", () => {
    const t = table({ staging: ["901706"], deck: ["f3"] });
    const run = resolveRecords(t.state, t.ctx, "901706", "travel", idOf(t.state, "901706"));
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f3"]);
    expect(codesIn(run.state, "staging")).toEqual(["901706"]);
  });
});

describe("Deep Deep Dark and Chill of the Roots (04123:A:2, 901708:A:2)", () => {
  it("04123:A:2 attaches the top card of the first player's deck to each Nameless enemy in play, staging and engaged, one after another", () => {
    const t = table({ staging: ["04125"], engaged: ["04126"], deckOf: ["c1", "c2", "c3"] });
    const run = resolveRecords(t.state, t.ctx, "04123", "whenRevealed");
    expect(namelessCards(run.state, idOf(run.state, "04125"))).toHaveLength(1);
    expect(namelessCards(run.state, idOf(run.state, "04126"))).toHaveLength(1);
    expect(run.state.seats[0].deck).toHaveLength(1);
  });

  it("04123:A:2 attaches nothing when there is no Nameless enemy in play", () => {
    const t = table({ staging: ["f3"], deckOf: ["c1"] });
    const run = resolveRecords(t.state, t.ctx, "04123", "whenRevealed");
    expect(run.state.seats[0].deck).toHaveLength(1);
  });
});
