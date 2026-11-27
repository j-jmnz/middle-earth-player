// Rules: rr.response, rr.action, rr.cost, rr.drawing-cards, rr.threat-threat-dial, rr.play-restrictions-and-permissions, rr.triggered-ability,
// rr.discard-pile-and-victory-display, rr.encounter-deck, rr.ownership-and-control, rr.staging, rr.step-3-3 (data/rules/entries.json).
// The Wrath and Ruin heroes, events and ally, each line tested from the words on the card: Thorin Stonehelm 22001:A:1, Pillars of the Kings
// 22003:A:1 and A:2, Tom Bombadillo! 22005:A:1, Charge into Battle 22007:A:1, Tom Bombadil 22010:A:1. The attachments are in
// wrath-and-ruin-attachments.test.ts. The lines are the text of data/cards/WaR.json (data/printed holds the pack's ledger), so every line is checked against it.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withThreat } from "../../rules/core/state.ts";
import { setAsideEncounterCards } from "../../rules/families/sidequests/encounter.ts";
import { playCost } from "../../rules/player/attach.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, send, type Run, type Table } from "../../../test/harness/scene.ts";
import { attacking, canPlay, choices, fillers, playCode, playerTableFor, triggers } from "../../../test/harness/player-table.ts";

const THORIN = "22001";
const PILLARS = "22003";
const BOMBADILLO = "22005";
const CHARGE = "22007";
const TOM = "22010";
// Core: Legolas (Tactics), Beravor (Lore), Denethor (Lore).
const LEGOLAS = "01005";
const BERAVOR = "01012";
const DENETHOR = "01010";
// The Pal: a Leadership Hobbit hero.
const PAL = "pal";
// An enemy (not unique) that no attack of these tests destroys.
const WALL = "wall";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([THORIN, PILLARS, BOMBADILLO, CHARGE, TOM, LEGOLAS, BERAVOR, DENETHOR]))]);
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 20 }));
  base = { ...starter, cards };
});

// Whether the engine offers to play the card `cardId` from hand.

describe("Thorin Stonehelm (22001:A:1)", () => {
  // Two seats: two Walls are engaged with the player, the Dear with the other player. Thorin's deck holds `deck` cards.
  const scene = (effects: readonly Effect[], deck: number) =>
    table(effects, { seats: 2, heroes: [{ code: THORIN, seat: 0 }, { code: PAL, seat: 1 }], engaged: [{ code: WALL, seat: 0 }, { code: WALL, seat: 0 }, { code: "dear", seat: 1 }], playerDeck: fillers("card", deck) });
  const declared = (tab: Table): Run => send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: tab.ids[WALL]?.[0] ?? "", attackerIds: [idsOf(tab, THORIN)] }, tab.ctx);

  // "Response: After Thorin Stonehelm is declared as an attacker, discard the top card of your deck to deal 1 damage to an enemy engaged
  // with you.": the top card of the deck goes to the discard pile; both Walls engaged with the player may be chosen, the Dear (engaged with
  // the other player) may not; the second Wall takes 1 damage.
  lineSpec("22001:A:1", "Thorin Stonehelm: declared as an attacker, discard the top card of the deck for 1 damage to an enemy engaged with you", (effects) => {
    const tab = scene(effects, 3);
    const [first = "", second = ""] = tab.ids[WALL] ?? [];
    const top = tab.state.seats[0]?.deck[0] ?? "";
    let run = declared(tab);
    expect(triggers(run.state, tab)).toContain("22001:response:1");
    run = send(run, { type: "Trigger", cardId: idsOf(tab, THORIN), effectId: "22001:response:1" }, tab.ctx);
    expect(run.state.cards[top]?.zone).toBe("discard");
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    expect(choices(run.state, tab).sort()).toEqual([first, second].sort());
    run = send(run, { type: "Choose", optionId: second }, tab.ctx);
    expect(run.state.cards[second]?.damage).toBe(1);
    expect(run.state.cards[idsOf(tab, "dear")]?.damage).toBe(0);
  });

  // An empty deck: the cost cannot be paid, so the Response is not offered.
  it("22001:A:1 Thorin Stonehelm: not offered with an empty deck", () => {
    const tab = scene(EFFECTS, 0);
    expect(triggers(declared(tab).state, tab)).not.toContain("22001:response:1");
  });
});

describe("Pillars of the Kings (22003:A:1, A:2)", () => {
  // Two seats; the first player's threat is `threat` and his deck holds 6 cards; Pillars of the Kings is in hand.
  function pillars(effects: readonly Effect[], threat: number): Table {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: BERAVOR, seat: 1 }], hand: [{ code: PILLARS, seat: 0 }], playerDeck: fillers("card", 6) });
    return { ...tab, state: withThreat(tab.state, 0, threat) };
  }

  // "While your threat is less than 40, reduce the cost to play Pillars of the Kings by 4.": at threat 39 it costs 0 and is played with no
  // payment; at threat 40 it costs its printed 4.
  lineSpec("22003:A:1", "Pillars of the Kings: costs 4 less while your threat is less than 40", (effects) => {
    const low = pillars(effects, 39);
    const card = idsOf(low, PILLARS);
    expect(playCost(low.state, card, 0, low.ctx)).toBe(0);
    const run = send(begin(low.state), { type: "PlayCard", cardId: card, payments: [] }, low.ctx);
    expect(run.state.cards[card]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(low, PAL)]?.resources).toBe(6);
    const high = pillars(effects, 40);
    expect(playCost(high.state, idsOf(high, PILLARS), 0, high.ctx)).toBe(4);
  });

  // "Action: Set your threat to 40. If this effect raised your threat, draw a card (draw 4 cards instead if it raised your threat by 10 or
  // more).": from 8 the threat is raised by 32, so 4 cards are drawn; the other player's threat stays 6.
  lineSpec("22003:A:2", "Pillars of the Kings: the threat becomes 40, and 4 cards are drawn when it rose by 10 or more", (effects) => {
    const tab = pillars(effects, 8);
    const hand = tab.state.seats[0]?.hand.length ?? 0;
    const run = playCode(tab, PILLARS);
    expect(run.state.seats[0]?.threat).toBe(40);
    expect(run.state.seats[1]?.threat).toBe(6);
    expect(run.state.seats[0]?.hand).toHaveLength(hand - 1 + 4);
  });

  // The edges of "by 10 or more": from 30 (raised by 10) 4 cards, from 31 (by 9) 1 card, from 39 (by 1) 1 card.
  it("22003:A:2 Pillars of the Kings: 4 cards from 30, 1 card from 31 and from 39", () => {
    for (const [threat, drawn] of [[30, 4], [31, 1], [39, 1]] as const) {
      const tab = pillars(EFFECTS, threat);
      const hand = tab.state.seats[0]?.hand.length ?? 0;
      const run = playCode(tab, PILLARS);
      expect([threat, run.state.seats[0]?.threat, run.state.seats[0]?.hand.length]).toEqual([threat, 40, hand - 1 + drawn]);
    }
  });

  // "If this effect raised your threat": from 45 the threat is lowered to 40, and no card is drawn.
  it("22003:A:2 Pillars of the Kings: a threat above 40 is set to 40 with no draw", () => {
    const tab = pillars(EFFECTS, 45);
    const hand = tab.state.seats[0]?.hand.length ?? 0;
    const run = playCode(tab, PILLARS);
    expect(run.state.seats[0]?.threat).toBe(40);
    expect(run.state.seats[0]?.hand).toHaveLength(hand - 1);
  });

  // At threat 40 the effect can change nothing (the threat is already 40 and nothing is drawn), so it is not offered (rr.triggered-ability).
  it("22003:A:2 Pillars of the Kings: not offered at threat 40", () => {
    const tab = pillars(EFFECTS, 40);
    expect(canPlay(tab.state, tab, idsOf(tab, PILLARS))).toBe(false);
  });
});

describe("Tom Bombadillo! (22005:A:1)", () => {
  // A set-aside Tom Bombadil; `heroes` for the first player, Beravor paying (Lore); `victory` in the victory display.
  const scene = (effects: readonly Effect[], heroes: readonly { code: string; seat: number }[], victory: readonly string[] = []) =>
    table(effects, { seats: 2, heroes, hand: [{ code: BOMBADILLO, seat: 0 }], setAside: [TOM], victory });

  // "Play only if you control a Hobbit hero. You cannot play this card if there is a copy of Tom Bombadillo! in the victory display.":
  // with the Pal (a Hobbit hero) it is offered; without a Hobbit hero (the other player's Pal is not yours) it is not; with a copy in the
  // victory display it is not.
  lineSpec("22005:A:1", "Tom Bombadillo!: played only with a Hobbit hero you control and no copy in the victory display", (effects) => {
    const hobbit = scene(effects, [{ code: PAL, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: DENETHOR, seat: 1 }]);
    expect(canPlay(hobbit.state, hobbit, idsOf(hobbit, BOMBADILLO))).toBe(true);
    const none = scene(effects, [{ code: BERAVOR, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }]);
    expect(canPlay(none.state, none, idsOf(none, BOMBADILLO))).toBe(false);
    const shown = scene(effects, [{ code: PAL, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: DENETHOR, seat: 1 }], [BOMBADILLO]);
    const inHand = shown.ids[BOMBADILLO]?.find((id) => shown.state.cards[id]?.zone === "hand") ?? "";
    expect(canPlay(shown.state, shown, inHand)).toBe(false);
  });
});

describe("Charge into Battle (22007:A:1)", () => {
  // Legolas pays (Tactics, 6 resources) and the Pal quests; the Wall (not unique) is in the staging area and the encounter deck holds an
  // enemy of threat 0.
  const scene = (effects: readonly Effect[]) =>
    table(effects, { start: "quest", heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 0 }], hand: [{ code: CHARGE, seat: 0 }], staging: [WALL], deck: ["f0", "f0"] });

  // "Play only after staging step.": in the commit step, before the staging step, it is not offered; once the staging step has resolved,
  // it is.
  lineSpec("22007:A:1", "Charge into Battle: played only after the staging step", (effects) => {
    const tab = scene(effects);
    const charge = idsOf(tab, CHARGE);
    expect(canPlay(tab.state, tab, charge)).toBe(false);
    let run = send(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, PAL)] }, tab.ctx);
    expect(canPlay(run.state, tab, charge)).toBe(false);
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, "f0")]?.zone).toBe("staging");
    expect(canPlay(run.state, tab, charge)).toBe(true);
  });
});

describe("Tom Bombadil (22010:A:1)", () => {
  // "Encounter.": at the Setup Tom Bombadil is set aside from his player's deck, still that player's card; the other card stays.
  lineSpec("22010:A:1", "Tom Bombadil: the Encounter keyword sets him aside from the player's deck", (effects) => {
    const tab = table(effects, { playerDeck: [{ code: TOM, seat: 0 }, { code: "card", seat: 0 }] });
    const state = setAsideEncounterCards(tab.state, 0, tab.ctx);
    expect(state.cards[idsOf(tab, TOM)]).toMatchObject({ zone: "setAside", owner: 0 });
    expect(state.cards[idsOf(tab, "card")]?.zone).toBe("deck");
  });
});
