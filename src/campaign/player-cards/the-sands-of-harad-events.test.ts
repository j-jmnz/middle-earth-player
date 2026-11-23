// Rules: rr.action, rr.response, rr.cost, rr.unique-cards, rr.play-restrictions-and-permissions, rr.engaged, rr.triggered-ability
// (data/rules/entries.json).
// The Sands of Harad events, written from their card text (data/cards/TSoH.json; data/printed holds no ledger for this box, so every intent
// goes through sendUnledgered): Unlikely Friendship 16007:A:1 and A:2, Well Warned 16008:A:1 and A:2. The heroes, allies and side quest
// are in the-sands-of-harad.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withThreat } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { choices, fillers, playCode, playerTableFor, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const GIMLI = "16001";
const LEGOLAS = "16002";
const FRIENDSHIP = "16007";
const WARNED = "16008";
// Core: Legolas (a unique Silvan hero), Thalin (neither Noble nor Scout), Éowyn (a unique Noble), Silverlode Archer (a non-unique Silvan
// ally).
const CORE_LEGOLAS = "01005";
const THALIN = "01006";
const EOWYN = "01007";
const SILVERLODE = "01017";
// An enemy of printed threat 3.
const WEAK = "weak";
const PAL = "pal";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([GIMLI, LEGOLAS, FRIENDSHIP, WARNED, CORE_LEGOLAS, THALIN, EOWYN, SILVERLODE]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 3, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

// Whether the engine offers to play the card `cardId` from the hand.
const playable = (tab: Table, cardId: string): boolean => legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === cardId);

describe("Unlikely Friendship (16007:A:1, A:2)", () => {
  // Gimli (Leadership, a unique Dwarf) pays; `others` are the other heroes and `allies` the allies of the first seat; the second seat
  // controls core Legolas when `theirs`.
  const friendship = (effects: readonly Effect[], others: readonly string[], allies: readonly string[] = [], theirs = false): Table =>
    table(effects, {
      seats: theirs ? 2 : 1,
      heroes: [{ code: GIMLI, seat: 0 }, ...others.map((code) => ({ code, seat: 0 })), ...(theirs ? [{ code: CORE_LEGOLAS, seat: 1 }] : [])],
      allies: allies.map((code) => ({ code, seat: 0 })),
      hand: [{ code: FRIENDSHIP, seat: 0 }],
      playerDeck: fillers(CARD, 2),
    });

  // "Play only if you control a unique character with the Silvan trait and another unique character with the Dwarf trait.": with a
  // non-unique Silvan ally it cannot be played; with Legolas (a unique Silvan hero) it can.
  lineSpec("16007:A:1", "Unlikely Friendship: played only with a unique Silvan and another unique Dwarf character", (effects) => {
    const ally = friendship(effects, [], [SILVERLODE]);
    expect(playable(ally, idsOf(ally, FRIENDSHIP))).toBe(false);
    const hero = friendship(effects, [CORE_LEGOLAS]);
    expect(playable(hero, idsOf(hero, FRIENDSHIP))).toBe(true);
  });

  // "you control": the other player's Legolas does not count.
  it("16007:A:1 Unlikely Friendship: another player's unique Silvan character does not count", () => {
    const tab = friendship(EFFECTS, [], [], true);
    expect(playable(tab, idsOf(tab, FRIENDSHIP))).toBe(false);
  });

  // "Action: Draw 1 card and add 1 resource to the resource pool of a hero you control.": one card is drawn; Gimli and Legolas are offered
  // (the other player's Legolas is not), and Legolas gets 1 resource.
  lineSpec("16007:A:2", "Unlikely Friendship: draw 1 card and add 1 resource to a hero you control", (effects) => {
    const tab = friendship(effects, [CORE_LEGOLAS], [], true);
    const [gimli, legolas] = [idsOf(tab, GIMLI), tab.ids[CORE_LEGOLAS]?.[0] ?? ""];
    const [drawn = ""] = tab.state.seats[0]?.deck ?? [];
    let run = playCode(tab, FRIENDSHIP);
    expect(choices(run.state, tab).sort()).toEqual([gimli, legolas].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: legolas }, tab.ctx);
    expect(run.state.seats[0]?.hand).toEqual([drawn]);
    expect(run.state.seats[0]?.deck).toHaveLength(1);
    expect(run.state.cards[legolas]?.resources).toBe(6 + 1);
    expect(run.state.cards[gimli]?.resources).toBe(6);
  });
});

describe("Well Warned (16008:A:1, A:2)", () => {
  // The first seat controls Legolas (Spirit; a unique Noble and Scout) and `other`; the second seat the Pal. The Weak (printed threat 3) is
  // in the staging area; the second seat's threat is 20. The first seat declines to engage and the second engages the Weak.
  function engaged(effects: readonly Effect[], other: string, enemy = WEAK): { tab: Table; run: Run } {
    const scene = table(effects, { seats: 2, start: "encounter", heroes: [{ code: LEGOLAS, seat: 0 }, { code: other, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: WARNED, seat: 0 }], staging: [enemy] });
    const tab = { ...scene, state: withThreat(scene.state, 1, 20) };
    let run = sendUnledgered(begin(tab.state), { type: "DeclineEngage" }, tab.ctx);
    expect(run.state.activeSeat).toBe(1);
    run = sendUnledgered(run, { type: "Engage", enemyId: idsOf(tab, enemy) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, enemy)]?.zone).toBe("engaged");
    return { tab, run };
  }

  // "Play only if you control a unique character with the Noble trait and another unique character with the Scout trait.": Legolas is both,
  // but with Thalin (neither) beside him there is no other unique character, so it cannot be played; with Éowyn (a unique Noble) it can.
  // The Response record holds the same condition, so the line is held without its constant too: a plain test.
  it("16008:A:1 Well Warned: played only with a unique Noble and another unique Scout character", () => {
    const alone = engaged(EFFECTS, THALIN);
    expect(triggers(alone.run.state, alone.tab)).not.toContain("16008:response:1");
    const pair = engaged(EFFECTS, EOWYN);
    expect(triggers(pair.run.state, pair.tab)).toContain("16008:response:1");
  });

  // "Response: After a player engages an enemy, reduce his threat by X, where X is that enemy's printed Threat.": the second player engaged
  // the Weak, so his threat goes from 20 to 17; the first player's stays 8.
  lineSpec("16008:A:2", "Well Warned: after a player engages an enemy, reduce that player's threat by its printed Threat", (effects) => {
    const { tab, run: done } = engaged(effects, EOWYN);
    const run = sendUnledgered(done, { type: "Trigger", cardId: idsOf(tab, WARNED), effectId: "16008:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WARNED)]?.zone).toBe("discard");
    expect(run.state.seats[1]?.threat).toBe(20 - 3);
    expect(run.state.seats[0]?.threat).toBe(8);
  });

  // An enemy of printed threat 0 is engaged: X is 0, so the Response can change nothing and is not offered (rr.triggered-ability).
  it("16008:A:2 Well Warned: not offered after an enemy of printed threat 0 is engaged", () => {
    const { tab, run } = engaged(EFFECTS, EOWYN, "f0");
    expect(triggers(run.state, tab)).not.toContain("16008:response:1");
  });
});
