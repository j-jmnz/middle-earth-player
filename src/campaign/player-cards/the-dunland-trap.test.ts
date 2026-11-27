// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.lasting-effects, rr.response, rr.action, rr.enters-play, rr.search,
// rr.deckbuilding, rr.the-letter-x, rr.step-3-2, rr.limits (data/rules/entries.json).
// The Dunland Trap player cards, written from their card text (data/cards/TDT.json; the ledger lines in data/printed are read from the scans): Celeborn 08001:A:1, Naith Guide 08002:A:1, Firefoot 08004:A:1 and A:2, The Fall of Gil-Galad
// 08007:A:1, The Tree People 08009:A:1, The White Council 08010:A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckSaveRefusal } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { type Table, begin, idsOf, send } from "../../../test/harness/scene.ts";
import { attach, choices, deckSaveFacts, discarded, endRound, fillers, hosts, packRow, play, playerTableFor, printed, questing, stat, triggers } from "../../../test/harness/player-table.ts";

const CELEBORN = "08001";
const NAITH = "08002";
const FIREFOOT = "08004";
const GIL_GALAD = "08007";
const TREE_PEOPLE = "08009";
const COUNCIL = "08010";
// Éomer (Tactics, Rohan). Core heroes: Théodred (Leadership, Rohan), Legolas (Tactics), Éowyn (Spirit, Rohan), Denethor (Lore, Gondor).
const EOMER = "07001";
const THEODRED = "01002";
const LEGOLAS = "01005";
const EOWYN = "01007";
const DENETHOR = "01010";
// Allies: Snowbourn Scout (Rohan), Guard of the Citadel, Wandering Took; the Silvan Lórien Guide, Silverlode Archer, Daughter of the
// Nimrodel and Henamarth Riversong.
const SNOWBOURN = "01016";
const GUARD = "01013";
const TOOK = "01043";
const GUIDE = "01044";
const ARCHER = "01017";
const DAUGHTER = "01058";
const HENAMARTH = "01060";
const PAL = "pal";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [CELEBORN, NAITH, FIREFOOT, GIL_GALAD, TREE_PEOPLE, COUNCIL, EOMER, THEODRED, LEGOLAS, EOWYN, DENETHOR, SNOWBOURN, GUARD, TOOK, GUIDE, ARCHER, DAUGHTER, HENAMARTH];
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted(codes))]) };
});

describe("Celeborn (08001:A:1)", () => {
  // Celeborn and Éowyn (who pays for the Spirit allies); the Lórien Guide (Silvan) and the Wandering Took in hand.
  const scene = (effects: readonly Effect[]) => table(effects, { heroes: [{ code: CELEBORN, seat: 0 }, { code: EOWYN, seat: 0 }], hand: [{ code: GUIDE, seat: 0 }, { code: TOOK, seat: 0 }] });

  // "Response: After a Silvan ally enters play, that ally gets +1 Willpower +1 Attack and +1 Defense until the end of the round.": the
  // Guide has +1 to each until the round ends.
  lineSpec("08001:A:1", "Celeborn: a Silvan ally that enters play gets +1 Willpower, Attack and Defense until the end of the round", (effects) => {
    const tab = scene(effects);
    const guide = idsOf(tab, GUIDE);
    let run = play(begin(tab.state), tab, guide);
    expect(triggers(run.state, tab)).toContain("08001:response:1");
    run = send(run, { type: "Trigger", cardId: idsOf(tab, CELEBORN), effectId: "08001:response:1" }, tab.ctx);
    for (const which of ["willpower", "attack", "defense"] as const) expect(stat(run.state, tab, guide, which)).toBe(printed(tab, GUIDE, which) + 1);
    const ended = endRound(run.state, tab).state;
    for (const which of ["willpower", "attack", "defense"] as const) expect(stat(ended, tab, guide, which)).toBe(printed(tab, GUIDE, which));
  });

  // The Wandering Took is not Silvan: no Response.
  it("08001:A:1 Celeborn: no Response for an ally that is not Silvan", () => {
    const tab = scene(EFFECTS);
    expect(triggers(play(begin(tab.state), tab, idsOf(tab, TOOK)).state, tab)).not.toContain("08001:response:1");
  });
});

describe("Naith Guide (08002:A:1)", () => {
  // "Response: After Naith Guide enters play, choose a hero. That hero does not exhaust to quest this round.": the choices are the three
  // heroes of both players; Denethor, chosen, commits and stays ready while Celeborn exhausts.
  lineSpec("08002:A:1", "Naith Guide: the chosen hero does not exhaust to quest this round", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: CELEBORN, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: NAITH, seat: 0 }], deck: ["f0", "f0"] });
    const [celeborn, denethor] = [idsOf(tab, CELEBORN), idsOf(tab, DENETHOR)];
    let run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, NAITH), payments: [{ heroId: celeborn, amount: 2 }] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("08002:response:1");
    run = send(run, { type: "Trigger", cardId: idsOf(tab, NAITH), effectId: "08002:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([celeborn, denethor, idsOf(tab, PAL)].sort());
    run = send(run, { type: "Choose", optionId: denethor }, tab.ctx);
    const quest = send(begin(questing(run.state)), { type: "Commit", cardIds: [celeborn, denethor] }, tab.ctx);
    expect(quest.state.cards[denethor]).toMatchObject({ committed: true, exhausted: false });
    expect(quest.state.cards[celeborn]).toMatchObject({ committed: true, exhausted: true });
  });
});

describe("Firefoot (08004:A:1, A:2)", () => {
  // "Attach to a Tactics or Rohan hero. Restricted.": Legolas (Tactics, not Rohan), Théodred and Éowyn (Rohan, not Tactics) and Éomer
  // (both); not Denethor nor the Snowbourn Scout (a Rohan ally).
  lineSpec("08004:A:1", "Firefoot: Attach to a Tactics or Rohan hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: THEODRED, seat: 0 }, { code: EOWYN, seat: 0 }, { code: EOMER, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: SNOWBOURN, seat: 0 }], hand: [{ code: FIREFOOT, seat: 0 }] });
    const firefoot = idsOf(tab, FIREFOOT);
    expect(hosts(tab, firefoot)).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, THEODRED), idsOf(tab, EOWYN), idsOf(tab, EOMER)].sort());
    expect(play(begin(tab.state), tab, firefoot, idsOf(tab, THEODRED)).state.cards[firefoot]?.host).toBe(idsOf(tab, THEODRED));
  });

  // "Attached hero gets +1 Attack (+2 Attack instead if attached hero is Éomer).": played on Éomer, 3 + 2; on Legolas, 3 + 1.
  lineSpec("08004:A:2", "Firefoot: +1 Attack, +2 on Éomer", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOMER, seat: 0 }, { code: LEGOLAS, seat: 0 }], hand: [{ code: FIREFOOT, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, FIREFOOT), idsOf(tab, EOMER));
    expect(stat(run.state, tab, idsOf(tab, EOMER), "attack")).toBe(printed(tab, EOMER, "attack") + 2);
    expect(stat(run.state, tab, idsOf(tab, LEGOLAS), "attack")).toBe(printed(tab, LEGOLAS, "attack"));
    const other = table(effects, { heroes: [{ code: EOMER, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: FIREFOOT, seat: 0 }] });
    const legolas = attach(other, [[idsOf(other, FIREFOOT), idsOf(other, LEGOLAS)]]);
    expect(stat(legolas.state, legolas, idsOf(legolas, LEGOLAS), "attack")).toBe(printed(legolas, LEGOLAS, "attack") + 1);
  });
});

describe("The Fall of Gil-Galad (08007:A:1)", () => {
  // "Limit 1 per deck.": a deck holds 1 copy, not 2.
  it("08007:A:1 The Fall of Gil-Galad: a deck holds at most 1 copy", () => {
    const row = packRow("TDT", GIL_GALAD);
    expect(row?.deckLimit).toBe(1);
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    expect(deckSaveRefusal(["h1"], [...events, { code: GIL_GALAD, count: 1 }], deckSaveFacts(row))).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: GIL_GALAD, count: 2 }], deckSaveFacts(row))).toMatchObject({ cardCode: GIL_GALAD });
  });

  // "Attach to a hero.": Éowyn and the other player's hero; not an ally.
  lineSpec("08007:A:1", "The Fall of Gil-Galad: Attach to a hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: TOOK, seat: 0 }], hand: [{ code: GIL_GALAD, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, GIL_GALAD))).toEqual([idsOf(tab, EOWYN), idsOf(tab, PAL)].sort());
  });
});

describe("The Tree People (08009:A:1)", () => {
  // Denethor pays; the Lórien Guide (Silvan) and the Guard of the Citadel in play; the top 5 of the deck hold the Silverlode Archer and
  // the Daughter of the Nimrodel (Silvan allies), the sixth Henamarth Riversong (Silvan, below the top 5).
  function scene(effects: readonly Effect[], copies = 1): Table {
    const deck = [TOOK, ARCHER, CARD, DAUGHTER, SNOWBOURN, HENAMARTH].map((code) => ({ code, seat: 0 }));
    return table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: GUIDE, seat: 0 }, { code: GUARD, seat: 0 }], hand: fillers(TREE_PEOPLE, copies), playerDeck: deck });
  }

  // "Action: Return a Silvan ally you control to your hand to search the top 5 cards of your deck for a Silvan ally. Put that ally into
  // play and shuffle the other cards back into your deck.": the Guide goes back to the hand; the Archer and the Daughter are the choices,
  // not Henamarth; the Archer comes into play and the deck of the other 5 is shuffled.
  lineSpec("08009:A:1", "The Tree People: a Silvan ally back to hand puts a Silvan ally of the top 5 into play", (effects) => {
    const tab = scene(effects);
    const [guide, archer, daughter] = [idsOf(tab, GUIDE), idsOf(tab, ARCHER), idsOf(tab, DAUGHTER)];
    let run = play(begin(tab.state), tab, tab.ids[TREE_PEOPLE]?.[0] ?? "");
    expect(run.state.cards[guide]?.zone).toBe("hand");
    expect(choices(run.state, tab).sort()).toEqual([archer, daughter].sort());
    const cursor = run.state.seedCursor;
    run = send(run, { type: "Choose", optionId: archer }, tab.ctx);
    expect(run.state.cards[archer]?.zone).toBe("play");
    expect(run.state.seats[0]?.deck).toHaveLength(5);
    expect(run.state.cards[idsOf(tab, HENAMARTH)]?.zone).toBe("deck");
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });

  // "You can only play 1 copy of The Tree People each phase.": a second copy is not played in the same phase, with a Silvan ally still in play.
  it("08009:A:1 The Tree People: one copy each phase", () => {
    const tab = scene(EFFECTS, 2);
    const [first = "", second = ""] = tab.ids[TREE_PEOPLE] ?? [];
    const run = send(play(begin(tab.state), tab, first), { type: "Choose", optionId: idsOf(tab, ARCHER) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ARCHER)]?.zone).toBe("play");
    expect(legalIntents(run.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === second)).toBe(false);
  });

  // With no Silvan ally in play (the Guard is not Silvan), it is not played.
  it("08009:A:1 The Tree People: not played without a Silvan ally you control", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: TREE_PEOPLE, seat: 0 }], playerDeck: [{ code: ARCHER, seat: 0 }] });
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, TREE_PEOPLE))).toBe(false);
  });
});

describe("The White Council (08010:A:2)", () => {
  // "Action: Starting with the first player, each player chooses 1 different option: ready a hero he controls, add 1 resource to the
  // resource pool of a hero he controls, draw 1 card, or shuffle 1 card from his discard pile into his deck.": in a two-player game (X
  // = 2), the first player draws; the second player cannot draw too, and adds 1 resource to his own hero.
  lineSpec("08010:A:2", "The White Council: each player chooses a different option, the first player first", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: COUNCIL, seat: 0 }], playerDeck: [...fillers(CARD, 3), ...fillers(CARD, 3, 1)] });
    const { tab: listed } = discarded(scene, [[TOOK, 0], [TOOK, 1]]);
    const tab = { ...listed, state: updateCard(listed.state, idsOf(listed, PAL), { exhausted: true }) };
    const [eowyn, pal] = [idsOf(tab, EOWYN), idsOf(tab, PAL)];
    const hands = tab.state.seats.map((seat) => seat.hand.length);
    let run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, COUNCIL), payments: [{ heroId: eowyn, amount: 2 }] }, tab.ctx);
    expect(run.state.cards[eowyn]?.resources).toBe(6 - 2);
    expect(choices(run.state, tab)).toContain("draw");
    run = send(run, { type: "Choose", optionId: "draw" }, tab.ctx);
    expect(choices(run.state, tab)).not.toContain("draw");
    expect(choices(run.state, tab)).toContain("resource");
    run = send(run, { type: "Choose", optionId: "resource" }, tab.ctx);
    expect(run.state.cards[pal]?.resources).toBe(6 + 1);
    expect(run.state.seats[1]?.hand.length).toBe(hands[1]);
    // The first player's hand: the event left it, the drawn card came in.
    expect(run.state.cards[idsOf(tab, COUNCIL)]?.zone).toBe("discard");
    expect(run.state.seats[0]?.hand.length).toBe((hands[0] ?? 0) - 1 + 1);
  });
});
