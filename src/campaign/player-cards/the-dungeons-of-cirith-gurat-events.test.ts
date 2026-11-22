// Rules: bts.valour, rr.action, rr.triggered-ability, rr.unique-cards, rr.engaged, rr.play-restrictions-and-permissions, rr.search
// (data/rules/entries.json).
// The Dungeons of Cirith Gurat events, written from their card text (data/cards/DoCG.json; data/printed holds no ledger for this pack, so
// every intent goes through sendUnledgered): Fierce Defense 17113:A:1 and A:2, Heirs of Earendil 17115:A:1, Open the Armory 17118:A:1 and
// A:2. The hero, allies and attachments are in the-dungeons-of-cirith-gurat.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withThreat } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, combat, playCode, playerTable, sendUnledgered } from "../../../test/harness/player-table.ts";

const FIERCE = "17113";
const HEIRS = "17115";
const ARMORY = "17118";
// Core: Aragorn (a unique Dúnedain hero), Legolas (Tactics), Éowyn (Spirit), Glorfindel (a unique Noldor hero), Son of Arnor (a non-unique
// Dúnedain ally), Blade of Gondolin and Dwarven Axe (Weapon attachments), Citadel Plate (an Armor attachment), Horn of Gondor (an Item
// attachment, neither).
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const GLORFINDEL = "01011";
const ARNOR = "01015";
const GONDOLIN = "01039";
const PLATE = "01040";
const AXE = "01041";
const HORN = "01042";
// Two non-unique enemies and a unique one, and a non-unique location.
const WEAK = "weak";
const GRUNT = "grunt";
const BOSS = "boss";
const MARSH = "marsh";
const PAL = "pal";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([FIERCE, HEIRS, ARMORY, ARAGORN, LEGOLAS, EOWYN, GLORFINDEL, ARNOR, GONDOLIN, PLATE, AXE, HORN]))]);
  for (const code of [WEAK, GRUNT]) cards.set(code, definePrinted({ code, name: code, type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  cards.set(BOSS, definePrinted({ code: BOSS, name: "Boss", type: "enemy", isUnique: true, threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  cards.set(MARSH, definePrinted({ code: MARSH, name: "Marsh", type: "location", threat: 1, questPoints: 3 }));
  base = { ...starter, cards };
});

const threatened = (tab: Table, threat: number): Table => ({ ...tab, state: withThreat(tab.state, 0, threat) });
const playable = (run: Run, tab: Table, code: string): boolean => legalIntents(run.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, code));

describe("Fierce Defense (17113:A:1, A:2)", () => {
  // Legolas (Tactics) pays 3. The Weak, the Grunt and the unique Boss are engaged with the first player (only the Boss when `bossOnly`), a
  // Weak with the second; the first player's threat is `threat`.
  function fierce(effects: readonly Effect[], threat: number, bossOnly = false): Table {
    const mine = bossOnly ? [BOSS] : [WEAK, GRUNT, BOSS];
    const scene = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: FIERCE, seat: 0 }], engaged: [...mine.map((code) => ({ code, seat: 0 })), { code: WEAK, seat: 1 }], deck: ["f0", "f0", "f0", "f0", "f0"] });
    return threatened(scene, threat);
  }
  const mine = (tab: Table): string[] => [tab.ids[WEAK]?.[0] ?? "", idsOf(tab, GRUNT)].sort();

  // "Combat Action: Deal 3 damage to a non-unique enemy engaged with you.": in the combat phase the Weak and the Grunt engaged with the
  // player are offered (not the unique Boss, not the other player's Weak); the Grunt takes 3 damage.
  lineSpec("17113:A:1", "Fierce Defense: in combat, deal 3 damage to a non-unique enemy engaged with you", (effects) => {
    const tab = fierce(effects, 8);
    const grunt = idsOf(tab, GRUNT);
    let run = playCode(tab, FIERCE, combat(tab.state, tab));
    expect(choices(run.state, tab).sort()).toEqual(mine(tab));
    run = sendUnledgered(run, { type: "Choose", optionId: grunt }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[grunt]?.damage).toBe(3);
    expect(run.state.cards[grunt]?.zone).toBe("engaged");
  });

  // "Combat Action": below threat 40 it is not played in the planning phase.
  it("17113:A:1 Fierce Defense: not played outside the combat phase below threat 40", () => {
    const tab = fierce(EFFECTS, 39);
    expect(playable(begin(tab.state), tab, FIERCE)).toBe(false);
  });

  // Only a unique enemy engaged with the player: there is no enemy to choose, so it is not played.
  it("17113:A:1 Fierce Defense: not played with only a unique enemy engaged", () => {
    const tab = fierce(EFFECTS, 8, true);
    expect(playable(combat(tab.state, tab), tab, FIERCE)).toBe(false);
  });

  // "Valour Action: Discard a non-unique enemy engaged with you.": at threat 40 in the planning phase, the Grunt is discarded.
  lineSpec("17113:A:2", "Fierce Defense: at threat 40, discard a non-unique enemy engaged with you", (effects) => {
    const tab = fierce(effects, 40);
    const grunt = idsOf(tab, GRUNT);
    let run = playCode(tab, FIERCE);
    expect(choices(run.state, tab).sort()).toEqual(mine(tab));
    run = sendUnledgered(run, { type: "Choose", optionId: grunt }, tab.ctx);
    expect(run.state.cards[grunt]?.zone).toBe("encounterDiscard");
  });

  // An event with an Action and a Valour Action uses one of them (bts.valour): at threat 40 in the combat phase the player chooses which,
  // and the Valour one discards the Weak with no damage dealt to the Grunt.
  it("17113:A:2 Fierce Defense: at threat 40 in combat, the player chooses one of the two effects", () => {
    const tab = fierce(EFFECTS, 40);
    const [weak, grunt] = [tab.ids[WEAK]?.[0] ?? "", idsOf(tab, GRUNT)];
    let run = playCode(tab, FIERCE, combat(tab.state, tab));
    expect(choices(run.state, tab).sort()).toEqual(mine(tab));
    run = sendUnledgered(run, { type: "Choose", optionId: weak }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual(["damage", "valour"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "valour" }, tab.ctx);
    expect(run.state.cards[weak]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[grunt]?.damage).toBe(0);
  });
});

describe("Heirs of Earendil (17115:A:1)", () => {
  // Éowyn (Spirit) pays 1; Glorfindel (a unique Noldor hero) and `dunedain` are in play; the Marsh (non-unique) is in the staging area.
  const heirs = (effects: readonly Effect[], dunedain: "hero" | "ally"): Table =>
    table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: GLORFINDEL, seat: 0 }, ...(dunedain === "hero" ? [{ code: ARAGORN, seat: 0 }] : [])], allies: dunedain === "ally" ? [{ code: ARNOR, seat: 0 }] : [], hand: [{ code: HEIRS, seat: 0 }], staging: [MARSH] });

  // "Play only if you control a unique character with the Noldor trait and another unique character with the Dúnedain trait.": with the
  // Son of Arnor (a non-unique Dúnedain ally) it cannot be played; with Aragorn (a unique Dúnedain hero) it can.
  lineSpec("17115:A:1", "Heirs of Earendil: played only with a unique Noldor and another unique Dúnedain character", (effects) => {
    const ally = heirs(effects, "ally");
    expect(playable(begin(ally.state), ally, HEIRS)).toBe(false);
    const hero = heirs(effects, "hero");
    expect(playable(begin(hero.state), hero, HEIRS)).toBe(true);
  });
});

describe("Open the Armory (17118:A:1, A:2)", () => {
  // Aragorn pays 1; the player's threat is `threat`. The deck, from the top: a card, Citadel Plate (Armor, 2nd), Horn of Gondor (neither,
  // 3rd), 2 cards, Blade of Gondolin (Weapon, 6th), 4 cards, Dwarven Axe (Weapon, 11th), a card.
  function armory(effects: readonly Effect[], threat: number): Table {
    const deck = [CARD, PLATE, HORN, CARD, CARD, GONDOLIN, CARD, CARD, CARD, CARD, AXE, CARD].map((code) => ({ code, seat: 0 }));
    return threatened(table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: LEGOLAS, seat: 0 }], hand: [{ code: ARMORY, seat: 0 }], playerDeck: deck }), threat);
  }

  // "Action: Search the top 10 cards of your deck for a Weapon or Armor attachment and add it to your hand. Shuffle your deck.": the Plate
  // and the Blade are offered (not the Horn, not the Axe, 11th); the Blade goes to the hand and the deck is shuffled.
  lineSpec("17118:A:1", "Open the Armory: search the top 10 cards for a Weapon or Armor attachment, add it to the hand, shuffle", (effects) => {
    const tab = armory(effects, 8);
    const [plate, blade] = [idsOf(tab, PLATE), idsOf(tab, GONDOLIN)];
    const cursor = tab.state.seedCursor;
    let run = playCode(tab, ARMORY);
    expect(choices(run.state, tab).sort()).toEqual([plate, blade].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: blade }, tab.ctx);
    expect(run.state.cards[blade]?.zone).toBe("hand");
    expect(run.state.seats[0]?.deck).toHaveLength(11);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });

  // "Valour Action: Search the top 5 cards of your deck for a Weapon or Armor attachment and put it into play. Shuffle your deck.": at
  // threat 40 the player picks the Valour effect; the Plate (2nd) is the only one in the top 5 (the Blade is 6th), so it is taken with no
  // question; the player puts it on Legolas with nothing paid, and the Blade stays in the deck.
  lineSpec("17118:A:2", "Open the Armory: at threat 40, search the top 5 cards for a Weapon or Armor attachment and put it into play", (effects) => {
    const tab = armory(effects, 40);
    const [plate, legolas, aragorn] = [idsOf(tab, PLATE), idsOf(tab, LEGOLAS), idsOf(tab, ARAGORN)];
    const cursor = tab.state.seedCursor;
    let run = playCode(tab, ARMORY);
    expect(choices(run.state, tab)).toEqual(["search", "valour"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "valour" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([aragorn, legolas].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: legolas }, tab.ctx);
    expect(run.state.cards[plate]).toMatchObject({ zone: "play", host: legolas });
    expect(run.state.cards[legolas]?.resources).toBe(6);
    expect(run.state.cards[aragorn]?.resources).toBe(6 - 1);
    expect(run.state.cards[idsOf(tab, GONDOLIN)]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).toHaveLength(11);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });

  // "Valour": below threat 40 only the first effect is used: no question asks which.
  it("17118:A:2 Open the Armory: below threat 40 the Valour effect is not offered", () => {
    const tab = armory(EFFECTS, 39);
    const run = playCode(tab, ARMORY);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, PLATE), idsOf(tab, GONDOLIN)].sort());
  });
});
