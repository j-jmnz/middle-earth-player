// Rules: rr.attachment-cards, rr.restricted, rr.response, rr.action, rr.then, rr.triggered-ability, rr.lasting-effects, rr.enters-play,
// rr.search, rr.play-and-put-into-play, rr.play-restrictions-and-permissions, rr.delayed-effects, rr.ready, rr.event-cards
// (data/rules/entries.json).
// The Trouble in Tharbad player cards, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): O Lórien!
// 08058:A:1, Gwaihir 08059:A:1 and A:2, Courage Awakened 08061:A:1, Galadhrim Minstrel 08063:A:1, Lembas 08064:A:1 to A:3, Defender of
// the Naith 08065:A:2. The lines are the text of data/cards/TiT.json (the ledger lines in data/printed are read from the scans).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withThreat } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { type Run, type Table, begin, idsOf, send } from "../../../test/harness/scene.ts";
import { canPlay, choices, destroyed, discarded, endRound, enter, hosts, play, playerTableFor, stat, triggers } from "../../../test/harness/player-table.ts";

const LORIEN = "08058";
const GWAIHIR = "08059";
const COURAGE = "08061";
const MINSTREL = "08063";
const LEMBAS = "08064";
const NAITH = "08065";
// Core Legolas (Tactics, Silvan hero), Denethor (Lore, Gondor), Glorfindel (Lore, Noldor), Gondorian Spearman (a Tactics ally), Lórien
// Guide (a Silvan ally), Spear of the Citadel (a restricted Tactics attachment for a Tactics character).
const LEGOLAS = "01005";
const DENETHOR = "01010";
const GLORFINDEL = "01011";
const SPEARMAN = "01029";
const GUIDE = "01044";
const SPEAR = "05009";
const ALLY = "ally";
const PAL = "pal";
const CARD = "card";
// Two Eagle allies, an Eagle event, a second event, a Spirit hero with no Trait.
const EAGLE = "eagle";
const EAGLE2 = "eagle2";
const EAGLE_EVENT = "eagle-event";
const TALE = "tale";
const SPIRIT = "spirit";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([LORIEN, GWAIHIR, COURAGE, MINSTREL, LEMBAS, NAITH, LEGOLAS, DENETHOR, GLORFINDEL, SPEARMAN, GUIDE, SPEAR]))]);
  cards.set(EAGLE, definePrinted({ code: EAGLE, name: "Eagle", type: "ally", sphere: "tactics", cost: 2, willpower: 1, attack: 2, defense: 1, health: 2, traits: ["Creature", "Eagle"] }));
  cards.set(EAGLE2, definePrinted({ code: EAGLE2, name: "Second Eagle", type: "ally", sphere: "tactics", cost: 3, willpower: 1, attack: 3, defense: 1, health: 3, traits: ["Eagle"] }));
  cards.set(TALE, definePrinted({ code: TALE, name: "Tale", type: "event", sphere: "lore", cost: 1 }));
  cards.set(EAGLE_EVENT, definePrinted({ code: EAGLE_EVENT, name: "Eagle Event", type: "event", sphere: "tactics", cost: 1, traits: ["Eagle"] }));
  cards.set(SPIRIT, definePrinted({ code: SPIRIT, name: "Spirit", type: "hero", sphere: "spirit", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  base = { ...starter, cards };
});

// The card `id` is destroyed (9 damage), and a Pass lets the game resolve what that set off.

describe("O Lórien! (08058:A:1)", () => {
  // "Attach to a hero.": the Pal and the other player's Spirit hero are offered, the ally is not.
  lineSpec("08058:A:1", "goes on a hero and not on an ally", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: SPIRIT, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: LORIEN, seat: 0 }] });
    const lorien = idsOf(tab, LORIEN);
    expect(hosts(tab, lorien)).toEqual([idsOf(tab, PAL), idsOf(tab, SPIRIT)].sort());
    expect(play(begin(tab.state), tab, lorien, idsOf(tab, PAL)).state.cards[lorien]?.host).toBe(idsOf(tab, PAL));
  });
});

describe("Gwaihir (08059:A:1, A:2)", () => {
  // "Cannot have restricted attachments.": Spear of the Citadel (restricted, for a Tactics character) is offered for Legolas and the
  // Gondorian Spearman, not for Gwaihir (a Tactics ally).
  lineSpec("08059:A:1", "cannot have restricted attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: GWAIHIR, seat: 0 }, { code: SPEARMAN, seat: 0 }], hand: [{ code: SPEAR, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, SPEAR))).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, SPEARMAN)].sort());
  });

  // Gwaihir in hand, Legolas pays; the first player's discard pile holds two Eagle allies, a plain ally and an Eagle event, and the other
  // player's an Eagle ally.
  function scene(effects: readonly Effect[]): { tab: Table; mine: string[]; plain: string; event: string; theirs: string } {
    const start = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: SPIRIT, seat: 1 }], hand: [{ code: GWAIHIR, seat: 0 }] });
    const { tab, ids: [first = "", second = "", plain = "", event = "", theirs = ""] } = discarded(start, [[EAGLE, 0], [EAGLE2, 0], [ALLY, 0], [EAGLE_EVENT, 0], [EAGLE, 1]]);
    return { tab, mine: [first, second], plain, event, theirs };
  }

  // "Response: After Gwaihir enters play, search your discard pile for an Eagle ally and put it into play under your control. At the end of
  // the round, if that ally is still in play, add it to your hand.": the two Eagle allies of the player's own discard pile are offered;
  // the chosen one enters play under the player's control, stays through the round and goes to the hand when it ends.
  lineSpec("08059:A:2", "after he enters play, an Eagle ally from the discard pile into play, to the hand at the end of the round", (effects) => {
    const { tab, mine, plain, event, theirs } = scene(effects);
    const [eagle = ""] = mine;
    const gwaihir = idsOf(tab, GWAIHIR);
    let run = play(begin(tab.state), tab, gwaihir);
    expect(triggers(run.state, tab)).toContain("08059:response:1");
    run = send(run, { type: "Trigger", cardId: gwaihir, effectId: "08059:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([...mine].sort());
    run = send(run, { type: "Choose", optionId: eagle }, tab.ctx);
    expect(run.state.cards[eagle]).toMatchObject({ zone: "play", controller: 0 });
    for (const id of [plain, event, theirs, mine[1] ?? ""]) expect(run.state.cards[id]?.zone).toBe("discard");
    expect(run.state.cards[gwaihir]?.zone).toBe("play");
    const ended = endRound(run.state, tab).state;
    expect(ended.cards[eagle]?.zone).toBe("hand");
    expect(ended.seats[0]?.hand).toContain(eagle);
    expect(ended.cards[gwaihir]?.zone).toBe("play");
  });

  // "if that ally is still in play": the Eagle destroyed before the round ends stays in the discard pile.
  it("08059:A:2 an Eagle that left play before the end of the round is not added to the hand", () => {
    const { tab, mine: [eagle = ""] } = scene(EFFECTS);
    const gwaihir = idsOf(tab, GWAIHIR);
    let run = play(begin(tab.state), tab, gwaihir);
    run = send(run, { type: "Trigger", cardId: gwaihir, effectId: "08059:response:1" }, tab.ctx);
    run = send(run, { type: "Choose", optionId: eagle }, tab.ctx);
    run = destroyed(run.state, tab, eagle);
    expect(run.state.cards[eagle]?.zone).toBe("discard");
    expect(endRound(run.state, tab).state.cards[eagle]?.zone).toBe("discard");
  });
});

describe("Courage Awakened (08061:A:1)", () => {
  // The Spirit hero pays; two copies are in hand.
  const scene = (effects: readonly Effect[]) => table(effects, { heroes: [{ code: SPIRIT, seat: 0 }, { code: PAL, seat: 0 }], hand: [{ code: COURAGE, seat: 0 }, { code: COURAGE, seat: 0 }] });
  const cast = (run: Run, tab: Table, id: string, hero: string): Run => {
    const played = send(run, { type: "PlayCard", cardId: id, payments: [{ heroId: idsOf(tab, SPIRIT), amount: 1 }] }, tab.ctx);
    expect(choices(played.state, tab).sort()).toEqual([idsOf(tab, SPIRIT), idsOf(tab, PAL)].sort());
    return send(played, { type: "Choose", optionId: hero }, tab.ctx);
  };

  // "Action: Choose a hero. That hero gets +2 Willpower until the end of the phase. Then, if your threat is 20 or less and this is the
  // first time you played a copy of Courage Awakened this round, return this card to your hand instead of discarding it.": at threat 8
  // the Pal gets +2 Willpower until the planning phase ends and the card goes back to the hand; played again that round, the copy is
  // discarded.
  lineSpec("08061:A:1", "+2 Willpower for the phase, back to the hand the first time a round at threat 20 or less", (effects) => {
    const tab = scene(effects);
    const pal = idsOf(tab, PAL);
    const [first = "", second = ""] = tab.ids[COURAGE] ?? [];
    let run = cast(begin(tab.state), tab, first, pal);
    expect(stat(run.state, tab, pal, "willpower")).toBe(1 + 2);
    expect(run.state.cards[first]?.zone).toBe("hand");
    expect(stat(enter(run.state, tab, "questCommit").state, tab, pal, "willpower")).toBe(1);
    run = cast(run, tab, second, pal);
    expect(run.state.cards[second]?.zone).toBe("discard");
    expect(stat(run.state, tab, pal, "willpower")).toBe(1 + 4);
  });

  // At threat 21 the first copy is discarded.
  it("08061:A:1 is discarded when the threat is over 20", () => {
    const scene0 = scene(EFFECTS);
    const tab = { ...scene0, state: withThreat(scene0.state, 0, 21) };
    const [first = ""] = tab.ids[COURAGE] ?? [];
    const run = cast(begin(tab.state), tab, first, idsOf(tab, PAL));
    expect(run.state.cards[first]?.zone).toBe("discard");
  });
});

describe("Galadhrim Minstrel (08063:A:1)", () => {
  // "Response: After Galadhrim Minstrel enters play, search the top five cards of your deck for an event card and add it to your hand.
  // Shuffle the other cards back into your deck.": the deck is three different events and four allies, the third event sixth from the
  // top (seven cards). The events in the top five are offered and the sixth card is not; the chosen event goes to the hand and the
  // other six are shuffled.
  lineSpec("08063:A:1", "after it enters play, an event of the top five cards to the hand, the rest shuffled", (effects) => {
    const deck = [CARD, ALLY, TALE, ALLY, ALLY, EAGLE_EVENT, ALLY].map((code) => ({ code, seat: 0 }));
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: MINSTREL, seat: 0 }], playerDeck: deck });
    const minstrel = idsOf(tab, MINSTREL);
    const order = [...(tab.state.seats[0]?.deck ?? [])];
    const [first, second, deep] = [idsOf(tab, CARD), idsOf(tab, TALE), idsOf(tab, EAGLE_EVENT)];
    expect([order[0], order[2], order[5]]).toEqual([first, second, deep]);
    let run = play(begin(tab.state), tab, minstrel);
    expect(triggers(run.state, tab)).toContain("08063:response:1");
    run = send(run, { type: "Trigger", cardId: minstrel, effectId: "08063:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([first, second].sort());
    run = send(run, { type: "Choose", optionId: second }, tab.ctx);
    expect(run.state.cards[second]?.zone).toBe("hand");
    const left = run.state.seats[0]?.deck ?? [];
    expect([...left].sort()).toEqual(order.filter((id) => id !== second).sort());
    expect(left).not.toEqual(order.filter((id) => id !== second));
  });
});

describe("Lembas (08064:A:1 to A:3)", () => {
  // "Play only if you control a Noldor or Silvan hero.": with Glorfindel (a Noldor hero) it is played; with Denethor alone, a Lórien
  // Guide (a Silvan ally) and the other player's Legolas (a Silvan hero), it is not.
  lineSpec("08064:A:1", "is played only while you control a Noldor or Silvan hero", (effects) => {
    const without = table(effects, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: LEGOLAS, seat: 1 }], allies: [{ code: GUIDE, seat: 0 }], hand: [{ code: LEMBAS, seat: 0 }] });
    expect(canPlay(without.state, without, idsOf(without, LEMBAS))).toBe(false);
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: GLORFINDEL, seat: 0 }], hand: [{ code: LEMBAS, seat: 0 }] });
    expect(canPlay(tab.state, tab, idsOf(tab, LEMBAS))).toBe(true);
    expect(play(begin(tab.state), tab, idsOf(tab, LEMBAS), idsOf(tab, DENETHOR)).state.cards[idsOf(tab, LEMBAS)]?.host).toBe(idsOf(tab, DENETHOR));
  });

  // "Attach to a hero.": Glorfindel, Denethor and the other player's Spirit hero are offered, the Lórien Guide is not.
  lineSpec("08064:A:2", "goes on a hero and not on an ally", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: GLORFINDEL, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: SPIRIT, seat: 1 }], allies: [{ code: GUIDE, seat: 0 }], hand: [{ code: LEMBAS, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, LEMBAS))).toEqual([idsOf(tab, GLORFINDEL), idsOf(tab, DENETHOR), idsOf(tab, SPIRIT)].sort());
  });

  // Glorfindel holds Lembas, exhausted or not, with `damage` on him.
  function scene(effects: readonly Effect[], exhausted: boolean, damage: number): Table {
    const tab = table(effects, { heroes: [{ code: GLORFINDEL, seat: 0 }], attached: [{ code: LEMBAS, host: GLORFINDEL }] });
    return { ...tab, state: updateCard(tab.state, idsOf(tab, GLORFINDEL), { exhausted, damage }) };
  }

  // "Action: Discard Lembas to ready attached hero and heal 3 damage from it.": Glorfindel, exhausted with 4 damage, is readied and keeps 1
  // damage; Lembas is in the discard pile.
  lineSpec("08064:A:3", "discards itself to ready the hero and heal 3 damage from it", (effects) => {
    const tab = scene(effects, true, 4);
    const glorfindel = idsOf(tab, GLORFINDEL);
    const run = send(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, LEMBAS), effectId: "08064:action:1" }, tab.ctx);
    expect(run.state.cards[glorfindel]).toMatchObject({ exhausted: false, damage: 1 });
    expect(run.state.cards[idsOf(tab, LEMBAS)]?.zone).toBe("discard");
  });

  // A ready hero with damage is still healed.
  it("08064:A:3 heals a ready hero", () => {
    const tab = scene(EFFECTS, false, 2);
    const run = send(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, LEMBAS), effectId: "08064:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, GLORFINDEL)]?.damage).toBe(0);
  });

  it("08064:A:3 is not offered when the hero is ready and has no damage", () => {
    const tab = scene(EFFECTS, false, 0);
    expect(triggers(tab.state, tab)).not.toContain("08064:action:1");
  });
});

describe("Defender of the Naith (08065:A:2)", () => {
  // An exhausted Defender of the Naith, a Lórien Guide (Silvan) and a plain ally for the first player; a Lórien Guide for the other player.
  function scene(effects: readonly Effect[], exhausted = true): Table {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: SPIRIT, seat: 1 }], allies: [{ code: NAITH, seat: 0 }, { code: GUIDE, seat: 0 }, { code: ALLY, seat: 0 }, { code: GUIDE, seat: 1 }] });
    return { ...tab, state: updateCard(tab.state, idsOf(tab, NAITH), { exhausted }) };
  }

  // "Response: After a Silvan ally you control leaves play, ready Defender of the Naith.": the player's Lórien Guide is destroyed and the
  // Defender is readied.
  lineSpec("08065:A:2", "after a Silvan ally you control leaves play, it readies", (effects) => {
    const tab = scene(effects);
    const [guide = ""] = tab.ids[GUIDE] ?? [];
    let run = destroyed(tab.state, tab, guide);
    expect(run.state.cards[guide]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).toContain("08065:response:1");
    run = send(run, { type: "Trigger", cardId: idsOf(tab, NAITH), effectId: "08065:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, NAITH)]?.exhausted).toBe(false);
  });

  // The plain ally (not Silvan) and the other player's Lórien Guide (not yours) offer nothing.
  it("08065:A:2 is not offered after an ally that is not Silvan, or another player's Silvan ally, leaves play", () => {
    const tab = scene(EFFECTS);
    const [, theirs = ""] = tab.ids[GUIDE] ?? [];
    for (const id of [idsOf(tab, ALLY), theirs]) {
      const run = destroyed(tab.state, tab, id);
      expect(run.state.cards[id]?.zone).toBe("discard");
      expect(triggers(run.state, tab)).not.toContain("08065:response:1");
    }
  });

  // A ready Defender cannot be readied: no Response.
  it("08065:A:2 is not offered while the Defender is ready", () => {
    const tab = scene(EFFECTS, false);
    const [guide = ""] = tab.ids[GUIDE] ?? [];
    expect(triggers(destroyed(tab.state, tab, guide).state, tab)).not.toContain("08065:response:1");
  });
});
