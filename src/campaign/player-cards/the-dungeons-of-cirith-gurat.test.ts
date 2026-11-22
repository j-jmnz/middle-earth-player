// Rules: bts.valour, rr.action, rr.response, rr.cost, rr.limits, rr.ready, rr.modifiers, rr.attachment-cards, rr.restricted, rr.traits,
// rr.triggered-ability, rr.threat-threat-dial, rr.initial-threat-level, rr.enters-play (data/rules/entries.json).
// The Dungeons of Cirith Gurat hero, allies and attachments, written from their card text (data/cards/DoCG.json; data/printed holds no
// ledger for this pack, so every intent goes through sendUnledgered): Folco Boffin 17109:A:1 and A:2, Knight of Dale 17110:A:1 and A:2,
// Diligent Noble 17111:A:1, A:2 and A:3, Riddermark Knight 17112:A:1, Eregion Survivor 17114:A:1, Leaflock 17116:A:1, A:2 and A:3, Legacy
// Blade 17117:A:1. The events are in the-dungeons-of-cirith-gurat-events.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withThreat } from "../../rules/core/state.ts";
import { threatCostCut, threatCostOf } from "../../rules/families/costs/stats.ts";
import { hasTrait } from "../../rules/interpret/conditions.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, fillers, hosts, passAll, play, playCode, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const FOLCO = "17109";
const DALE = "17110";
const NOBLE = "17111";
const RIDDERMARK = "17112";
const SURVIVOR = "17114";
const LEAFLOCK = "17116";
const BLADE = "17117";
// Core: Aragorn (Leadership), Legolas (Tactics), Thalin (Tactics, not a Noble), Éowyn (Spirit), Glorfindel (Lore), Horn of Gondor. A Burning
// Brand: "Attach to a Lore character. Restricted."
const ARAGORN = "01001";
const LEGOLAS = "01005";
const THALIN = "01006";
const EOWYN = "01007";
const GLORFINDEL = "01011";
const HORN = "01042";
const BRAND = "02033";
// An Ent ally and a Lore ally that is not an Ent, with no text.
const ENT = "ent";
const SAPLING = "sapling";
const WEAK = "weak";
const ALLY = "ally";
const PAL = "pal";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([FOLCO, DALE, NOBLE, RIDDERMARK, SURVIVOR, LEAFLOCK, BLADE, ARAGORN, LEGOLAS, THALIN, EOWYN, GLORFINDEL, HORN, BRAND]))]);
  cards.set(ENT, definePrinted({ code: ENT, name: "Ent", type: "ally", sphere: "lore", cost: 2, willpower: 0, attack: 1, defense: 1, health: 5, traits: ["Ent"] }));
  cards.set(SAPLING, definePrinted({ code: SAPLING, name: "Sapling", type: "ally", sphere: "lore", cost: 2, willpower: 0, attack: 1, defense: 1, health: 5 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

const threatened = (tab: Table, threat: number, seat = 0): Table => ({ ...tab, state: withThreat(tab.state, seat, threat) });

describe("Folco Boffin (17109:A:1, A:2)", () => {
  // "Folco Boffin gets -1 threat cost for each Hobbit hero you control.": with the Pal (a Hobbit hero) beside him, Folco (a Hobbit hero
  // himself, threat cost 7) costs 7 - 2; with Aragorn beside him 7 - 1. The other player's Pal is not counted.
  lineSpec("17109:A:1", "Folco Boffin: -1 threat cost for each Hobbit hero you control", (effects) => {
    const two = table(effects, { heroes: [{ code: FOLCO, seat: 0 }, { code: PAL, seat: 0 }] });
    expect(threatCostOf(two.state, idsOf(two, FOLCO), two.ctx)).toBe(7 - 2);
    expect(threatCostOf(two.state, idsOf(two, PAL), two.ctx)).toBe(6);
    // The starting threat adds up the threat costs (rr.initial-threat-level): 2 less than the printed 7 + 6.
    expect(threatCostCut(two.state, 0, two.ctx)).toBe(2);
    const one = table(effects, { seats: 2, heroes: [{ code: FOLCO, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }] });
    expect(threatCostOf(one.state, idsOf(one, FOLCO), one.ctx)).toBe(7 - 1);
  });

  // "Action: Discard Folco Boffin to reduce your threat by 7. (Limit once per game.)": at threat 30 the player's threat drops to 23 and Folco
  // goes to the discard pile; the other player's threat stays.
  lineSpec("17109:A:2", "Folco Boffin: discard him to reduce your threat by 7", (effects) => {
    const tab = threatened(table(effects, { seats: 2, heroes: [{ code: FOLCO, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }] }), 30);
    const folco = idsOf(tab, FOLCO);
    expect(triggers(tab.state, tab)).toContain("17109:action:1");
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: folco, effectId: "17109:action:1" }, tab.ctx);
    expect(run.state.cards[folco]?.zone).toBe("discard");
    expect(run.state.seats[0]?.threat).toBe(30 - 7);
    expect(run.state.seats[1]?.threat).toBe(6);
  });

  // At threat 0 the threat cannot be reduced: the Action can change nothing but its cost, so it is not offered (rr.triggered-ability).
  it("17109:A:2 Folco Boffin: not offered at threat 0", () => {
    const tab = threatened(table(EFFECTS, { heroes: [{ code: FOLCO, seat: 0 }, { code: ARAGORN, seat: 0 }] }), 0);
    expect(triggers(tab.state, tab)).not.toContain("17109:action:1");
  });
});

describe("Knight of Dale (17110:A:1, A:2)", () => {
  // Aragorn (Leadership) and Éowyn (Spirit); the Knight in play, exhausted; the player's threat is `threat`.
  function knight(effects: readonly Effect[], threat: number): Table {
    const scene = threatened(table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: DALE, seat: 0 }] }), threat);
    return { ...scene, state: updateCard(scene.state, idsOf(scene, DALE), { exhausted: true }) };
  }
  const spend = (tab: Table, heroId: string) => ({ type: "Trigger" as const, cardId: idsOf(tab, DALE), effectId: "17110:action:1", payments: [{ heroId, amount: 1 }] });

  // "Action: Spend 1 Leadership resource to ready Knight of Dale. (Limit once per round.)": Aragorn pays 1 and the Knight readies; Éowyn's
  // Spirit resource cannot pay; exhausted again in the same round, it is not offered again.
  lineSpec("17110:A:1", "Knight of Dale: spend 1 Leadership resource to ready it, once per round", (effects) => {
    const tab = knight(effects, 20);
    const [card, aragorn] = [idsOf(tab, DALE), idsOf(tab, ARAGORN)];
    expect(triggers(tab.state, tab)).toContain("17110:action:1");
    expect(refusal(tab.state, spend(tab, idsOf(tab, EOWYN)), tab.ctx)).not.toBeNull();
    const run = sendUnledgered(begin(tab.state), spend(tab, aragorn), tab.ctx);
    expect(run.state.cards[card]?.exhausted).toBe(false);
    expect(run.state.cards[aragorn]?.resources).toBe(6 - 1);
    expect(triggers(updateCard(run.state, card, { exhausted: true }), tab)).not.toContain("17110:action:1");
  });

  // "Valour Action: Ready Knight of Dale. (Limit once per round.)": at threat 40 the Knight readies with nothing paid; exhausted again, it
  // is not offered again this round.
  lineSpec("17110:A:2", "Knight of Dale: at threat 40, ready it, once per round", (effects) => {
    const tab = knight(effects, 40);
    const card = idsOf(tab, DALE);
    expect(triggers(tab.state, tab)).toContain("17110:action:2");
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: card, effectId: "17110:action:2" }, tab.ctx);
    expect(run.state.cards[card]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(6);
    expect(triggers(updateCard(run.state, card, { exhausted: true }), tab)).not.toContain("17110:action:2");
  });

  // "Valour": at threat 39 it is not offered.
  it("17110:A:2 Knight of Dale: the Valour Action is not offered below threat 40", () => {
    const tab = knight(EFFECTS, 39);
    expect(triggers(tab.state, tab)).not.toContain("17110:action:2");
  });
});

describe("Diligent Noble (17111:A:1, A:2, A:3)", () => {
  // Aragorn (Leadership) pays 1; Thalin is not a Noble; an ally is in play; the deck holds 2 cards.
  const noble = (effects: readonly Effect[], attached = false): Table =>
    table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: THALIN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: NOBLE, seat: 0 }], playerDeck: fillers(CARD, 2), ...(attached ? { attached: [{ code: NOBLE, host: THALIN }] } : {}) });

  // "Attach to a hero. Limit 1 per hero.": both heroes are offered, the ally is not; with a Diligent Noble already on Thalin, only Aragorn is.
  lineSpec("17111:A:1", "Diligent Noble: Attach to a hero, limit 1 per hero", (effects) => {
    const tab = noble(effects);
    const card = tab.ids[NOBLE]?.[0] ?? "";
    expect(hosts(tab, card)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, THALIN)].sort());
    const held = noble(effects, true);
    const second = held.ids[NOBLE]?.find((id) => held.state.cards[id]?.zone === "hand") ?? "";
    expect(hosts(held, second)).toEqual([idsOf(held, ARAGORN)]);
  });

  // "Attached hero gains the Noble trait.": Thalin is a Noble once it is played on him.
  lineSpec("17111:A:2", "Diligent Noble: the attached hero gains the Noble trait", (effects) => {
    const tab = noble(effects);
    const thalin = idsOf(tab, THALIN);
    expect(hasTrait(tab.state, thalin, "Noble", tab.ctx)).toBe(false);
    const run = play(begin(tab.state), tab, idsOf(tab, NOBLE), thalin);
    expect(run.state.cards[idsOf(tab, NOBLE)]?.host).toBe(thalin);
    expect(hasTrait(run.state, thalin, "Noble", tab.ctx)).toBe(true);
  });

  // "Response: After you play Diligent Noble from your hand, draw a card.": one of the 2 cards of the deck is drawn.
  lineSpec("17111:A:3", "Diligent Noble: after it is played from the hand, draw a card", (effects) => {
    const tab = noble(effects);
    const card = idsOf(tab, NOBLE);
    let run = play(begin(tab.state), tab, card, idsOf(tab, THALIN));
    expect(triggers(run.state, tab)).toContain("17111:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: card, effectId: "17111:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
    expect(run.state.seats[0]?.deck).toHaveLength(1);
  });

  // An empty deck: the draw can change nothing, so the Response is not offered (rr.triggered-ability).
  it("17111:A:3 Diligent Noble: not offered with an empty deck", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: THALIN, seat: 0 }], hand: [{ code: NOBLE, seat: 0 }] });
    expect(triggers(play(begin(tab.state), tab, idsOf(tab, NOBLE), idsOf(tab, THALIN)).state, tab)).not.toContain("17111:response:1");
  });
});

describe("Riddermark Knight (17112:A:1)", () => {
  // The Riddermark Knight and an ally in play; Legolas holds the Horn of Gondor ("After a character is destroyed, add 1 resource to
  // attached hero's pool."); the Weak (Defense 0) is engaged with the player.
  const riders = (effects: readonly Effect[]): Table =>
    table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], attached: [{ code: HORN, host: LEGOLAS }], allies: [{ code: RIDDERMARK, seat: 0 }, { code: ALLY, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });

  // "Response: After Riddermark Knight is declared as an attacker, it gets +2 Attack for this attack. At the end of this attack, discard
  // Riddermark Knight.": it strikes the Weak with Attack 2 + 2 and is discarded when the attack ends. It is discarded, not destroyed: the
  // Horn of Gondor does not hear it.
  lineSpec("17112:A:1", "Riddermark Knight: +2 Attack for the attack after it is declared as an attacker, then it is discarded", (effects) => {
    const tab = riders(effects);
    const [knight, weak] = [idsOf(tab, RIDDERMARK), idsOf(tab, WEAK)];
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: weak, attackerIds: [knight] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("17112:response:1");
    run = passAll(sendUnledgered(run, { type: "Trigger", cardId: knight, effectId: "17112:response:1" }, tab.ctx), tab.ctx);
    expect(run.steps.filter((step) => step.kind === "strike" && step.side === "player").map((step) => (step.kind === "strike" ? step.attack : 0))).toEqual([2 + 2]);
    expect(run.state.cards[weak]?.damage).toBe(4);
    expect(run.state.cards[knight]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).not.toContain("01042:response:1");
  });

  // "After Riddermark Knight is declared": the ally attacking alone does not offer it.
  it("17112:A:1 Riddermark Knight: not offered when another character attacks", () => {
    const tab = riders(EFFECTS);
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, ALLY)] }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("17112:response:1");
  });
});

describe("Eregion Survivor (17114:A:1)", () => {
  // Éowyn (Spirit) pays 2; `hand` cards stay in the first player's hand after the Survivor is played; the second player's hand is empty.
  const survivor = (effects: readonly Effect[], hand: number): Table =>
    table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: SURVIVOR, seat: 0 }, ...fillers(CARD, hand)] });

  // "While you have no cards in your hand, Eregion Survivor gets +1 Willpower, +1 Attack, and +1 Defense.": played as the last card of the
  // hand, it has 1 + 1 of each.
  lineSpec("17114:A:1", "Eregion Survivor: +1 Willpower, Attack and Defense while its player has no cards in hand", (effects) => {
    const tab = survivor(effects, 0);
    const card = idsOf(tab, SURVIVOR);
    const run = playCode(tab, SURVIVOR);
    expect(run.state.seats[0]?.hand).toEqual([]);
    expect([stat(run.state, tab, card, "willpower"), stat(run.state, tab, card, "attack"), stat(run.state, tab, card, "defense")]).toEqual([2, 2, 2]);
  });

  // With a card left in the hand (and the other player's hand empty), it has its printed stats.
  it("17114:A:1 Eregion Survivor: printed stats while its player holds a card", () => {
    const tab = survivor(EFFECTS, 1);
    const card = idsOf(tab, SURVIVOR);
    const run = playCode(tab, SURVIVOR);
    expect([stat(run.state, tab, card, "willpower"), stat(run.state, tab, card, "attack"), stat(run.state, tab, card, "defense")]).toEqual([1, 1, 1]);
  });
});

describe("Leaflock (17116:A:1, A:2, A:3)", () => {
  // Glorfindel (Lore) pays 3 for Leaflock; `damaged` of the Ent allies in play are damaged, the rest are not; the second player controls a
  // damaged Ent.
  function leaflock(effects: readonly Effect[], ents: number, damaged: number): Table {
    const scene = table(effects, { seats: 2, heroes: [{ code: GLORFINDEL, seat: 0 }, { code: PAL, seat: 1 }], allies: [...fillers(ENT, ents), { code: ENT, seat: 1 }, { code: SAPLING, seat: 0 }], hand: [{ code: LEAFLOCK, seat: 0 }, { code: BRAND, seat: 0 }] }, 10);
    const mine = (scene.ids[ENT] ?? []).filter((id) => scene.state.cards[id]?.controller === 0);
    const theirs = (scene.ids[ENT] ?? []).filter((id) => scene.state.cards[id]?.controller === 1);
    let state = scene.state;
    for (const id of [...mine.slice(0, damaged), ...theirs, idsOf(scene, SAPLING)]) state = updateCard(state, id, { damage: 1 });
    return { ...scene, state };
  }

  // "Cannot have restricted attachments.": A Burning Brand (a restricted Lore attachment) may go on Glorfindel or the Lore ally, not on
  // Leaflock.
  lineSpec("17116:A:1", "Leaflock: cannot have restricted attachments", (effects) => {
    const tab = leaflock(effects, 0, 0);
    const run = playCode(tab, LEAFLOCK);
    const brand = idsOf(tab, BRAND);
    expect(run.state.cards[idsOf(tab, LEAFLOCK)]?.zone).toBe("play");
    expect(hosts(tab, brand, run.state)).not.toContain(idsOf(tab, LEAFLOCK));
    expect(hosts(tab, brand, run.state)).toEqual(expect.arrayContaining([idsOf(tab, GLORFINDEL), idsOf(tab, SAPLING)]));
  });

  // "Enters play exhausted.": played from the hand, it is exhausted.
  lineSpec("17116:A:2", "Leaflock: enters play exhausted", (effects) => {
    const tab = leaflock(effects, 0, 0);
    expect(playCode(tab, LEAFLOCK).state.cards[idsOf(tab, LEAFLOCK)]?.exhausted).toBe(true);
  });

  // "Leaflock gets +1 Willpower for each damaged Ent character you control. (Limit +4 Willpower.)": with 2 damaged Ents and 1 undamaged
  // he has Willpower 0 + 2 (the damaged non-Ent ally and the other player's damaged Ent do not count); with 5 damaged Ents, 0 + 4.
  lineSpec("17116:A:3", "Leaflock: +1 Willpower for each damaged Ent character you control, at most +4", (effects) => {
    const two = leaflock(effects, 3, 2);
    expect(stat(playCode(two, LEAFLOCK).state, two, idsOf(two, LEAFLOCK), "willpower")).toBe(0 + 2);
    const five = leaflock(effects, 5, 5);
    expect(stat(playCode(five, LEAFLOCK).state, five, idsOf(five, LEAFLOCK), "willpower")).toBe(0 + 4);
  });
});

describe("Legacy Blade (17117:A:1)", () => {
  // "Attach to a hero. Restricted.": Glorfindel (Lore) pays 0; both heroes are offered, the ally is not.
  lineSpec("17117:A:1", "Legacy Blade: Attach to a hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: GLORFINDEL, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: BLADE, seat: 0 }] });
    const blade = idsOf(tab, BLADE);
    expect(hosts(tab, blade)).toEqual([idsOf(tab, GLORFINDEL), idsOf(tab, ARAGORN)].sort());
    expect(play(begin(tab.state), tab, blade, idsOf(tab, ARAGORN)).state.cards[blade]?.host).toBe(idsOf(tab, ARAGORN));
  });
});
