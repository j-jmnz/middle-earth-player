// Rules: rr.attachment-cards, rr.ranged, rr.restricted, rr.action, rr.response, rr.step-3-4, rr.step-6-8-2 (data/rules/entries.json).
// The On the Doorstep attachments, written from their card text (data/cards/OtD.json; data/printed holds no ledger for this box yet):
// Great Yew Bow 132014:A:1 and A:2, Black Arrow 132015:A:1, Thrór's Key 132016:A:1, Expert Treasure-hunter 132017:A:1 and A:2,
// King Under the Mountain 132018:A:1 and A:2.
import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { copyCapRule } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, choices, combat, hosts, passAll, playerTable, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const BARD = "132003";
const YEW = "132014";
const ARROW = "132015";
const KEY = "132016";
const HUNTER = "132017";
const KING = "132018";
// Legolas: a Tactics hero with the printed ranged keyword.
const LEGOLAS = "01005";
// Dúnedain Cache: "Attach to a hero. Attached hero gains ranged."
const CACHE = "02097";
const DWARF_HERO = "dwarf-hero";
const DWARF = "dwarf";
// An ally with the printed ranged keyword.
const ARCHER = "archer";
const ALLY = "ally";
const PAL = "pal";
// An enemy whose Defense lets the damage of an attack be read.
const SOFT = "soft";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([BARD, YEW, ARROW, KEY, HUNTER, KING, LEGOLAS, CACHE]))]);
  cards.set(DWARF_HERO, definePrinted({ code: DWARF_HERO, name: "Dwarf Lord", type: "hero", sphere: "leadership", threat: 9, willpower: 2, attack: 1, defense: 1, health: 4, traits: ["Dwarf"] }));
  cards.set(DWARF, definePrinted({ code: DWARF, name: "Dwarf", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dwarf"] }));
  cards.set(ARCHER, definePrinted({ code: ARCHER, name: "Archer", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 2, defense: 1, health: 2, keywords: { ranged: true } }));
  cards.set(SOFT, definePrinted({ code: SOFT, name: "Soft", type: "enemy", threat: 0, engagementCost: 50, attack: 1, defense: 1, health: 9 }));
  base = { ...starter, cards };
});

describe("Ranged hosts (132014:A:1, 132015:A:1)", () => {
  // Legolas and Bard (printed ranged heroes), the Pal (a hero that gains ranged from Dúnedain Cache), a Dwarf hero without ranged and
  // the Archer (an ally with printed ranged); the attachment under test is in hand.
  function scene(effects: readonly Effect[], code: string): Table {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: BARD, seat: 0 }, { code: PAL, seat: 0 }, { code: DWARF_HERO, seat: 0 }], allies: [{ code: ARCHER, seat: 0 }], attached: [{ code: CACHE, host: PAL }], hand: [{ code, seat: 0 }] });
    expect(tab.state.cards[idsOf(tab, CACHE)]?.host).toBe(idsOf(tab, PAL));
    return tab;
  }

  // "Attach to a hero with the printed Ranged keyword.": Legolas and Bard; not the Pal, whose ranged is gained, nor the Archer, an ally.
  lineSpec("132014:A:1", "Great Yew Bow: goes on a hero with printed ranged, not on one that gains it or on a ranged ally", (effects) => {
    const tab = scene(effects, YEW);
    expect(hosts(tab, idsOf(tab, YEW))).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, BARD)].sort());
  });

  // "Attach to a hero with Ranged.": printed or gained, so the Pal too; not the Archer, an ally, nor the Dwarf hero.
  lineSpec("132015:A:1", "Black Arrow: goes on a hero with ranged, printed or gained, and not on a ranged ally", (effects) => {
    const tab = scene(effects, ARROW);
    expect(hosts(tab, idsOf(tab, ARROW))).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, BARD), idsOf(tab, PAL)].sort());
  });

  // "Limit 1 per deck.": the deck check reads the deck limit of data/cards, so the record changes nothing it shows (no lineSpec).
  it("132015:A:1 Black Arrow: a deck holds at most 1 copy", () => {
    const cards: unknown = JSON.parse(readFileSync(new URL("../../../data/cards/OtD.json", import.meta.url), "utf8"));
    const row = Array.isArray(cards) ? (cards as { code: string; deckLimit: number | null }[]).find((card) => card.code === ARROW) : undefined;
    expect(copyCapRule(1, row?.deckLimit ?? null)).toBeNull();
    expect(copyCapRule(2, row?.deckLimit ?? null)).toBe("Deck limit is 1.");
  });
});

describe("Great Yew Bow (132014:A:2)", () => {
  // Legolas holds the Bow; an enemy is in the staging area, another engaged with the player.
  function scene(effects: readonly Effect[]): Table {
    return table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 0 }], allies: [{ code: ARCHER, seat: 0 }], attached: [{ code: YEW, host: LEGOLAS }], staging: [SOFT], engaged: [{ code: SOFT, seat: 0 }] });
  }

  // "Combat Action: Choose an enemy in the staging area. Exhaust Great Yew Bow and attached hero to make a ranged attack against that
  // enemy. Declare attached hero as the attacker. No other attackers can be declared for this attack.": only the staged enemy is
  // offered; the Bow and Legolas exhaust, and Legolas alone strikes it (the ready Archer is not added) for his Attack less its Defense.
  lineSpec("132014:A:2", "exhausts with the hero to make his attack against an enemy in the staging area", (effects) => {
    const tab = scene(effects);
    const [staged, engaged] = tab.ids[SOFT] ?? [];
    const legolas = idsOf(tab, LEGOLAS);
    const yew = idsOf(tab, YEW);
    let run = combat(tab.state, tab);
    expect(triggers(run.state, tab)).toContain("132014:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: yew, effectId: "132014:action:1" }, tab.ctx);
    if (run.state.window?.kind === "choose") {
      expect(choices(run.state, tab)).toEqual([staged]);
      run = sendUnledgered(run, { type: "Choose", optionId: staged ?? "" }, tab.ctx);
    }
    expect(run.state.cards[yew]?.exhausted).toBe(true);
    expect(run.state.cards[legolas]?.exhausted).toBe(true);
    run = passAll(run, tab.ctx, { responses: true });
    const strikes = run.steps.flatMap((step) => (step.kind === "strike" && step.side === "player" ? [step] : []));
    expect(strikes).toHaveLength(1);
    expect(run.state.cards[staged ?? ""]?.damage).toBe((tab.ctx.cards.get(LEGOLAS)?.attack ?? 0) - 1);
    expect(run.state.cards[staged ?? ""]?.zone).toBe("staging");
    expect(run.state.cards[engaged ?? ""]?.damage).toBe(0);
  });

  // The Bow's attack is a ranged attack, so Bard the Bowman's own line applies (132003:A:2: "When Bard the Bowman makes a ranged attack,
  // the enemy he attacks gets -2 Defense"): the staged enemy's Defense 1 falls to 0 and it takes all of Bard's Attack.
  it("132014:A:2 with Bard the Bowman: his attack with the Bow is a ranged attack", () => {
    const tab = table(EFFECTS, { heroes: [{ code: BARD, seat: 0 }, { code: PAL, seat: 0 }], attached: [{ code: YEW, host: BARD }], staging: [SOFT] });
    const soft = idsOf(tab, SOFT);
    let run = sendUnledgered(combat(tab.state, tab), { type: "Trigger", cardId: idsOf(tab, YEW), effectId: "132014:action:1" }, tab.ctx);
    if (run.state.window?.kind === "choose") run = sendUnledgered(run, { type: "Choose", optionId: soft }, tab.ctx);
    run = passAll(run, tab.ctx, { responses: true });
    expect(run.state.cards[soft]?.damage).toBe(tab.ctx.cards.get(BARD)?.attack ?? 0);
  });

  // "Combat Action": not in the planning phase; and with no enemy in the staging area there is nothing to choose.
  it("132014:A:2 is offered only in the combat phase with an enemy in the staging area", () => {
    const tab = scene(EFFECTS);
    expect(triggers(tab.state, tab)).not.toContain("132014:action:1");
    const empty = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 0 }], attached: [{ code: YEW, host: LEGOLAS }], engaged: [{ code: SOFT, seat: 0 }] });
    expect(triggers(combat(empty.state, empty).state, empty)).not.toContain("132014:action:1");
  });
});

describe("Thrór's Key (132016:A:1)", () => {
  // "Attach to a hero."
  lineSpec("132016:A:1", "goes on a hero and not on an ally", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: DWARF_HERO, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: KEY, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, KEY))).toEqual([idsOf(tab, PAL), idsOf(tab, DWARF_HERO)].sort());
  });
});

describe("Expert Treasure-hunter (132017:A:1, A:2)", () => {
  // "Attach to a hero. Limit 1 per hero.": the Pal, who holds one already, and the ally are not offered.
  lineSpec("132017:A:1", "goes on a hero, one per hero, and not on an ally", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: DWARF_HERO, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], attached: [{ code: HUNTER, host: PAL }], hand: [{ code: HUNTER, seat: 0 }] });
    const held = tab.ids[HUNTER]?.find((id) => tab.state.cards[id]?.zone === "hand") ?? "";
    expect(hosts(tab, held)).toEqual([idsOf(tab, DWARF_HERO)]);
  });

  // The Dwarf hero holds the Hunter; `commit` heroes commit to a quest with no threat against them, and the quest resolves.
  function quested(effects: readonly Effect[], commit: readonly string[], top: string): { tab: Table; run: Run } {
    const tab = table(effects, { start: "quest", heroes: [{ code: DWARF_HERO, seat: 0 }, { code: PAL, seat: 0 }], attached: [{ code: HUNTER, host: DWARF_HERO }], playerDeck: [{ code: top, seat: 0 }, { code: "card", seat: 0 }] });
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: commit.map((code) => idsOf(tab, code)) }, tab.ctx);
    for (let guard = 0; guard < 20 && !triggers(run.state, tab).includes("132017:response:1") && run.state.mode !== "travel" && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) {
      run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    }
    return { tab, run };
  }

  // "Response: After attached hero quests successfully, name a card type and discard the top card of your deck. If the discarded card is
  // the named type, take it into your hand.": named ally, the top card (an ally) is discarded and taken into the hand; named event, it
  // stays in the discard pile.
  function hunted(effects: readonly Effect[]): void {
    for (const [named, zone] of [["ally", "hand"], ["event", "discard"]] as const) {
      const { tab, run: quest } = quested(effects, [DWARF_HERO], ALLY);
      const top = idsOf(tab, ALLY);
      expect(triggers(quest.state, tab)).toContain("132017:response:1");
      let run = sendUnledgered(quest, { type: "Trigger", cardId: idsOf(tab, HUNTER), effectId: "132017:response:1" }, tab.ctx);
      run = sendUnledgered(run, { type: "Choose", optionId: named }, tab.ctx);
      if (run.state.window?.kind === "choose" && choices(run.state, tab).includes(top)) run = sendUnledgered(run, { type: "Choose", optionId: top }, tab.ctx);
      expect(run.state.cards[top]?.zone).toBe(zone);
      expect(run.state.seats[0]?.deck).toHaveLength(1);
    }
  }

  // The quest resolves and clears the live committed marks before the Response is read; the round's record of who quested answers (rr.step-3-4).
  lineSpec("132017:A:2", "after the hero quests successfully, the top card goes to the hand if it is the type named", (effects) => hunted(effects));

  // The quest succeeds, but the attached hero did not commit: no Response.
  it("132017:A:2 is not offered when the attached hero did not quest", () => {
    const { tab, run } = quested(EFFECTS, [PAL], ALLY);
    expect(run.state.mode === "travel" || run.state.mode === "resolution" || run.state.mode === "staging").toBe(true);
    expect(triggers(run.state, tab)).not.toContain("132017:response:1");
  });
});

describe("King Under the Mountain (132018:A:1, A:2)", () => {
  // "Attach to a Dwarf hero.": the Dwarf hero; not the Pal (not a Dwarf), nor the Dwarf ally.
  lineSpec("132018:A:1", "goes on a Dwarf hero, not on another hero or on a Dwarf ally", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: DWARF_HERO, seat: 0 }], allies: [{ code: DWARF, seat: 0 }], hand: [{ code: KING, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, KING))).toEqual([idsOf(tab, DWARF_HERO)]);
  });

  // "Action: Exhaust King Under the Mountain to look at the top 2 cards of your deck. Add 1 to your hand and discard the other.": the
  // second card goes to the hand, the first to the discard pile, the third stays on top; the King is exhausted and not offered again.
  lineSpec("132018:A:2", "exhausts to take 1 of the top 2 cards into the hand and discard the other", (effects) => {
    const scene = table(effects, { heroes: [{ code: DWARF_HERO, seat: 0 }], attached: [{ code: KING, host: DWARF_HERO }], playerDeck: [{ code: "card", seat: 0 }, { code: ALLY, seat: 0 }, { code: DWARF, seat: 0 }] });
    const tab = attach(scene, []);
    const [first, second, third] = [idsOf(tab, "card"), idsOf(tab, ALLY), idsOf(tab, DWARF)];
    const king = idsOf(tab, KING);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: king, effectId: "132018:action:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([first, second].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: second }, tab.ctx);
    if (run.state.window?.kind === "choose") run = sendUnledgered(run, { type: "Choose", optionId: first }, tab.ctx);
    expect(run.state.cards[second]?.zone).toBe("hand");
    expect(run.state.cards[first]?.zone).toBe("discard");
    expect(run.state.seats[0]?.deck).toEqual([third]);
    expect(run.state.cards[king]?.exhausted).toBe(true);
    expect(triggers(run.state, tab)).not.toContain("132018:action:1");
  });

  it("132018:A:2 is not offered while the King is exhausted", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DWARF_HERO, seat: 0 }], attached: [{ code: KING, host: DWARF_HERO }], playerDeck: [{ code: "card", seat: 0 }, { code: ALLY, seat: 0 }] });
    expect(triggers(updateCard(tab.state, idsOf(tab, KING), { exhausted: true }), tab)).not.toContain("132018:action:1");
  });
});
