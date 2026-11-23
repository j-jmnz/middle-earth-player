// Rules: emce.treasure, rr.response, rr.triggered-ability, rr.search, rr.damage, rr.discard-pile-and-victory-display, rr.resources
// (data/rules/entries.json). The Ered Mithrin treasure lines that answer a claim or a play, each tested from the line read from its scan
// (data/printed/ered-mithrin.json): Anvil of Gundabad 12196:A:2, Axe of the Edain 12197:A:3, Durin's Dagger 12198:A:3, Glittering Lute
// 12200:A:3, and the play from the hand that the Attach to lines 12196:A:1 to 12204:A:1 allow. emce.treasure: "A player is permitted to add a
// treasure card to their player deck before the game begins if that treasure card is marked in the campaign log", and The Fate of Wilderland
// searches the deck for one (SearchBoonOrTreasureToHand, 12195:A), so a treasure in the hand is a card its player plays. The claim (the
// first player puts a treasure free of encounters on a character, freeTreasures in src/rules/families/wilderland/mirkwood.ts) is no play.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, send, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, discarded, playerTable, triggers, type PlayerBase } from "../../../test/harness/player-table.ts";

const ANVIL = "12196";
const AXE = "12197";
const DAGGER = "12198";
const CROWN = "12199";
const LUTE = "12200";
const SHIELD = "12201";
const HELM = "12202";
const JEWELS = "12203";
const BOW = "12204";
// Core heroes Gimli and Legolas (Tactics), Aragorn (Leadership, unique).
const GIMLI = "01004";
const LEGOLAS = "01005";
// Core cards for the deck the Anvil searches: Blade of Gondolin (Item Weapon attachment), Steward of Gondor (Title attachment), Citadel Plate
// (Item Armor attachment), Snowbourn Scout (ally), Horn of Gondor (Item Artifact attachment), Dwarven Axe (Item Weapon attachment).
const BLADE = "01039";
const STEWARD = "01026";
const PLATE = "01040";
const SCOUT = "01016";
const HORN = "01042";
const DWARVEN_AXE = "01041";
const PAL = "pal";
const CARD = "card";
// Stand-in enemies with 9 hit points: a non-unique one and a unique one.
const WEAK = "weak";
const BOSS = "boss";

let base: PlayerBase;

const table = (effects: readonly Effect[], scene: Scene = {}): Table => playerTable(base, effects, scene);

// The treasure `code` in the staging area, free of encounters, claimed onto Gimli (Legolas beside him, so the first player is asked).
const claimedOnGimli = (effects: readonly Effect[], code: string, scene: Scene = {}): { tab: Table; run: Run } => {
  const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }], ...scene, staging: [code] });
  const asked = begin(settle({ ...tab.state, window: null }, tab.ctx, []));
  return { tab, run: send(asked, { type: "Choose", optionId: idsOf(tab, GIMLI) }, tab.ctx) };
};

// The PlayCard of the treasure in the hand onto `host`, its cost paid, through the kit's send (every treasure line is in the ledger).
const playOn = (run: Run, tab: Table, cardId: string, hostId: string): Run => send(run, { type: "PlayCard", cardId, hostId, payments: payFor(run.state, tab.ctx, cardId) }, tab.ctx);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ANVIL, AXE, DAGGER, CROWN, LUTE, SHIELD, HELM, JEWELS, BOW, GIMLI, LEGOLAS, BLADE, STEWARD, PLATE, SCOUT, HORN, DWARVEN_AXE];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  cards.set(BOSS, definePrinted({ code: BOSS, name: "Boss", type: "enemy", isUnique: true, threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Anvil of Gundabad (12196:A:2)", () => {
  // The deck, top first: Blade of Gondolin, Steward of Gondor, Citadel Plate, Snowbourn Scout, Horn of Gondor, and Dwarven Axe sixth.
  const deck = [BLADE, STEWARD, PLATE, SCOUT, HORN, DWARVEN_AXE].map((code) => ({ code, seat: 0 }));

  // "Response: After you claim or play Anvil of Gundabad, search the top 5 cards of your deck for any number of Item attachments and add
  // them to your hand. Shuffle your deck.": claimed, the Anvil offers the Response; the Item attachments of the top 5 (the Blade, the Plate,
  // the Horn) are offered, not the Title, the ally or the sixth card. The player takes the Blade and the Horn and stops: those two are in the
  // hand, the other four in the deck.
  lineSpec("12196:A:2", "Anvil of Gundabad: after it is claimed, take any number of Item attachments from the top 5 cards", (effects) => {
    const { tab, run: held } = claimedOnGimli(effects, ANVIL, { playerDeck: deck });
    expect(held.state.cards[idsOf(tab, ANVIL)]?.host).toBe(idsOf(tab, GIMLI));
    expect(triggers(held.state, tab)).toContain("12196:response:1");
    let run = send(held, { type: "Trigger", cardId: idsOf(tab, ANVIL), effectId: "12196:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, BLADE), idsOf(tab, PLATE), idsOf(tab, HORN), "done"].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, BLADE) }, tab.ctx);
    run = send(run, { type: "Choose", optionId: idsOf(tab, HORN) }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, PLATE), "done"].sort());
    run = send(run, { type: "Choose", optionId: "done" }, tab.ctx);
    const codesOf = (ids: readonly string[] | undefined) => (ids ?? []).map((id) => run.state.cards[id]?.code).sort();
    expect(codesOf(run.state.seats[0]?.hand)).toEqual([BLADE, HORN].sort());
    expect(codesOf(run.state.seats[0]?.deck)).toEqual([STEWARD, PLATE, SCOUT, DWARVEN_AXE].sort());
  });

  // "After you claim or play Anvil of Gundabad": played from the hand onto Gimli, the Anvil offers the Response too.
  it("12196:A:2 Anvil of Gundabad: after it is played from the hand, its Response is offered", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: ANVIL, seat: 0 }], playerDeck: deck });
    const run = playOn(begin(tab.state), tab, idsOf(tab, ANVIL), idsOf(tab, GIMLI));
    expect(triggers(run.state, tab)).toContain("12196:response:1");
  });
});

describe("Axe of the Edain (12197:A:3) and Glittering Lute (12200:A:3)", () => {
  // "Response: After you play Axe of the Edain, ...": a claim is no play, so the claimed Axe offers no Response, with a non-unique enemy
  // engaged with its player.
  it("12197:A:3 Axe of the Edain: not offered after the Axe is claimed", () => {
    const { tab, run } = claimedOnGimli(EFFECTS, AXE, { engaged: [{ code: WEAK, seat: 0 }] });
    expect(run.state.cards[idsOf(tab, AXE)]?.host).toBe(idsOf(tab, GIMLI));
    expect(triggers(run.state, tab)).not.toContain("12197:response:1");
  });

  // "Response: After you play Glittering Lute, ...": the claimed Lute offers no Response.
  it("12200:A:3 Glittering Lute: not offered after the Lute is claimed", () => {
    const { tab, run } = claimedOnGimli(EFFECTS, LUTE, { hand: [{ code: CARD, seat: 0 }] });
    expect(run.state.cards[idsOf(tab, LUTE)]?.host).toBe(idsOf(tab, GIMLI));
    expect(triggers(run.state, tab)).not.toContain("12200:response:1");
  });

  // "Response: After you play Axe of the Edain, deal 2 damage to a non-unique enemy engaged with you.": played from the hand onto
  // Gimli, with the non-unique Weak and the unique Boss engaged, the Response offers only the Weak, which takes 2 damage.
  it("12197:A:3 Axe of the Edain: after it is played, 2 damage to a non-unique enemy engaged with you", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: AXE, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }, { code: BOSS, seat: 0 }] });
    let run = playOn(begin(tab.state), tab, idsOf(tab, AXE), idsOf(tab, GIMLI));
    expect(triggers(run.state, tab)).toContain("12197:response:1");
    run = send(run, { type: "Trigger", cardId: idsOf(tab, AXE), effectId: "12197:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WEAK)]?.damage).toBe(2);
    expect(run.state.cards[idsOf(tab, BOSS)]?.damage ?? 0).toBe(0);
  });

  // "Response: After you play Glittering Lute, each player may discard a card from their hand. Each player who does so reduces their
  // threat by 2.": two players, the first discards and goes from 8 to 6, the second declines and stays at 6.
  it("12200:A:3 Glittering Lute: after it is played, each player who discards a card reduces their threat by 2", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: LUTE, seat: 0 }, { code: CARD, seat: 0 }, { code: CARD, seat: 1 }] });
    let run = playOn(begin(tab.state), tab, idsOf(tab, LUTE), idsOf(tab, GIMLI));
    run = send(run, { type: "Trigger", cardId: idsOf(tab, LUTE), effectId: "12200:response:1" }, tab.ctx);
    run = send(run, { type: "Choose", optionId: "discard" }, tab.ctx);
    run = send(run, { type: "Choose", optionId: "decline" }, tab.ctx);
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([8 - 2, 6]);
    expect(run.state.seats.map((seat) => seat.hand.length)).toEqual([0, 1]);
  });
});

describe("Durin's Dagger (12198:A:3)", () => {
  // "You may play Durin's Dagger from your discard pile.": the Dagger in the discard pile is offered as a PlayCard and goes onto Gimli
  // for its cost 1.
  it("12198:A:3 Durin's Dagger: played from the discard pile", () => {
    const made = discarded(table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }] }), [[DAGGER, 0]]);
    const [dagger = ""] = made.ids;
    const gimli = idsOf(made.tab, GIMLI);
    expect(legalIntents(made.tab.state, made.tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === dagger)).toBe(true);
    const run = playOn(begin(made.tab.state), made.tab, dagger, gimli);
    expect(run.state.cards[dagger]).toMatchObject({ zone: "play", host: gimli });
    expect(run.state.cards[gimli]?.resources).toBe(6 - 1);
  });
});

describe("A treasure in the hand (12196:A:1 to 12204:A:1)", () => {
  // Each treasure prints its Attach to line and a cost (0, 1 for the Dagger, 2 for the Crown), and emce.treasure lets it be in a deck;
  // in the planning phase its player plays it from the hand onto Gimli.
  const rows = [
    ["12196:A:1", ANVIL],
    ["12197:A:1", AXE],
    ["12198:A:1", DAGGER],
    ["12199:A:1", CROWN],
    ["12200:A:1", LUTE],
    ["12201:A:1", SHIELD],
    ["12202:A:1", HELM],
    ["12203:A:1", JEWELS],
    ["12204:A:1", BOW],
  ] as const;
  for (const [line, code] of rows) {
    it(`${line} played from the hand onto a character in the planning phase`, () => {
      const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code, seat: 0 }] });
      expect(playOn(begin(tab.state), tab, idsOf(tab, code), idsOf(tab, GIMLI)).state.cards[idsOf(tab, code)]?.host).toBe(idsOf(tab, GIMLI));
    });
  }
});
