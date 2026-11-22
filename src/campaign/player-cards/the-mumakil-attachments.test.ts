// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.response, rr.action, rr.cost, rr.refresh-phase, rr.triggered-ability
// (data/rules/entries.json).
// The Mûmakil attachments, each printed line tested from the words on the card: Dwarf Pipe 17007:A:1 and A:2, Kahliel's Headdress
// 17010:A:1, A:2 and A:3. The lines are the text of data/cards (data/printed holds no ledger for this pack), so every intent goes through
// sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { discarded, enter, hosts, play, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const KAHLIEL = "17001";
const PIPE = "17007";
const HEADDRESS = "17010";
// Taking Initiative (The Redhorn Gate): "Action: Discard the top card of your deck. ...", a Leadership event of cost 0.
const INITIATIVE = "04002";
// Cards with no text: Harad allies (Tactics and Lore), a Harad hero, Spirit Dwarf heroes and a Dwarf ally.
const HARAD = "harad";
const SCOUT = "harad-scout";
const HARAD_HERO = "harad-hero";
const DWARF_HERO = "dwarf-hero";
const DWARF_LORD = "dwarf-lord";
const DWARF = "dwarf";
const PAL = "pal";
const ALLY = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([KAHLIEL, PIPE, HEADDRESS, INITIATIVE]))]);
  cards.set(HARAD, definePrinted({ code: HARAD, name: "Harad", type: "ally", sphere: "tactics", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Harad"] }));
  cards.set(SCOUT, definePrinted({ code: SCOUT, name: "Harad Scout", type: "ally", sphere: "lore", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Harad"] }));
  cards.set(HARAD_HERO, definePrinted({ code: HARAD_HERO, name: "Harad Hero", type: "hero", sphere: "tactics", threat: 8, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Harad"], isUnique: true }));
  cards.set(DWARF_HERO, definePrinted({ code: DWARF_HERO, name: "Dwarf Hero", type: "hero", sphere: "spirit", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Dwarf"], isUnique: true }));
  cards.set(DWARF_LORD, definePrinted({ code: DWARF_LORD, name: "Dwarf Lord", type: "hero", sphere: "spirit", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Dwarf"], isUnique: true }));
  cards.set(DWARF, definePrinted({ code: DWARF, name: "Dwarf", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dwarf"] }));
  base = { ...starter, cards };
});

describe("Dwarf Pipe (17007:A:1, A:2)", () => {
  // "Attach to a Dwarf character. Limit 1 per character.": the Dwarf hero and the Dwarf ally are offered; the Dwarf Lord, who holds a Pipe
  // already, and Kahliel (not a Dwarf) are not.
  lineSpec("17007:A:1", "Dwarf Pipe: Attach to a Dwarf character, limit 1 per character", (effects) => {
    const tab = table(effects, { heroes: [{ code: DWARF_HERO, seat: 0 }, { code: DWARF_LORD, seat: 0 }, { code: KAHLIEL, seat: 0 }], attached: [{ code: PIPE, host: DWARF_LORD }], allies: [{ code: DWARF, seat: 0 }], hand: [{ code: PIPE, seat: 0 }] });
    const pipe = tab.ids[PIPE]?.[1] ?? "";
    expect(hosts(tab, pipe)).toEqual([idsOf(tab, DWARF_HERO), idsOf(tab, DWARF)].sort());
    expect(play(begin(tab.state), tab, pipe, idsOf(tab, DWARF)).state.cards[pipe]?.host).toBe(idsOf(tab, DWARF));
  });

  // "Response: After a card is discarded from your deck, exhaust Dwarf Pipe to place that card on the bottom of your deck.": Taking
  // Initiative discards the top card of the deck; the Pipe is exhausted and that card goes to the bottom of the deck.
  lineSpec("17007:A:2", "Dwarf Pipe: exhaust it to put a card discarded from your deck on the bottom of the deck", (effects) => {
    const tab = table(effects, { heroes: [{ code: DWARF_HERO, seat: 0 }, { code: KAHLIEL, seat: 0 }], attached: [{ code: PIPE, host: DWARF_HERO }], hand: [{ code: INITIATIVE, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }, { code: ALLY, seat: 0 }, { code: ALLY, seat: 0 }, { code: ALLY, seat: 0 }] });
    const [pipe, top] = [idsOf(tab, PIPE), idsOf(tab, "card")];
    let run = play(begin(tab.state), tab, idsOf(tab, INITIATIVE));
    expect(run.state.cards[top]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).toContain("17007:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: pipe, effectId: "17007:response:1" }, tab.ctx);
    expect(run.state.cards[pipe]?.exhausted).toBe(true);
    expect(run.state.cards[top]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck.at(-1)).toBe(top);
  });

  // "from your deck": the other player's Taking Initiative discards from his own deck, and the first player's Pipe is not offered.
  it("17007:A:2 Dwarf Pipe: not offered for a card discarded from another player's deck", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: DWARF_HERO, seat: 0 }, { code: KAHLIEL, seat: 1 }], attached: [{ code: PIPE, host: DWARF_HERO }], hand: [{ code: INITIATIVE, seat: 1 }], playerDeck: [{ code: "card", seat: 1 }, { code: ALLY, seat: 1 }, { code: ALLY, seat: 0 }] });
    const run = sendUnledgered(begin({ ...tab.state, activeSeat: 1 }), { type: "PlayCard", cardId: idsOf(tab, INITIATIVE), payments: [] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, "card")]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).not.toContain("17007:response:1");
  });

  // An exhausted Pipe cannot pay its cost: the Response is not offered.
  it("17007:A:2 Dwarf Pipe: not offered while the Pipe is exhausted", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DWARF_HERO, seat: 0 }, { code: KAHLIEL, seat: 0 }], attached: [{ code: PIPE, host: DWARF_HERO }], hand: [{ code: INITIATIVE, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }, { code: ALLY, seat: 0 }] });
    const state = updateCard(tab.state, idsOf(tab, PIPE), { exhausted: true });
    const run = play(begin(state), tab, idsOf(tab, INITIATIVE));
    expect(triggers(run.state, tab)).not.toContain("17007:response:1");
  });
});

describe("Kahliel's Headdress (17010:A:1, A:2, A:3)", () => {
  // "Attach to Kahliel. Restricted.": Kahliel is offered; another Harad hero and a Harad ally are not.
  lineSpec("17010:A:1", "Kahliel's Headdress: Attach to Kahliel", (effects) => {
    const tab = table(effects, { heroes: [{ code: KAHLIEL, seat: 0 }, { code: HARAD_HERO, seat: 0 }], allies: [{ code: HARAD, seat: 0 }], hand: [{ code: HEADDRESS, seat: 0 }] });
    const headdress = idsOf(tab, HEADDRESS);
    expect(hosts(tab, headdress)).toEqual([idsOf(tab, KAHLIEL)]);
    expect(play(begin(tab.state), tab, headdress, idsOf(tab, KAHLIEL)).state.cards[headdress]?.host).toBe(idsOf(tab, KAHLIEL));
  });

  // "Each Harad character gets +1 Willpower.": played on Kahliel, it gives +1 to Kahliel, the Harad ally and the other player's Harad
  // hero, and nothing to the Pal (not Harad).
  lineSpec("17010:A:2", "Kahliel's Headdress: each Harad character gets +1 Willpower", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: KAHLIEL, seat: 0 }, { code: PAL, seat: 0 }, { code: HARAD_HERO, seat: 1 }], allies: [{ code: HARAD, seat: 0 }], hand: [{ code: HEADDRESS, seat: 0 }] });
    const [kahliel, pal, other, ally] = [idsOf(tab, KAHLIEL), idsOf(tab, PAL), idsOf(tab, HARAD_HERO), idsOf(tab, HARAD)];
    const run = play(begin(tab.state), tab, idsOf(tab, HEADDRESS), kahliel);
    expect(stat(run.state, tab, kahliel, "willpower")).toBe(2 + 1);
    expect(stat(run.state, tab, ally, "willpower")).toBe(1 + 1);
    expect(stat(run.state, tab, other, "willpower")).toBe(1 + 1);
    expect(stat(run.state, tab, pal, "willpower")).toBe(1);
  });

  // The Headdress on Kahliel, a deck of three different cards, and the discard pile given (the last row on top).
  function refreshed(effects: readonly Effect[], pile: readonly string[]): { tab: Table; ids: string[]; deck: readonly string[] } {
    const scene = table(effects, { heroes: [{ code: KAHLIEL, seat: 0 }], attached: [{ code: HEADDRESS, host: KAHLIEL }], playerDeck: [{ code: "card", seat: 0 }, { code: PAL, seat: 0 }, { code: "plain", seat: 0 }] });
    const { tab, ids } = discarded(scene, pile.map((code) => [code, 0] as const));
    return { tab, ids, deck: tab.state.seats[0]?.deck ?? [] };
  }

  // "Refresh Action: Exhaust Kahliel's Headdress to shuffle the topmost Harad ally in your discard pile into your deck.": a plain ally,
  // a Harad ally and a second Harad ally on top. In the planning phase it is not offered; in the refresh phase the Headdress is
  // exhausted, the top Harad ally goes into the deck and the deck is shuffled; the Harad ally under it stays in the discard pile.
  lineSpec("17010:A:3", "Kahliel's Headdress: exhaust it in the refresh phase to shuffle the topmost Harad ally into the deck", (effects) => {
    const { tab, ids: [plain = "", lower = "", topmost = ""], deck } = refreshed(effects, [ALLY, HARAD, SCOUT]);
    const headdress = idsOf(tab, HEADDRESS);
    expect(triggers(tab.state, tab)).not.toContain("17010:action:1");
    let run = enter(tab.state, tab, "refresh");
    expect(triggers(run.state, tab)).toContain("17010:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: headdress, effectId: "17010:action:1" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[headdress]?.exhausted).toBe(true);
    expect(run.state.cards[topmost]?.zone).toBe("deck");
    expect(run.state.cards[lower]?.zone).toBe("discard");
    expect(run.state.cards[plain]?.zone).toBe("discard");
    const after = run.state.seats[0]?.deck ?? [];
    expect([...after].sort()).toEqual([...deck, topmost].sort());
    // Shuffled: the cards that were in the deck are not in their old order with the ally on the top or the bottom.
    expect([[topmost, ...deck], [...deck, topmost]]).not.toContainEqual(after);
  });

  lineSpec("17010:A:3", "Kahliel's Headdress: the topmost Harad ally under a plain ally is shuffled in", (effects) => {
    const { tab, ids: [lower = "", topmost = ""] } = refreshed(effects, [HARAD, SCOUT, ALLY]);
    let run = enter(tab.state, tab, "refresh");
    expect(triggers(run.state, tab)).toContain("17010:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, HEADDRESS), effectId: "17010:action:1" }, tab.ctx);
    expect(run.state.cards[topmost]?.zone).toBe("deck");
    expect(run.state.cards[lower]?.zone).toBe("discard");
  });

  // With no Harad ally in the discard pile there is nothing to shuffle in: not offered.
  it("17010:A:3 Kahliel's Headdress: not offered without a Harad ally in the discard pile", () => {
    const scene = table(EFFECTS, { heroes: [{ code: KAHLIEL, seat: 0 }], attached: [{ code: HEADDRESS, host: KAHLIEL }] });
    const { tab } = discarded(scene, [[ALLY, 0]]);
    expect(triggers(enter(tab.state, tab, "refresh").state, tab)).not.toContain("17010:action:1");
  });
});
