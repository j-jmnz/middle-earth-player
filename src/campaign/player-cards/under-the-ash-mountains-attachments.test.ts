// Rules: rr.attachment-cards, rr.modifiers, bts.valour, wor.guarded-x, rr.guarded, rr.staging-area, rr.step-1-3, rr.hit-points,
// mec109.the-one-ring, rr.explored (data/rules/entries.json).
// The Under the Ash Mountains attachments, written from their card text (data/cards/UtAM.json; data/printed holds no ledger for this pack,
// so the lines are the text of data/cards and every intent goes through sendUnledgered): Valiant Sword 22083:A:1 and A:3, Stone of Elostirion
// 22084:A:1 and A:2, Well Preserved 22085:A:1 and A:2. The heroes, allies, events and contract are in under-the-ash-mountains.test.ts.
import { beforeAll, describe, expect } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withThreat } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, FRODO, idsOf, RING, type Table } from "../../../test/harness/scene.ts";
import { choices, enter, fillers, hosts, passAll, passWhile, play, playerTableFor, printed, questing, sendUnledgered, stat } from "../../../test/harness/player-table.ts";

const SWORD = "22083";
const STONE = "22084";
const PRESERVED = "22085";
// Ring of Barahir: an Artifact attachment with the Ring trait that is not The One Ring.
const BARAHIR = "06007";
// Core Aragorn and Théodred (Leadership, Noble), Beravor (Lore, not Noble).
const ARAGORN = "01001";
const THEODRED = "01002";
const BERAVOR = "01012";
const CARD = "card";
// A Leadership Noble ally with no text.
const NOBLE_ALLY = "noble-ally";
// A Lore hero of Willpower 9 with no text, to quest and pay.
const STRIDER = "strider";
// A location of 2 quest points and threat 1.
const PLACE = "place";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([SWORD, STONE, PRESERVED, BARAHIR, ARAGORN, THEODRED, BERAVOR]))]);
  cards.set(NOBLE_ALLY, definePrinted({ code: NOBLE_ALLY, name: "Noble Ally", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Noble"] }));
  cards.set(STRIDER, definePrinted({ code: STRIDER, name: "Strider", type: "hero", sphere: "lore", threat: 9, willpower: 9, attack: 1, defense: 1, health: 5 }));
  cards.set(PLACE, definePrinted({ code: PLACE, name: "Place", type: "location", threat: 1, questPoints: 2 }));
  base = { ...starter, cards };
});

describe("Valiant Sword (22083:A:1, A:3)", () => {
  // Aragorn and Théodred (Noble heroes), Beravor and the Noble ally; two Swords in hand; the threat at `threat`.
  const swords = (effects: readonly Effect[], threat: number): Table => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: NOBLE_ALLY, seat: 0 }], hand: [{ code: SWORD, seat: 0 }, { code: SWORD, seat: 0 }] });
    return { ...tab, state: withThreat(tab.state, 0, threat) };
  };

  // "Attach to a Noble hero. Limit 1 per hero. ... Attached hero gets +1 Attack (+2 Attack if your threat is 40 or higher).": Aragorn and
  // Théodred are offered, Beravor and the Noble ally are not; at threat 39 Aragorn has his Attack + 1, and the second Sword is offered only
  // Théodred. At threat 40 the Sword gives +2.
  lineSpec("22083:A:3", "Valiant Sword: on a Noble hero, limit 1 per hero, +1 Attack, +2 at threat 40", (effects) => {
    const tab = swords(effects, 39);
    const [first = "", second = ""] = tab.ids[SWORD] ?? [];
    const [aragorn, theodred] = [idsOf(tab, ARAGORN), idsOf(tab, THEODRED)];
    expect(hosts(tab, first)).toEqual([aragorn, theodred].sort());
    const run = play(begin(tab.state), tab, first, aragorn);
    expect(stat(run.state, tab, aragorn, "attack")).toBe(printed(tab, ARAGORN, "attack") + 1);
    expect(hosts(tab, second, run.state)).toEqual([theodred]);
    const high = swords(effects, 40);
    const valour = play(begin(high.state), high, high.ids[SWORD]?.[0] ?? "", idsOf(high, ARAGORN));
    expect(stat(valour.state, high, idsOf(high, ARAGORN), "attack")).toBe(printed(high, ARAGORN, "attack") + 2);
  });
});

describe("Stone of Elostirion (22084:A:1, A:2)", () => {
  // "Guarded (location).": played, it goes to the staging area side: the encounter deck is discarded down to the first location, which is
  // added to the staging area with the Stone attached (wor.guarded-x). The Strider travels to the location and quests on it: it is
  // explored, and the Stone, free of encounters, is put into play on a hero the player picks.
  lineSpec("22084:A:1", "Stone of Elostirion: guarded by a location, then put into play on a hero once it is explored", (effects) => {
    const tab = table(effects, { heroes: [{ code: STRIDER, seat: 0 }, { code: BERAVOR, seat: 0 }], hand: [{ code: STONE, seat: 0 }], deck: ["f0", PLACE, "f0", "f0", "f0"] });
    const [stone, place, strider] = [idsOf(tab, STONE), idsOf(tab, PLACE), idsOf(tab, STRIDER)];
    expect(hosts(tab, stone)).toEqual(["staging"]);
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: stone, hostId: "staging", payments: [{ heroId: strider, amount: 1 }] }, tab.ctx);
    expect(run.state.staging).toEqual([place]);
    expect(run.state.encounterDiscard).toEqual([tab.ids.f0?.[0]]);
    expect(run.state.cards[stone]).toMatchObject({ zone: "setAside", host: place });
    run = enter(run.state, tab, "travel");
    run = sendUnledgered(run, { type: "Travel", locationId: place }, tab.ctx);
    expect(run.state.activeLocation).toBe(place);
    run = sendUnledgered(begin(questing(run.state)), { type: "Commit", cardIds: [strider] }, tab.ctx);
    run = passWhile(run, tab, (run) => run.state.mode === "questCommit", 4);
    run = passAll(run, tab.ctx, { responses: true });
    expect(run.state.cards[place]?.zone).toBe("encounterDiscard");
    expect(choices(run.state, tab).sort()).toEqual([strider, idsOf(tab, BERAVOR)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, BERAVOR) }, tab.ctx);
    expect(run.state.cards[stone]).toMatchObject({ zone: "play", host: idsOf(tab, BERAVOR), controller: 0 });
  });

  // "Attach to a hero. Attached hero gets +2 Willpower. You draw 1 additional card during the resource phase.": Beravor holds the Stone
  // and has Willpower 1 + 2; in the resource phase the player draws 2 cards.
  lineSpec("22084:A:2", "Stone of Elostirion: +2 Willpower to the hero, 1 more card drawn in the resource phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], attached: [{ code: STONE, host: BERAVOR }], playerDeck: fillers(CARD, 4) });
    expect(stat(tab.state, tab, idsOf(tab, BERAVOR), "willpower")).toBe(printed(tab, BERAVOR, "willpower") + 2);
    const run = enter(tab.state, tab, "resourceGrant");
    expect(run.state.seats[0]?.hand).toHaveLength(2);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
  });
});

describe("Well Preserved (22085:A:1, A:2)", () => {
  // "Attach to the hero with The One Ring.": Frodo, who holds the Ring, is offered; Beravor (who pays) and Aragorn are not.
  lineSpec("22085:A:1", "Well Preserved: attach to the hero with The One Ring", (effects) => {
    const tab = table(effects, { ring: "ready", heroes: [{ code: FRODO, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: [{ code: PRESERVED, seat: 0 }] });
    const [preserved, frodo] = [idsOf(tab, PRESERVED), idsOf(tab, FRODO)];
    expect(tab.state.cards[idsOf(tab, RING)]?.host).toBe(frodo);
    expect(hosts(tab, preserved)).toEqual([frodo]);
    expect(play(begin(tab.state), tab, preserved, frodo).state.cards[preserved]?.host).toBe(frodo);
  });

  // "Attach to the hero with The One Ring.": Aragorn holds the Ring of Barahir (a Ring attachment that is not The One Ring) and is not a host.
  lineSpec("22085:A:1", "Well Preserved: a hero with another Ring attachment is not offered", (effects) => {
    const tab = table(effects, { ring: "ready", heroes: [{ code: FRODO, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: ARAGORN, seat: 0 }], attached: [{ code: BARAHIR, host: ARAGORN }], hand: [{ code: PRESERVED, seat: 0 }] });
    expect(tab.state.cards[idsOf(tab, BARAHIR)]?.host).toBe(idsOf(tab, ARAGORN));
    expect(hosts(tab, idsOf(tab, PRESERVED))).toEqual([idsOf(tab, FRODO)]);
  });

  // "Limit 1 per hero. Attached hero gets + 1 hit point.": played on Frodo, he has his printed hit points + 1, and the second copy has no
  // host.
  lineSpec("22085:A:2", "Well Preserved: limit 1 per hero, +1 hit point", (effects) => {
    const tab = table(effects, { ring: "ready", heroes: [{ code: FRODO, seat: 0 }, { code: BERAVOR, seat: 0 }], hand: [{ code: PRESERVED, seat: 0 }, { code: PRESERVED, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[PRESERVED] ?? [];
    const frodo = idsOf(tab, FRODO);
    const run = play(begin(tab.state), tab, first, frodo);
    expect(stat(run.state, tab, frodo, "hitPoints")).toBe(printed(tab, FRODO, "health") + 1);
    expect(hosts(tab, second, run.state)).toEqual([]);
  });
});
