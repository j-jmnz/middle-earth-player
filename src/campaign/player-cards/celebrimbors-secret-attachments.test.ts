// Rules: rr.action, rr.limits, rr.then, rr.search, rr.triggered-ability, rr.attachment-cards, rr.resource-match, rr.lasting-effects
// (data/rules/entries.json).
// Celebrimbor's Secret attachments, each printed line tested from the words on the card (data/cards/CS.json: data/printed holds no
// ledger for this pack, so the lines are the text of data/cards): Heir of Mardil 08113:A:1, Mirror of Galadriel 08118:A:1 and A:2,
// Cloak of Lórien 08120:A:1 to A:3, Nenya 08121:A:1 and A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { updateCard } from "../../rules/core/state.ts";
import { reduce } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, choices, hosts, play, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ARAGORN = "01001";
const THEODRED = "01002";
const EOWYN = "01007";
const FARAMIR = "01014";
const AXE = "01041";
const FOREST_ROAD = "01099";
const BAG_END = "141031";
const GALADRIEL = "08112";
const HEIR = "08113";
const OROPHIN = "08114";
const HANDMAIDEN = "08117";
const MIRROR = "08118";
const ENT = "08119";
const CLOAK = "08120";
const NENYA = "08121";
const ALLY = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARAGORN, THEODRED, EOWYN, FARAMIR, AXE, FOREST_ROAD, BAG_END, GALADRIEL, HEIR, OROPHIN, HANDMAIDEN, MIRROR, ENT, CLOAK, NENYA];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  base = { ...starter, cards };
});

const printed = (tab: Table, code: string, which: "attack" | "defense" | "willpower"): number => tab.ctx.cards.get(code)?.[which] ?? 0;

describe("Heir of Mardil (08113:A:1)", () => {
  // "Attach to a Noble hero.": Galadriel, Aragorn and the other player's Théodred (Noble heroes) are offered; Faramir (a Noble ally)
  // and the Handmaiden (an ally, not Noble) are not.
  lineSpec("08113:A:1", "Heir of Mardil: Attach to a Noble hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: GALADRIEL, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 1 }], allies: [{ code: FARAMIR, seat: 0 }, { code: HANDMAIDEN, seat: 0 }], hand: [{ code: HEIR, seat: 0 }] });
    const heir = idsOf(tab, HEIR);
    expect(hosts(tab, heir)).toEqual([GALADRIEL, ARAGORN, THEODRED].map((code) => idsOf(tab, code)).sort());
    const run = play(begin(tab.state), tab, heir, idsOf(tab, ARAGORN));
    expect(run.state.cards[heir]?.host).toBe(idsOf(tab, ARAGORN));
  });

  // A hero without the Noble trait (the stand-in Pal, a Hobbit) is not offered.
  lineSpec("08113:A:1", "Heir of Mardil: not on a hero without the Noble trait", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: "pal", seat: 0 }], hand: [{ code: HEIR, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, HEIR))).toEqual([idsOf(tab, ARAGORN)]);
  });
});

describe("Mirror of Galadriel (08118)", () => {
  // "Attach to Galadriel.": Galadriel is offered; Éowyn and an ally are not.
  lineSpec("08118:A:1", "Mirror of Galadriel: Attach to Galadriel", (effects) => {
    const tab = table(effects, { heroes: [{ code: GALADRIEL, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: MIRROR, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, MIRROR))).toEqual([idsOf(tab, GALADRIEL)]);
  });

  // "Action: Exhaust Mirror of Galadriel to search the top 10 cards of your deck for a card and add it to your hand. Shuffle the rest
  // back into your deck. Then, discard a random card from your hand.": the Axe (fourth) is taken, Unexpected Courage lies eleventh and
  // is no choice; one of the two cards in hand is then discarded.
  lineSpec("08118:A:2", "Mirror of Galadriel: take a card from the top 10 into your hand, shuffle, then discard a random card from your hand", (effects) => {
    const deck = [...Array.from({ length: 3 }, () => ({ code: "card", seat: 0 })), { code: AXE, seat: 0 }, ...Array.from({ length: 6 }, () => ({ code: "card", seat: 0 })), { code: "01057", seat: 0 }];
    const tab = table(effects, { heroes: [{ code: GALADRIEL, seat: 0 }], attached: [{ code: MIRROR, host: GALADRIEL }], hand: [{ code: ALLY, seat: 0 }], playerDeck: deck });
    const [mirror, axe, courage, ally] = [idsOf(tab, MIRROR), idsOf(tab, AXE), idsOf(tab, "01057"), idsOf(tab, ALLY)];
    const cursor = tab.state.seedCursor;
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: mirror, effectId: "08118:action:1" }, tab.ctx);
    expect(run.state.cards[mirror]?.exhausted).toBe(true);
    expect(choices(run.state, tab)).toContain(axe);
    expect(choices(run.state, tab)).not.toContain(courage);
    run = sendUnledgered(run, { type: "Choose", optionId: axe }, tab.ctx);
    expect(run.state.seats[0]?.deck).toHaveLength(10);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
    expect(run.state.seats[0]?.discard).toHaveLength(1);
    expect([...(run.state.seats[0]?.hand ?? []), ...(run.state.seats[0]?.discard ?? [])].sort()).toEqual([axe, ally].sort());
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });

  // rr.then: with no card to find the search does not resolve, so the random discard after "Then" does not either, and the Action
  // cannot change the game state on its own (rr.triggered-ability).
  const empty = () => table(EFFECTS, { heroes: [{ code: GALADRIEL, seat: 0 }], attached: [{ code: MIRROR, host: GALADRIEL }], hand: [{ code: ALLY, seat: 0 }] });
  it("08118:A:2 Mirror of Galadriel: with an empty deck the Action is not offered", () => {
    const tab = empty();
    expect(triggers(tab.state, tab)).not.toContain("08118:action:1");
  });

  // Used anyway, the Action is refused and the only card in the hand stays there.
  it("08118:A:2 Mirror of Galadriel: a search that finds nothing discards nothing from the hand", () => {
    const tab = empty();
    const result = reduce(tab.state, { type: "Trigger", cardId: idsOf(tab, MIRROR), effectId: "08118:action:1" }, tab.ctx);
    expect(result.ok).toBe(false);
    expect(tab.state.seats[0]?.hand).toEqual([idsOf(tab, ALLY)]);
    expect(tab.state.seats[0]?.discard).toEqual([]);
    expect(tab.state.cards[idsOf(tab, MIRROR)]?.exhausted).toBe(false);
  });
});

describe("Cloak of Lórien (08120)", () => {
  // "Attach to a Noldor or Silvan character.": Galadriel (Noldor hero), the Handmaiden (Silvan ally) and the other player's Orophin
  // (Silvan ally) are offered; Aragorn and a plain ally are not.
  lineSpec("08120:A:1", "Cloak of Lórien: Attach to a Noldor or Silvan character", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: GALADRIEL, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 1 }], allies: [{ code: HANDMAIDEN, seat: 0 }, { code: ALLY, seat: 0 }, { code: OROPHIN, seat: 1 }], hand: [{ code: CLOAK, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, CLOAK))).toEqual([GALADRIEL, HANDMAIDEN, OROPHIN].map((code) => idsOf(tab, code)).sort());
  });

  // "Limit 1 per character.": the Handmaiden, who already wears a Cloak, is not offered a second.
  lineSpec("08120:A:2", "Cloak of Lórien: Limit 1 per character", (effects) => {
    const scene = table(effects, { heroes: [{ code: GALADRIEL, seat: 0 }], allies: [{ code: HANDMAIDEN, seat: 0 }, { code: CLOAK, seat: 0 }], hand: [{ code: CLOAK, seat: 0 }] });
    const [worn, held] = scene.ids[CLOAK] ?? [];
    const tab = attach(scene, [[worn ?? "", idsOf(scene, HANDMAIDEN)]]);
    expect(hosts(tab, held ?? "")).toEqual([idsOf(tab, GALADRIEL)]);
  });

  // "Attached character gets +1 Defense (+2 Defense instead if the active location has the Forest trait).": +1 with no active location
  // and with Bag End (Shire), +2 (not +3) with Old Forest Road (Forest).
  lineSpec("08120:A:3", "Cloak of Lórien: +1 Defense, +2 instead while the active location is a Forest", (effects) => {
    const defense = (active?: string): number => {
      const tab = table(effects, { heroes: [{ code: GALADRIEL, seat: 0 }], attached: [{ code: CLOAK, host: GALADRIEL }], ...(active ? { active } : {}) });
      return stat(tab.state, tab, idsOf(tab, GALADRIEL), "defense");
    };
    const own = base.cards.get(GALADRIEL)?.defense ?? 0;
    expect(defense()).toBe(own + 1);
    expect(defense(BAG_END)).toBe(own + 1);
    expect(defense(FOREST_ROAD)).toBe(own + 2);
  });
});

describe("Nenya (08121)", () => {
  // "Attach to Galadriel. She gains a Lore resource icon.": only Galadriel is offered; with Nenya she alone pays for the Wandering Ent
  // (Lore).
  lineSpec("08121:A:1", "Nenya: Attach to Galadriel, who gains a Lore resource icon", (effects) => {
    const held = table(effects, { heroes: [{ code: GALADRIEL, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: NENYA, seat: 0 }] });
    expect(hosts(held, idsOf(held, NENYA))).toEqual([idsOf(held, GALADRIEL)]);
    const tab = table(effects, { heroes: [{ code: GALADRIEL, seat: 0 }], attached: [{ code: NENYA, host: GALADRIEL }], hand: [{ code: ENT, seat: 0 }] });
    const ent = idsOf(tab, ENT);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: ent, payments: [{ heroId: idsOf(tab, GALADRIEL), amount: 2 }] }, tab.ctx);
    expect(run.state.cards[ent]?.zone).toBe("play");
  });

  // "Quest Action: Exhaust Nenya and Galadriel to add her Willpower to another character's Willpower until the end of the phase.":
  // Éowyn gets Galadriel's 4 Willpower; Galadriel herself is no choice, Éowyn and the ally are.
  lineSpec("08121:A:2", "Nenya: exhaust Nenya and Galadriel to add her Willpower to another character's", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: GALADRIEL, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: NENYA, host: GALADRIEL }], allies: [{ code: ALLY, seat: 0 }] });
    const [nenya, galadriel, eowyn] = [idsOf(tab, NENYA), idsOf(tab, GALADRIEL), idsOf(tab, EOWYN)];
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: nenya, effectId: "08121:action:1" }, tab.ctx);
    for (let guard = 0; guard < 3 && run.state.window?.kind === "choose" && choices(run.state, tab).includes(galadriel) && !choices(run.state, tab).includes(eowyn); guard += 1) run = sendUnledgered(run, { type: "Choose", optionId: galadriel }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([eowyn, idsOf(tab, ALLY)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: eowyn }, tab.ctx);
    expect(stat(run.state, tab, eowyn, "willpower")).toBe(printed(tab, EOWYN, "willpower") + printed(tab, GALADRIEL, "willpower"));
    expect(run.state.cards[nenya]?.exhausted).toBe(true);
    expect(run.state.cards[galadriel]?.exhausted).toBe(true);
  });

  it("08121:A:2 Nenya: not offered in the planning phase, nor while Galadriel is exhausted", () => {
    const planning = table(EFFECTS, { heroes: [{ code: GALADRIEL, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: NENYA, host: GALADRIEL }] });
    expect(triggers(planning.state, planning)).not.toContain("08121:action:1");
    const quest = table(EFFECTS, { start: "quest", heroes: [{ code: GALADRIEL, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: NENYA, host: GALADRIEL }] });
    expect(triggers(quest.state, quest)).toContain("08121:action:1");
    const tired = updateCard(quest.state, idsOf(quest, GALADRIEL), { exhausted: true });
    expect(triggers(tired, quest)).not.toContain("08121:action:1");
  });
});
