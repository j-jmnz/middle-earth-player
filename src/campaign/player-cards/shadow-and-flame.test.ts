// Rules: rr.resource-match, rr.attachment-cards, rr.modifiers, rr.hit-points, rr.action, rr.cost, rr.ready, rr.lasting-effects,
// rr.search, rr.drawing-cards, rr.refresh-phase, rr.gains, rr.unique-cards (data/rules/entries.json).
// The Shadow and Flame player cards, each printed line tested from the words on the card: Elrond 04128:A:1, Hardy Leadership 04130:A:1
// and A:2, Miruvor 04133:A:1 and A:2, Master of the Forge 04134:A:1, Peace, and Thought 04135:A:1, Vilya 04137:A:1. The lines are the
// text of data/cards (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { choices, endRound, enter, hosts, play, playerTableFor, sendUnledgered, stat } from "../../../test/harness/player-table.ts";

const ELROND = "04128";
const HARDY = "04130";
const MIRUVOR = "04133";
const FORGE = "04134";
const PEACE = "04135";
const VILYA = "04137";
// Gondorian Spearman: a Tactics ally of cost 2. Citadel Plate: a Tactics attachment of cost 4.
const SPEARMAN = "01029";
const PLATE = "01040";
// Cards with no text: a Spirit hero, a Leadership Dwarf hero, a Dwarf ally, a Spirit ally, a Leadership event of cost 1, and two
// attachments to search for.
const SPIRIT = "spirit";
const DWARF_HERO = "dwarf-hero";
const DWARF = "dwarf";
const SPIRIT_ALLY = "spirit-ally";
const ORDER = "order";
const TRINKET = "trinket";
const BAUBLE = "bauble";
const PAL = "pal";
const ALLY = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([ELROND, HARDY, MIRUVOR, FORGE, PEACE, VILYA, SPEARMAN, PLATE]))]);
  cards.set(SPIRIT, definePrinted({ code: SPIRIT, name: "Spirit", type: "hero", sphere: "spirit", threat: 8, willpower: 2, attack: 1, defense: 1, health: 4 }));
  cards.set(DWARF_HERO, definePrinted({ code: DWARF_HERO, name: "Dwarf Hero", type: "hero", sphere: "leadership", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Dwarf"] }));
  cards.set(DWARF, definePrinted({ code: DWARF, name: "Dwarf", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dwarf"] }));
  cards.set(SPIRIT_ALLY, definePrinted({ code: SPIRIT_ALLY, name: "Spirit Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set(ORDER, definePrinted({ code: ORDER, name: "Order", type: "event", sphere: "leadership", cost: 1 }));
  cards.set(TRINKET, definePrinted({ code: TRINKET, name: "Trinket", type: "attachment", sphere: "lore", cost: 1 }));
  cards.set(BAUBLE, definePrinted({ code: BAUBLE, name: "Bauble", type: "attachment", sphere: "lore", cost: 1 }));
  base = { ...starter, cards };
});

describe("Elrond (04128:A:1)", () => {
  // "You may spend resources from Elrond's resource pool to pay for Spirit, Leadership, and Tactics allies.": Elrond (Lore) alone pays for a
  // Spirit, a Leadership and a Tactics ally; not for a Tactics attachment or a Leadership event.
  lineSpec("04128:A:1", "Elrond pays for Spirit, Leadership and Tactics allies, and for nothing else of those spheres", (effects) => {
    const tab = table(effects, { heroes: [{ code: ELROND, seat: 0 }], hand: [{ code: SPIRIT_ALLY, seat: 0 }, { code: ALLY, seat: 0 }, { code: SPEARMAN, seat: 0 }, { code: PLATE, seat: 0 }, { code: ORDER, seat: 0 }] });
    const elrond = idsOf(tab, ELROND);
    const by = (code: string, amount: number, hostId?: string) => ({ type: "PlayCard" as const, cardId: idsOf(tab, code), payments: [{ heroId: elrond, amount }], ...(hostId ? { hostId } : {}) });
    expect(refusal(tab.state, by(PLATE, 4, elrond), tab.ctx)).not.toBeNull();
    expect(refusal(tab.state, by(ORDER, 1), tab.ctx)).not.toBeNull();
    let run = sendUnledgered(begin(tab.state), by(SPIRIT_ALLY, 1), tab.ctx);
    run = sendUnledgered(run, by(ALLY, 1), tab.ctx);
    run = sendUnledgered(run, by(SPEARMAN, 2), tab.ctx);
    for (const code of [SPIRIT_ALLY, ALLY, SPEARMAN]) expect(run.state.cards[idsOf(tab, code)]?.zone).toBe("play");
    expect(run.state.cards[elrond]?.resources).toBe(6 - 4);
  });
});

describe("Hardy Leadership (04130:A:1, A:2)", () => {
  // "Attach to a Leadership hero.": the Pal and the Dwarf Hero (Leadership heroes) are offered; the Spirit hero and a Leadership ally are not.
  lineSpec("04130:A:1", "Hardy Leadership: Attach to a Leadership hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: DWARF_HERO, seat: 0 }, { code: SPIRIT, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: HARDY, seat: 0 }] });
    const hardy = idsOf(tab, HARDY);
    expect(hosts(tab, hardy)).toEqual([idsOf(tab, PAL), idsOf(tab, DWARF_HERO)].sort());
    expect(play(begin(tab.state), tab, hardy, idsOf(tab, PAL)).state.cards[hardy]?.host).toBe(idsOf(tab, PAL));
  });

  // "Each Dwarf gets +1 hit point.": played on the Pal (not a Dwarf), it gives +1 to the Dwarf Hero, the Dwarf ally and the other
  // player's Dwarf ally, and nothing to the Pal.
  lineSpec("04130:A:2", "Hardy Leadership: each Dwarf gets +1 hit point", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: DWARF_HERO, seat: 0 }, { code: SPIRIT, seat: 1 }], allies: [{ code: DWARF, seat: 0 }, { code: DWARF, seat: 1 }], hand: [{ code: HARDY, seat: 0 }] });
    const [pal, hero, mine = "", theirs = ""] = [idsOf(tab, PAL), idsOf(tab, DWARF_HERO), ...(tab.ids[DWARF] ?? [])];
    const run = play(begin(tab.state), tab, idsOf(tab, HARDY), pal);
    expect(stat(run.state, tab, hero, "hitPoints")).toBe(4 + 1);
    expect(stat(run.state, tab, mine, "hitPoints")).toBe(2 + 1);
    expect(stat(run.state, tab, theirs, "hitPoints")).toBe(2 + 1);
    expect(stat(run.state, tab, pal, "hitPoints")).toBe(3);
    expect(stat(run.state, tab, idsOf(tab, SPIRIT), "hitPoints")).toBe(4);
  });
});

describe("Miruvor (04133:A:1, A:2)", () => {
  // "Attach to a hero.": both heroes are offered; an ally is not.
  lineSpec("04133:A:1", "Miruvor: Attach to a hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }, { code: PAL, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: MIRUVOR, seat: 0 }] });
    const miruvor = idsOf(tab, MIRUVOR);
    expect(hosts(tab, miruvor)).toEqual([idsOf(tab, SPIRIT), idsOf(tab, PAL)].sort());
    expect(play(begin(tab.state), tab, miruvor, idsOf(tab, PAL)).state.cards[miruvor]?.host).toBe(idsOf(tab, PAL));
  });

  // Miruvor on the exhausted Spirit hero (Willpower 2, 6 resources); a card in the deck.
  function drink(effects: readonly Effect[], option: string): { tab: Table; run: Run } {
    const scene = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], attached: [{ code: MIRUVOR, host: SPIRIT }], playerDeck: [{ code: "card", seat: 0 }] });
    const tab = { ...scene, state: updateCard(scene.state, idsOf(scene, SPIRIT), { exhausted: true }) };
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, MIRUVOR), effectId: "04133:action:1" }, tab.ctx);
    expect(choices(run.state, tab)).toHaveLength(6);
    run = sendUnledgered(run, { type: "Choose", optionId: option }, tab.ctx);
    return { tab, run };
  }

  // "Action: Discard Miruvor to (choose two): ready attached hero, add 1 resource to attached hero's resource pool, attached hero gets +1
  // Willpower until the end of the round, or put Miruvor on the top of your deck.": the six pairs are offered. Ready and +1 Willpower: the
  // hero is ready with Willpower 3 until the round ends, no resource added, and Miruvor is in the discard pile.
  lineSpec("04133:A:2", "Miruvor: ready the hero and +1 Willpower until the end of the round", (effects) => {
    const { tab, run } = drink(effects, "ready+willpower");
    const hero = idsOf(tab, SPIRIT);
    expect(run.state.cards[hero]?.exhausted).toBe(false);
    expect(run.state.cards[hero]?.resources).toBe(6);
    expect(stat(run.state, tab, hero, "willpower")).toBe(2 + 1);
    expect(run.state.cards[idsOf(tab, MIRUVOR)]?.zone).toBe("discard");
    expect(stat(endRound(run.state, tab).state, tab, hero, "willpower")).toBe(2);
  });

  // A resource and the top of the deck: the hero gets 1 resource and stays exhausted, and Miruvor goes on the top of the deck.
  lineSpec("04133:A:2", "Miruvor: 1 resource and Miruvor on the top of the deck", (effects) => {
    const { tab, run } = drink(effects, "resource+deck");
    const [hero, miruvor] = [idsOf(tab, SPIRIT), idsOf(tab, MIRUVOR)];
    expect(run.state.cards[hero]?.resources).toBe(6 + 1);
    expect(run.state.cards[hero]?.exhausted).toBe(true);
    expect(stat(run.state, tab, hero, "willpower")).toBe(2);
    expect(run.state.cards[miruvor]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck[0]).toBe(miruvor);
  });
});

describe("Master of the Forge (04134:A:1)", () => {
  // The deck from the top: a card, the Trinket (2nd), two cards, the Bauble (5th), a Trinket (6th) and a card.
  const deck = [{ code: "card", seat: 0 }, { code: TRINKET, seat: 0 }, { code: ORDER, seat: 0 }, { code: ALLY, seat: 0 }, { code: BAUBLE, seat: 0 }, { code: TRINKET, seat: 0 }, { code: PAL, seat: 0 }];

  // "Action: Exhaust Master of the Forge to search the top 5 cards of your deck for any 1 attachment and add it to your hand. Shuffle the
  // other cards back into your deck.": the Trinket and the Bauble of the top 5 are the choices, the 6th card is not; the Bauble goes to
  // the hand, the Master is exhausted and the deck is shuffled.
  lineSpec("04134:A:1", "Master of the Forge: an attachment of the top 5 to the hand, the deck shuffled", (effects) => {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: FORGE, seat: 0 }], playerDeck: deck });
    const [forge, trinket = "", sixth = "", bauble] = [idsOf(tab, FORGE), ...(tab.ids[TRINKET] ?? []), idsOf(tab, BAUBLE)];
    const before = tab.state.seats[0]?.deck ?? [];
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: forge, effectId: "04134:action:1" }, tab.ctx);
    expect(run.state.cards[forge]?.exhausted).toBe(true);
    expect(choices(run.state, tab).sort()).toEqual([trinket, bauble].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: bauble }, tab.ctx);
    expect(run.state.cards[bauble]?.zone).toBe("hand");
    expect(run.state.cards[sixth]?.zone).toBe("deck");
    const after = run.state.seats[0]?.deck ?? [];
    expect([...after].sort()).toEqual(before.filter((id) => id !== bauble).sort());
    expect(after).not.toEqual(before.filter((id) => id !== bauble));
  });
});

describe("Peace, and Thought (04135:A:1)", () => {
  // Three ready heroes, Peace, and Thought in hand and 6 cards in the deck; the round has reached the refresh phase's action window.
  const scene = (effects: readonly Effect[]) =>
    table(effects, { heroes: [{ code: ELROND, seat: 0 }, { code: SPIRIT, seat: 0 }, { code: PAL, seat: 0 }], hand: [{ code: PEACE, seat: 0 }], playerDeck: Array.from({ length: 6 }, () => ({ code: "card", seat: 0 })) });

  // "Refresh Action: Exhaust 2 heroes to draw 5 cards.": not in the planning phase; in the refresh phase the player chooses 2 of his ready
  // heroes, both are exhausted, and he draws 5 cards.
  lineSpec("04135:A:1", "Peace, and Thought: in the refresh phase, exhaust 2 heroes to draw 5 cards", (effects) => {
    const tab = scene(effects);
    const [elrond, spirit, pal, peace] = [idsOf(tab, ELROND), idsOf(tab, SPIRIT), idsOf(tab, PAL), idsOf(tab, PEACE)];
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === peace)).toBe(false);
    let run = enter(tab.state, tab, "refresh");
    expect(legalIntents(run.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === peace)).toBe(true);
    run = play(run, tab, peace);
    expect(choices(run.state, tab).sort()).toEqual([elrond, spirit, pal].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: spirit }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([elrond, pal].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: pal }, tab.ctx);
    expect(run.state.cards[spirit]?.exhausted).toBe(true);
    expect(run.state.cards[pal]?.exhausted).toBe(true);
    expect(run.state.cards[elrond]?.exhausted).toBe(false);
    expect(run.state.seats[0]?.hand).toHaveLength(5);
    expect(run.state.seats[0]?.deck).toHaveLength(1);
  });

  // With one ready hero the cost of 2 heroes cannot be paid: it is not offered.
  it("04135:A:1 Peace, and Thought: not offered with one ready hero", () => {
    const tab = scene(EFFECTS);
    const run = enter(tab.state, tab, "refresh");
    const tired = updateCard(updateCard(run.state, idsOf(tab, SPIRIT), { exhausted: true }), idsOf(tab, PAL), { exhausted: true });
    expect(legalIntents(tired, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, PEACE))).toBe(false);
  });
});

describe("Vilya (04137:A:1)", () => {
  // "Attach to Elrond. He gains a Spirit resource icon.": Elrond is offered and the Spirit hero is not; played on Elrond, Vilya lets him pay
  // for Miruvor (a Spirit attachment) on his own.
  lineSpec("04137:A:1", "Vilya: Attach to Elrond, who gains a Spirit resource icon", (effects) => {
    const tab = table(effects, { heroes: [{ code: ELROND, seat: 0 }, { code: SPIRIT, seat: 0 }], hand: [{ code: VILYA, seat: 0 }, { code: MIRUVOR, seat: 0 }] });
    const [elrond, vilya, miruvor] = [idsOf(tab, ELROND), idsOf(tab, VILYA), idsOf(tab, MIRUVOR)];
    const byElrond = { type: "PlayCard", cardId: miruvor, hostId: elrond, payments: [{ heroId: elrond, amount: 1 }] } as const;
    expect(hosts(tab, vilya)).toEqual([elrond]);
    expect(refusal(tab.state, byElrond, tab.ctx)).not.toBeNull();
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: vilya, hostId: elrond, payments: [{ heroId: elrond, amount: 2 }] }, tab.ctx);
    expect(run.state.cards[vilya]?.host).toBe(elrond);
    run = sendUnledgered(run, byElrond, tab.ctx);
    expect(run.state.cards[miruvor]?.host).toBe(elrond);
  });
});
