// Rules: rr.attachment-cards, rr.restricted, rr.action, rr.limits, rr.lasting-effects, rr.response, rr.traits, rr.gains (data/rules/entries.json).
// The Treachery of Rhudaur attachments, written from their card text (data/cards/ToR.json; data/printed holds no ledger for this box yet):
// Elven Spear 10087:A:1 and A:2, Silver Harp 10090:A:2 and A:3, Elf-friend 10093:A:1 and A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { hasTrait } from "../../rules/interpret/conditions.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { answerFirst, attach, enter, fillers, hosts, play, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ERESTOR = "10084";
const SPEAR = "10087";
const WEAVER = "10089";
const HARP = "10090";
const GALDOR = "10091";
const ELF_FRIEND = "10093";
// Core heroes: Aragorn (Leadership, Dúnedain), Legolas (Tactics, Silvan), Éowyn (Spirit, Rohan).
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const WEAK = "weak";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([ERESTOR, SPEAR, WEAVER, HARP, GALDOR, ELF_FRIEND, ARAGORN, LEGOLAS, EOWYN]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 3, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Elven Spear (10087:A:1, A:2)", () => {
  // "Attach to a Noldor or Silvan hero.": Erestor (Noldor hero) and Legolas (Silvan hero) are offered; Aragorn (a hero of neither trait) and
  // Galdor of the Havens (a Noldor ally, not a hero) are not.
  lineSpec("10087:A:1", "goes on a Noldor or Silvan hero only", (effects) => {
    const tab = table(effects, { heroes: [{ code: ERESTOR, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: GALDOR, seat: 0 }], hand: [{ code: SPEAR, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, SPEAR))).toEqual([idsOf(tab, ERESTOR), idsOf(tab, LEGOLAS)].sort());
    const run = play(begin(tab.state), tab, idsOf(tab, SPEAR), idsOf(tab, LEGOLAS));
    expect(run.state.cards[idsOf(tab, SPEAR)]?.host).toBe(idsOf(tab, LEGOLAS));
  });

  // "Restricted." (the card's keyword): Legolas holds two Elven Spears; a third makes one of them go to the discard pile.
  it("10087:A:1 Restricted: a third restricted attachment on a hero sends one to the discard pile", () => {
    const scene = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: SPEAR, seat: 0 }, { code: SPEAR, seat: 0 }], hand: [{ code: SPEAR, seat: 0 }] });
    const [first, second, third] = scene.ids[SPEAR] ?? [];
    const legolas = idsOf(scene, LEGOLAS);
    const tab = attach(scene, [[first ?? "", legolas], [second ?? "", legolas]]);
    const run = answerFirst(sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: third ?? "", hostId: legolas, payments: payFor(tab.state, tab.ctx, third ?? "") }, tab.ctx), tab);
    expect(run.state.cards[legolas]?.attachments).toHaveLength(2);
    expect([first, second, third].filter((id) => run.state.cards[id ?? ""]?.zone === "discard")).toHaveLength(1);
  });

  // "Action: Discard a card from your hand to give attached hero +1 Attack until the end of the phase. Limit 3 times per phase."
  lineSpec("10087:A:2", "discards a card from the hand for +1 Attack to the end of the phase, 3 times a phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 0 }], attached: [{ code: SPEAR, host: LEGOLAS }], hand: fillers(CARD, 4) });
    const [spear, legolas] = [idsOf(tab, SPEAR), idsOf(tab, LEGOLAS)];
    const printed = stat(tab.state, tab, legolas, "attack");
    let run = begin(tab.state);
    for (let use = 1; use <= 3; use += 1) {
      expect(triggers(run.state, tab)).toContain("10087:action:1");
      run = answerFirst(sendUnledgered(run, { type: "Trigger", cardId: spear, effectId: "10087:action:1" }, tab.ctx), tab);
      expect(run.state.seats[0]?.hand).toHaveLength(4 - use);
      expect(run.state.seats[0]?.discard).toHaveLength(use);
      expect(stat(run.state, tab, legolas, "attack")).toBe(printed + use);
      // The bonus goes on the attached hero only.
      expect(stat(run.state, tab, idsOf(tab, ARAGORN), "attack")).toBe(tab.ctx.cards.get(ARAGORN)?.attack);
    }
    // A fourth use in the phase is not offered, though a card is left in the hand.
    expect(triggers(run.state, tab)).not.toContain("10087:action:1");
    // The phase ends: the bonus is gone.
    expect(stat(enter(run.state, tab, "questCommit").state, tab, legolas, "attack")).toBe(printed);
  });

  it("10087:A:2 is not offered with an empty hand", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }], attached: [{ code: SPEAR, host: LEGOLAS }] });
    expect(triggers(tab.state, tab)).not.toContain("10087:action:1");
  });
});

describe("Silver Harp (10090:A:2, A:3)", () => {
  // "Attach to a Spirit hero.": Éowyn (Spirit hero) is offered; Aragorn (Leadership hero) and the Galadhrim Weaver (a Spirit ally) are not.
  lineSpec("10090:A:2", "goes on a Spirit hero only", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: WEAVER, seat: 0 }], hand: [{ code: HARP, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, HARP))).toEqual([idsOf(tab, EOWYN)]);
  });

  // "Response: After a card is discarded from your hand, exhaust Silver Harp to return that card to your hand.": the Elven Spear's cost
  // discards the card.
  lineSpec("10090:A:3", "after a card is discarded from your hand, exhausts to return that card to the hand", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: HARP, host: EOWYN }, { code: SPEAR, host: LEGOLAS }], hand: fillers(CARD, 1) });
    const [harp, card] = [idsOf(tab, HARP), idsOf(tab, CARD)];
    let run = answerFirst(sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, SPEAR), effectId: "10087:action:1" }, tab.ctx), tab);
    expect(run.state.cards[card]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).toContain("10090:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: harp, effectId: "10090:response:1" }, tab.ctx);
    expect(run.state.cards[card]?.zone).toBe("hand");
    expect(run.state.seats[0]?.hand).toEqual([card]);
    expect(run.state.cards[harp]?.exhausted).toBe(true);
  });

  it("10090:A:3 is not offered when a card is discarded from another player's hand", () => {
    const scene = table(EFFECTS, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: LEGOLAS, seat: 1 }], allies: [{ code: SPEAR, seat: 1 }], attached: [{ code: HARP, host: EOWYN }], hand: fillers(CARD, 1, 1) });
    const tab = attach(scene, [[idsOf(scene, SPEAR), idsOf(scene, LEGOLAS)]]);
    const theirs = { ...tab.state, activeSeat: 1 };
    const run = answerFirst(sendUnledgered(begin(theirs), { type: "Trigger", cardId: idsOf(tab, SPEAR), effectId: "10087:action:1" }, tab.ctx), tab);
    expect(run.state.cards[idsOf(tab, CARD)]?.zone).toBe("discard");
    // Not offered to either seat.
    for (const seat of [0, 1]) expect(triggers({ ...run.state, activeSeat: seat }, tab)).not.toContain("10090:response:1");
  });
});

describe("Elf-friend (10093:A:1, A:2)", () => {
  // "Attach to a character." The engine's default attach rule already admits a character and refuses an enemy, so the record changes
  // nothing a table shows and this is a plain test.
  it("10093:A:1 goes on a hero or an ally and not on an enemy", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: "ally", seat: 0 }], hand: [{ code: ELF_FRIEND, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, ELF_FRIEND))).toEqual([idsOf(tab, ARAGORN), idsOf(tab, "ally")].sort());
  });

  // "Attached character gains the Noldor and Silvan traits.": played on Aragorn, he is Noldor and Silvan in the state the PlayCard intent
  // returns, and an Elven Spear (Noldor or Silvan hero) can now go on him.
  lineSpec("10093:A:2", "the attached character gains the Noldor and Silvan traits", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: LEGOLAS, seat: 0 }], hand: [{ code: ELF_FRIEND, seat: 0 }, { code: SPEAR, seat: 0 }] });
    const aragorn = idsOf(tab, ARAGORN);
    expect(hosts(tab, idsOf(tab, SPEAR))).not.toContain(aragorn);
    const run = play(begin(tab.state), tab, idsOf(tab, ELF_FRIEND), aragorn);
    expect(hasTrait(run.state, aragorn, "Noldor", tab.ctx)).toBe(true);
    expect(hasTrait(run.state, aragorn, "Silvan", tab.ctx)).toBe(true);
    expect(hasTrait(run.state, idsOf(tab, LEGOLAS), "Noldor", tab.ctx)).toBe(false);
    expect(hosts(tab, idsOf(tab, SPEAR), run.state)).toContain(aragorn);
  });
});
