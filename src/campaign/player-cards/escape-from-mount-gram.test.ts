// Rules: rr.constant-ability, rr.restricted, rr.enters-play, rr.action, rr.response, rr.limits, rr.lasting-effects, rr.ready, rr.damage,
// rr.explored, rr.unique-cards, rr.discard-pile-and-victory-display, rr.then, rr.the-letter-x, rr.engaged, rr.deckbuilding, rr.step-6-4-1
// (data/rules/entries.json).
// The Escape from Mount Gram player cards, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts):
// Veteran of Osgiliath 10029:A:1, Descendants of Kings 10030:A:1, Derndingle Warrior 10031:A:2 to A:4, Boomed and Trumpeted 10032:A:1,
// Double Back 10034:A:1, Leave No Trace 10035:A:2, Keen as Lances 10037:A:2. The lines are the text of data/cards/EfMG.json (data/printed
// holds no ledger for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckSaveRefusal } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { destroyCard, placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withThreat } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, combat, deckSaveFacts, enter, fillers, hosts, packRow, passAll, play, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const VETERAN = "10029";
const DESCENDANTS = "10030";
const DERNDINGLE = "10031";
const BOOMED = "10032";
const DOUBLE_BACK = "10034";
const LEAVE = "10035";
const KEEN = "10037";
// Core Aragorn (Leadership, Dúnedain), Legolas (Tactics, Silvan), Denethor (Lore, Gondor), Beravor (Lore, Dúnedain), Northern Tracker
// (a Spirit Dúnedain ally), Gondorian Spearman (a Tactics ally), Spear of the Citadel (a restricted attachment for a Tactics character).
const ARAGORN = "01001";
const LEGOLAS = "01005";
const DENETHOR = "01010";
const BERAVOR = "01012";
const TRACKER = "01045";
const SPEARMAN = "01029";
const SPEAR = "05009";
const ALLY = "ally";
const PAL = "pal";
// A Spirit hero with no Trait; an Ent ally with no text; an enemy no attack here destroys; a non-unique and a unique location.
const SPIRIT = "spirit";
const ENT = "ent";
const WEAK = "weak";
const GLADE = "glade";
const TOWER = "tower";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([VETERAN, DESCENDANTS, DERNDINGLE, BOOMED, DOUBLE_BACK, LEAVE, KEEN, ARAGORN, LEGOLAS, DENETHOR, BERAVOR, TRACKER, SPEARMAN, SPEAR]))]);
  cards.set(SPIRIT, definePrinted({ code: SPIRIT, name: "Spirit", type: "hero", sphere: "spirit", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(ENT, definePrinted({ code: ENT, name: "Ent", type: "ally", sphere: "tactics", cost: 2, willpower: 1, attack: 2, defense: 2, health: 6, traits: ["Ent"] }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  cards.set(GLADE, definePrinted({ code: GLADE, name: "Glade", type: "location", threat: 1, questPoints: 3 }));
  cards.set(TOWER, definePrinted({ code: TOWER, name: "Tower", type: "location", isUnique: true, threat: 1, questPoints: 3 }));
  base = { ...starter, cards };
});

describe("Veteran of Osgiliath (10029:A:1)", () => {
  // The Veteran is played by Aragorn at the player's `threat`; the other player's threat is 45.
  function played(effects: readonly Effect[], threat: number): { tab: Table; run: Run } {
    const scene = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: SPIRIT, seat: 1 }], hand: [{ code: VETERAN, seat: 0 }] });
    const tab = { ...scene, state: withThreat(withThreat(scene.state, 0, threat), 1, 45) };
    return { tab, run: play(begin(tab.state), tab, idsOf(tab, VETERAN)) };
  }

  // "Veteran of Osgiliath gets +1 Willpower, +1 Attack, and +1 Defense while your threat is 40 or higher.": at threat 40 he is 2/3/2.
  lineSpec("10029:A:1", "+1 Willpower, Attack and Defense while your threat is 40 or higher", (effects) => {
    const { tab, run } = played(effects, 40);
    const veteran = idsOf(tab, VETERAN);
    expect([stat(run.state, tab, veteran, "willpower"), stat(run.state, tab, veteran, "attack"), stat(run.state, tab, veteran, "defense")]).toEqual([1 + 1, 2 + 1, 1 + 1]);
  });

  // At threat 39 he keeps his printed 1/2/1, though the other player's threat is 45.
  it("10029:A:1 no bonus at threat 39", () => {
    const { tab, run } = played(EFFECTS, 39);
    const veteran = idsOf(tab, VETERAN);
    expect([stat(run.state, tab, veteran, "willpower"), stat(run.state, tab, veteran, "attack"), stat(run.state, tab, veteran, "defense")]).toEqual([1, 2, 1]);
  });
});

describe("Descendants of Kings (10030:A:1)", () => {
  // "Ready up to X Dúnedain characters you control. X is the number of enemies engaged with you.": two enemies are engaged with the player
  // (one with the other player does not count); Aragorn pays. Aragorn, Beravor and the Northern Tracker are exhausted Dúnedain; Denethor
  // (exhausted, not Dúnedain) and the other player's exhausted Northern Tracker are not offered. X is 1 or 2; with 2, Beravor and the
  // Tracker are readied and Aragorn stays exhausted.
  lineSpec("10030:A:1", "readies up to X Dúnedain characters you control, X the enemies engaged with you", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: SPIRIT, seat: 1 }], allies: [{ code: TRACKER, seat: 0 }, { code: TRACKER, seat: 1 }], engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 0 }, { code: WEAK, seat: 1 }], hand: [{ code: DESCENDANTS, seat: 0 }] });
    const [aragorn, beravor, denethor] = [idsOf(scene, ARAGORN), idsOf(scene, BERAVOR), idsOf(scene, DENETHOR)];
    const [tracker = "", theirs = ""] = scene.ids[TRACKER] ?? [];
    let state = scene.state;
    for (const id of [aragorn, beravor, denethor, tracker, theirs]) state = updateCard(state, id, { exhausted: true });
    const tab = { ...scene, state };
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, DESCENDANTS), payments: [{ heroId: aragorn, amount: 1 }] }, tab.ctx);
    expect(choices(run.state, tab)).toEqual(["x1", "x2"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "x2" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([aragorn, beravor, tracker].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: beravor }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([aragorn, tracker].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: tracker }, tab.ctx);
    expect(run.state.cards[aragorn]?.exhausted).toBe(true);
    expect(run.state.cards[beravor]?.exhausted).toBe(false);
    expect(run.state.cards[tracker]?.exhausted).toBe(false);
    expect(run.state.cards[denethor]?.exhausted).toBe(true);
    expect(run.state.cards[theirs]?.exhausted).toBe(true);
  });
});

describe("Derndingle Warrior (10031:A:2 to A:4)", () => {
  // "Cannot have restricted attachments.": Spear of the Citadel (restricted, for a Tactics character) is offered for Legolas and the
  // Gondorian Spearman, not for the Derndingle Warrior (a Tactics ally).
  lineSpec("10031:A:2", "cannot have restricted attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: DERNDINGLE, seat: 0 }, { code: SPEARMAN, seat: 0 }], hand: [{ code: SPEAR, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, SPEAR))).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, SPEARMAN)].sort());
  });

  // "Enters play exhausted.": Legolas plays it; it enters play exhausted. Another ally played the same way enters ready.
  lineSpec("10031:A:3", "enters play exhausted", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], hand: [{ code: DERNDINGLE, seat: 0 }, { code: SPEARMAN, seat: 0 }] });
    let run = play(begin(tab.state), tab, idsOf(tab, DERNDINGLE));
    run = play(run, tab, idsOf(tab, SPEARMAN));
    expect(run.state.cards[idsOf(tab, DERNDINGLE)]).toMatchObject({ zone: "play", exhausted: true });
    expect(run.state.cards[idsOf(tab, SPEARMAN)]?.exhausted).toBe(false);
  });

  // The Warrior in play, the Weak enemy engaged; the combat phase is at the first attack's defense step.
  function defending(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: DERNDINGLE, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    const run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    return { tab, run };
  }

  // "While Derndingle Warrior is defending, it gains: "Action: Deal 1 damage to Derndingle Warrior to give it +3 Defense for this attack."
  // (Limit once per attack.)": declared as the defender, it takes 1 damage for Defense 2 + 3; the Action is not offered again in that
  // attack, the attack strikes Defense 5, and after it the Warrior's Defense is 2.
  lineSpec("10031:A:4", "while defending, 1 damage to itself for +3 Defense this attack, once per attack", (effects) => {
    const { tab, run: open } = defending(effects);
    const warrior = idsOf(tab, DERNDINGLE);
    expect(triggers(open.state, tab)).not.toContain("10031:action:1");
    let run = sendUnledgered(open, { type: "DeclareDefender", defenderId: warrior }, tab.ctx);
    run = sendUnledgered(run, { type: "Trigger", cardId: warrior, effectId: "10031:action:1" }, tab.ctx);
    expect(run.state.cards[warrior]?.damage).toBe(1);
    expect(stat(run.state, tab, warrior, "defense")).toBe(2 + 3);
    expect(triggers(run.state, tab)).not.toContain("10031:action:1");
    const before = run.steps.length;
    run = passAll(run, tab.ctx, { responses: true });
    const strikes = run.steps.slice(before).flatMap((step) => (step.kind === "strike" && step.side === "enemy" ? [step.defense] : []));
    expect(strikes).toEqual([2 + 3]);
    expect(stat(run.state, tab, warrior, "defense")).toBe(2);
  });
});

describe("Boomed and Trumpeted (10032:A:1)", () => {
  // Legolas pays (Tactics); an exhausted Ent ally and an exhausted plain ally; the Weak enemy is engaged, so the combat phase stops at its
  // attack.
  function scene(effects: readonly Effect[]): Table {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: ENT, seat: 0 }, { code: ALLY, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], hand: [{ code: BOOMED, seat: 0 }] });
    return { ...tab, state: updateCard(updateCard(tab.state, idsOf(tab, ENT), { exhausted: true }), idsOf(tab, ALLY), { exhausted: true }) };
  }
  const hurt = (tab: Table, id: string): Run => sendUnledgered(begin(placeDamage(tab.state, id, 1, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);

  // "Response: After an Ent character takes any amount of damage, ready it. That character gets +3 Attack until the end of the phase.": the
  // Ent takes 1 damage (the Pass that lets the game resolve it ends the planning phase, so the Response comes in the quest phase); it is
  // readied with Attack 2 + 3, and in the combat phase of the same round its Attack is 2 again.
  lineSpec("10032:A:1", "after an Ent takes damage, it readies and gets +3 Attack until the end of the phase", (effects) => {
    const tab = scene(effects);
    const ent = idsOf(tab, ENT);
    let run = hurt(tab, ent);
    expect(run.state.cards[ent]?.damage).toBe(1);
    expect(triggers(run.state, tab)).toContain("10032:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, BOOMED), effectId: "10032:response:1", payments: [{ heroId: idsOf(tab, LEGOLAS), amount: 1 }] }, tab.ctx);
    expect(run.state.cards[ent]?.exhausted).toBe(false);
    expect(stat(run.state, tab, ent, "attack")).toBe(2 + 3);
    expect(run.state.phase).toBe("Quest");
    const later = passAll(enter(run.state, tab, "combatStart"), tab.ctx).state;
    expect([later.phase, later.round]).toEqual(["Combat", run.state.round]);
    expect(stat(later, tab, ent, "attack")).toBe(2);
  });

  // Damage to the plain ally (not an Ent) offers nothing.
  it("10032:A:1 is not offered when a character that is not an Ent takes damage", () => {
    const tab = scene(EFFECTS);
    const run = hurt(tab, idsOf(tab, ALLY));
    expect(run.state.cards[idsOf(tab, ALLY)]?.damage).toBe(1);
    expect(triggers(run.state, tab)).not.toContain("10032:response:1");
  });
});

describe("Double Back (10034:A:1)", () => {
  // "Limit 1 per deck." The deck check reads the card's deck limit (data/cards/EfMG.json), which the DeckLimit record restates.
  it("10034:A:1 a deck holds at most 1 copy", () => {
    const row = packRow("EfMG", DOUBLE_BACK);
    expect(row?.deckLimit).toBe(1);
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    expect(deckSaveRefusal(["h1"], [...events, { code: DOUBLE_BACK, count: 1 }], deckSaveFacts(row))).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: DOUBLE_BACK, count: 2 }], deckSaveFacts(row))).toMatchObject({ cardCode: DOUBLE_BACK });
  });
});

describe("Leave No Trace (10035:A:2)", () => {
  // Denethor pays (Lore) and the Pal quests; `location` is the active location with 2 of its 3 progress. With `explored` the quest
  // explores it (the Pal's Willpower 1 against no threat); without, it is discarded and a Pass lets the game resolve that.
  function left(effects: readonly Effect[], location: string, explored = true): { tab: Table; run: Run } {
    const scene = table(effects, { start: "quest", heroes: [{ code: DENETHOR, seat: 0 }, { code: PAL, seat: 0 }], active: location, hand: [{ code: LEAVE, seat: 0 }], deck: ["f0", "f0"] });
    const id = idsOf(scene, location);
    const tab = { ...scene, state: updateCard(scene.state, id, { progress: 2 }) };
    if (!explored) return { tab, run: sendUnledgered(begin(destroyCard(tab.state, id, tab.ctx.cards, [])), { type: "Pass" }, tab.ctx) };
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, PAL)] }, tab.ctx);
    for (let guard = 0; guard < 10 && run.state.cards[id]?.zone === "activeLocation"; guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    return { tab, run };
  }

  // "Response: After a non-unique location is explored, add Leave No Trace to the victory display to add that location to the victory
  // display.": the Glade is explored; Leave No Trace and the Glade go to the victory display, and Leave No Trace is not discarded.
  lineSpec("10035:A:2", "after a non-unique location is explored, it and the location go to the victory display", (effects) => {
    const { tab, run: explored } = left(effects, GLADE);
    const [leave, glade] = [idsOf(tab, LEAVE), idsOf(tab, GLADE)];
    expect(triggers(explored.state, tab)).toContain("10035:response:1");
    const run = sendUnledgered(explored, { type: "Trigger", cardId: leave, effectId: "10035:response:1", payments: [{ heroId: idsOf(tab, DENETHOR), amount: 1 }] }, tab.ctx);
    expect(run.state.cards[leave]?.zone).toBe("victory");
    expect(run.state.cards[glade]?.zone).toBe("victory");
    expect(run.state.seats[0]?.discard).not.toContain(leave);
  });

  // The unique Tower explored offers nothing.
  it("10035:A:2 is not offered after a unique location is explored", () => {
    const { tab, run } = left(EFFECTS, TOWER);
    expect(run.state.cards[idsOf(tab, TOWER)]?.zone).toBe("encounterDiscard");
    expect(triggers(run.state, tab)).not.toContain("10035:response:1");
  });

  // A location that leaves play without being explored offers nothing.
  it("10035:A:2 is not offered after a location leaves play unexplored", () => {
    const { tab, run } = left(EFFECTS, GLADE, false);
    expect(run.state.cards[idsOf(tab, GLADE)]?.zone).not.toBe("activeLocation");
    expect(triggers(run.state, tab)).not.toContain("10035:response:1");
  });
});

describe("Keen as Lances (10037:A:2)", () => {
  // Aragorn pays 5 (the victory display is empty); the Pal is the other hero; the deck holds 5 cards.
  const scene = (effects: readonly Effect[]) => table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 0 }], hand: [{ code: KEEN, seat: 0 }], playerDeck: fillers("card", 5) });
  const cast = (tab: Table): Run => sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, KEEN), payments: [{ heroId: idsOf(tab, ARAGORN), amount: 5 }] }, tab.ctx);

  // "Action: Add Keen as Lances to the victory display. Then, choose one: add 2 resources to a hero's resource pool, draw 3 cards, or
  // reduce your threat by 4.": Keen as Lances goes to the victory display and the three options are offered; "resources" gives the Pal 2.
  lineSpec("10037:A:2", "goes to the victory display, then 2 resources, 3 cards or 4 threat", (effects) => {
    const tab = scene(effects);
    const pal = idsOf(tab, PAL);
    let run = cast(tab);
    expect(run.state.cards[idsOf(tab, KEEN)]?.zone).toBe("victory");
    expect(choices(run.state, tab).sort()).toEqual(["draw", "resources", "threat"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "resources" }, tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: pal }, tab.ctx);
    expect(run.state.cards[pal]?.resources).toBe(6 + 2);
    expect(run.state.cards[idsOf(tab, KEEN)]?.zone).toBe("victory");
  });

  // "draw 3 cards": the hand gains 3 and the deck keeps 2.
  it("10037:A:2 draws 3 cards", () => {
    const tab = scene(EFFECTS);
    const run = sendUnledgered(cast(tab), { type: "Choose", optionId: "draw" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(3);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
  });

  // "reduce your threat by 4": 8 becomes 4.
  it("10037:A:2 reduces the threat by 4", () => {
    const tab = scene(EFFECTS);
    const run = sendUnledgered(cast(tab), { type: "Choose", optionId: "threat" }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe(8 - 4);
  });
});
