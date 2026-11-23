// Rules: rr.modifiers, rr.response, rr.action, rr.cost, rr.cancel, rr.triggered-ability, rr.lasting-effects, rr.damage, bts.valour,
// emce.side-quests, rr.deckbuilding (data/rules/entries.json).
// The Wastes of Eriador allies, events and side quest, written from their card text (data/cards/WoE.json; data/printed holds no ledger for
// this pack, so the lines are the text of data/cards and every intent goes through sendUnledgered): Ingold 10002:A:1, Rallying Cry
// 10003:A:1 and A:2, Honour Guard 10004:A:2, Scout Ahead 10009:A:1 and A:2. The attachments are in
// the-wastes-of-eriador-attachments.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckSaveRefusal } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { atDefense, canPlay, choices, combat, deckSaveFacts, enter, packRow, passAll, passWhile, play, playerTableFor, sendUnledgered, stat, threatened, triggers } from "../../../test/harness/player-table.ts";

const INGOLD = "10002";
const RALLYING = "10003";
const HONOUR = "10004";
const SCOUT = "10009";
// Aragorn (Leadership) and the Pal (a Leadership hero, test/harness/scene.ts).
const ARAGORN = "01001";
const PAL = "pal";
// Heroes with no text, Tactics and Spirit, of 9 hit points.
const TACTICS = "tactics-hero";
const SPIRIT = "spirit-hero";
// The plain Leadership ally (Defense 1, 2 hit points, test/harness/scene.ts).
const ALLY = "ally";
// Enemies that engage nobody: a Brute (Attack 4) and a Giant (Attack 8), neither destroyed by the tests' attacks.
const BRUTE = "brute";
const GIANT = "giant";
// Encounter cards: an objective, a location worth 2 victory points, and plain locations.
const OBJECTIVE = "objective";
const WORTHY = "worthy";
const PLACE = "place";
const FORD = "ford";
const HILL = "hill";
const MARSH = "marsh";
const WOOD = "wood";
const ROAD = "road";
// Beorning Beekeeper: "Action: Discard Beorning Beekeeper from play to deal 1 damage to each enemy in the staging area."
const BEEKEEPER = "02028";
// A Lore hero of Willpower 9 with no text, to quest and pay.
const STRIDER = "strider";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([INGOLD, RALLYING, HONOUR, SCOUT, ARAGORN, BEEKEEPER]))]);
  const hero = (code: string, sphere: "tactics" | "spirit") => definePrinted({ code, name: code, type: "hero", sphere, threat: 9, willpower: 2, attack: 2, defense: 1, health: 9 });
  cards.set(TACTICS, hero(TACTICS, "tactics"));
  cards.set(SPIRIT, hero(SPIRIT, "spirit"));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 4, defense: 9, health: 9 }));
  cards.set(GIANT, definePrinted({ code: GIANT, name: "Giant", type: "enemy", threat: 1, engagementCost: 50, attack: 8, defense: 9, health: 9 }));
  cards.set(OBJECTIVE, definePrinted({ code: OBJECTIVE, name: "Objective", type: "objective" }));
  cards.set(WORTHY, definePrinted({ code: WORTHY, name: "Worthy", type: "location", threat: 1, questPoints: 3, victory: 2 }));
  for (const code of [PLACE, FORD, HILL, MARSH, WOOD, ROAD]) cards.set(code, definePrinted({ code, name: code, type: "location", threat: 1, questPoints: 3 }));
  cards.set(STRIDER, definePrinted({ code: STRIDER, name: "Strider", type: "hero", sphere: "lore", threat: 9, willpower: 9, attack: 1, defense: 1, health: 5 }));
  base = { ...starter, cards };
});

// The combat phase on `tab`: its windows passed to the first defense, `defender` declared, and the run back at the Response window that
// follows the damage.
function defended(tab: Table, defender: string): Run {
  const run = atDefense(tab);
  return passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, defender) }, tab.ctx), tab.ctx);
}

describe("Ingold (10002:A:1)", () => {
  // "Ingold gets +1 Willpower for each hero you control with at least 1 resource in its resource pool.": three heroes with 1 resource each
  // give Willpower 0 + 3; Aragorn spends his on an ally, and Ingold has 2 in the state that intent returns. The other player's funded hero
  // does not count.
  lineSpec("10002:A:1", "Ingold: +1 Willpower for each hero you control with a resource", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: TACTICS, seat: 0 }, { code: SPIRIT, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: INGOLD, seat: 0 }], hand: [{ code: ALLY, seat: 0 }] }, 1);
    const ingold = idsOf(tab, INGOLD);
    expect(stat(tab.state, tab, ingold, "willpower")).toBe(3);
    const ally = idsOf(tab, ALLY);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: ally, payments: [{ heroId: idsOf(tab, ARAGORN), amount: 1 }] }, tab.ctx);
    expect(run.state.cards[ally]?.zone).toBe("play");
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(0);
    expect(stat(run.state, tab, ingold, "willpower")).toBe(2);
  });
});

describe("Rallying Cry (10003:A:1, A:2)", () => {
  // Aragorn (Leadership) pays for the Cry; the plain ally (Defense 1, 2 hit points) defends the Brute's attack (4) and is destroyed.
  function killed(effects: readonly Effect[], threat = 20): { tab: Table; run: Run } {
    const tab = threatened(table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: RALLYING, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }] }), threat);
    return { tab, run: defended(tab, ALLY) };
  }

  // "Response: After an ally leaves play, add it to its owner's hand instead of placing it in the discard pile.": the ally destroyed by the
  // attack goes to its owner's hand, not the discard pile; the Cry is paid (2) and goes to the discard pile.
  lineSpec("10003:A:1", "Rallying Cry: after an ally leaves play, it goes to its owner's hand", (effects) => {
    const { tab, run: pending } = killed(effects);
    const [ally, cry, aragorn] = [idsOf(tab, ALLY), idsOf(tab, RALLYING), idsOf(tab, ARAGORN)];
    expect(pending.state.cards[ally]?.zone).toBe("discard");
    expect(triggers(pending.state, tab)).toContain("10003:response:1");
    const run = sendUnledgered(pending, { type: "Trigger", cardId: cry, effectId: "10003:response:1", payments: [{ heroId: aragorn, amount: 2 }] }, tab.ctx);
    expect(run.state.cards[ally]?.zone).toBe("hand");
    expect(run.state.seats[0]?.hand).toContain(ally);
    expect(run.state.seats[0]?.discard).toEqual([cry]);
    expect(run.state.cards[aragorn]?.resources).toBe(6 - 2);
  });

  // "its owner's hand": the other player's ally destroyed by the attack of an enemy engaged with him goes to his hand, and the first player
  // pays for the Cry.
  it("10003:A:1 Rallying Cry: another player's ally goes to its owner's hand", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 1 }], hand: [{ code: RALLYING, seat: 0 }], engaged: [{ code: BRUTE, seat: 1 }] });
    const [ally, cry] = [idsOf(tab, ALLY), idsOf(tab, RALLYING)];
    let run = defended(tab, ALLY);
    run = passWhile(run, tab, (run) => !triggers(run.state, tab).includes("10003:response:1"), 3);
    expect(triggers(run.state, tab)).toContain("10003:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: cry, effectId: "10003:response:1", payments: [{ heroId: idsOf(tab, ARAGORN), amount: 2 }] }, tab.ctx);
    expect(run.state.seats[1]?.hand).toEqual([ally]);
    expect(run.state.seats[0]?.discard).toEqual([cry]);
  });

  // A hero that leaves play is not an ally: Aragorn alone defends the Giant (8 against Defense 2, 5 hit points) and the Cry is not offered.
  it("10003:A:1 Rallying Cry: not offered when a hero leaves play", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: SPIRIT, seat: 0 }], hand: [{ code: RALLYING, seat: 0 }], engaged: [{ code: GIANT, seat: 0 }] });
    const run = defended(tab, ARAGORN);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).not.toContain("10003:response:1");
  });

  // "Valour Action: Until the end of the phase, add each ally that leaves play to its owner's hand instead of placing it in the discard
  // pile.": at threat 40 the Cry is played in the combat action window; the ally destroyed by the attack goes to the hand.
  lineSpec("10003:A:2", "Rallying Cry: at threat 40, each ally that leaves play this phase goes to its owner's hand", (effects) => {
    const tab = threatened(table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: RALLYING, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }] }), 40);
    const [ally, cry] = [idsOf(tab, ALLY), idsOf(tab, RALLYING)];
    let run = combat(tab.state, tab);
    expect(canPlay(run.state, tab, cry)).toBe(true);
    run = passAll(play(run, tab, cry), tab.ctx);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(6 - 2);
    expect(run.state.window?.kind).toBe("defense");
    run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: ally }, tab.ctx), tab.ctx);
    expect(run.state.cards[ally]?.zone).toBe("hand");
    expect(run.state.seats[0]?.discard).toEqual([cry]);
  });

  // "Until the end of the phase": played in the planning phase, a Beorning Beekeeper discarded from play by its own Action goes to the
  // hand; in the quest phase that follows, the second Beekeeper goes to the discard pile.
  it("10003:A:2 Rallying Cry: the Valour Action ends with the phase", () => {
    const tab = threatened(table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: BEEKEEPER, seat: 0 }, { code: BEEKEEPER, seat: 0 }], hand: [{ code: RALLYING, seat: 0 }], staging: [BRUTE] }), 40);
    const [first = "", second = ""] = tab.ids[BEEKEEPER] ?? [];
    let run = play(begin(tab.state), tab, idsOf(tab, RALLYING));
    run = sendUnledgered(run, { type: "Trigger", cardId: first, effectId: "02028:action:1" }, tab.ctx);
    expect(run.state.cards[first]?.zone).toBe("hand");
    run = enter(run.state, tab, "questCommit");
    expect(run.state.phase).toBe("Quest");
    run = sendUnledgered(run, { type: "Trigger", cardId: second, effectId: "02028:action:1" }, tab.ctx);
    expect(run.state.cards[second]?.zone).toBe("discard");
  });

  // "Valour": at threat 39 the Action is not offered.
  it("10003:A:2 Rallying Cry: the Valour Action is not offered below threat 40", () => {
    const tab = threatened(table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: RALLYING, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }] }), 39);
    // The combat action window does not open, as nothing can be played in it: the run is at the defense.
    const run = combat(tab.state, tab);
    expect(run.state.window?.kind).toBe("defense");
    expect(canPlay(tab.state, tab, idsOf(tab, RALLYING))).toBe(false);
  });
});

describe("Honour Guard (10004:A:2)", () => {
  // The Spirit hero (Defense 1, 9 hit points) defends the Giant's attack (8): 7 damage is dealt to her.
  const giant = (effects: readonly Effect[], threat: number) => threatened(table(effects, { heroes: [{ code: SPIRIT, seat: 0 }, { code: TACTICS, seat: 0 }], allies: [{ code: HONOUR, seat: 0 }], engaged: [{ code: GIANT, seat: 0 }] }), threat);

  // "Valour Response: Exhaust and discard Honour Guard to cancel up to 5 damage just dealt to a character.": at threat 40, 5 of the 7 are
  // cancelled, and Honour Guard is in the discard pile.
  lineSpec("10004:A:2", "Honour Guard: at threat 40, exhaust and discard it to cancel up to 5 damage", (effects) => {
    const tab = giant(effects, 40);
    const [spirit, guard] = [idsOf(tab, SPIRIT), idsOf(tab, HONOUR)];
    let run = defended(tab, SPIRIT);
    expect(triggers(run.state, tab)).toContain("10004:response:2");
    run = passAll(sendUnledgered(run, { type: "Trigger", cardId: guard, effectId: "10004:response:2" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[spirit]?.damage).toBe(7 - 5);
    expect(run.state.cards[guard]?.zone).toBe("discard");
    expect(run.state.seats[0]?.discard).toEqual([guard]);
  });

  // "Valour": at threat 39 only the 1-point Response is offered, and the hero keeps all 7 damage when it is passed.
  it("10004:A:2 Honour Guard: the Valour Response is not offered below threat 40", () => {
    const tab = giant(EFFECTS, 39);
    const run = defended(tab, SPIRIT);
    expect(triggers(run.state, tab)).toContain("10004:response:1");
    expect(triggers(run.state, tab)).not.toContain("10004:response:2");
    expect(passAll(run, tab.ctx, { responses: true }).state.cards[idsOf(tab, SPIRIT)]?.damage).toBe(7);
  });
});

describe("Scout Ahead (10009:A:1, A:2)", () => {
  // "Limit 1 per deck.": a deck of 1 copy saves, one of 2 is refused.
  it("10009:A:1 Scout Ahead: limit 1 per deck", () => {
    const row = packRow("WoE", SCOUT);
    expect(row?.deckLimit).toBe(1);
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    expect(deckSaveRefusal(["h1"], [...events, { code: SCOUT, count: 1 }], deckSaveFacts(row))).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: SCOUT, count: 2 }], deckSaveFacts(row))).toMatchObject({ cardCode: SCOUT });
  });
});

describe("Scout Ahead (10009:A:2)", () => {
  // The player plays Scout Ahead (4 quest points) into the staging area, makes it the current quest, and the Strider (Willpower 9) quests on
  // it, so it is defeated. The staging step reveals the first card of `deck`.
  function defeated(effects: readonly Effect[], deck: readonly string[], seats: 1 | 2 = 1): { tab: Table; run: Run; scout: string } {
    const heroes = [{ code: STRIDER, seat: 0 }, ...(seats === 2 ? [{ code: PAL, seat: 1 }] : [])];
    const tab = table(effects, { seats, heroes, hand: [{ code: SCOUT, seat: 0 }], deck });
    const scout = idsOf(tab, SCOUT);
    let run = play(begin(tab.state), tab, scout);
    expect(run.state.cards[scout]?.zone).toBe("staging");
    // Each player passes the planning phase.
    for (let guard = 0; guard < 4 && run.state.window?.kind !== "choose"; guard += 1) run = passAll(sendUnledgered(run, { type: "Pass" }, tab.ctx), tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: scout }, tab.ctx);
    run = sendUnledgered(run, { type: "Commit", cardIds: [idsOf(tab, STRIDER)] }, tab.ctx);
    // The commit passes on to each other player, then the staging step reveals and the quest resolves.
    run = passWhile(run, tab, (run) => run.state.mode === "questCommit", 4);
    run = passAll(run, tab.ctx);
    return { tab, run, scout };
  }

  // "Response: When this stage is defeated, the first player searches the top X cards of the encounter deck for 1 non-objective card worth
  // no victory points and adds it to the victory display. Put the remaining cards back in any order. X is the number of players in the game
  // plus 4.": alone, X is 5. Under the revealed card, the top 5 are the objective, the location worth 2 victory points and three plain
  // locations, and the sixth is a plain location too: the three plain locations of the top 5 are offered, not the sixth, the objective or
  // the location worth points. The one picked goes to the victory display and the other four stay on top of the deck.
  lineSpec("10009:A:2", "Scout Ahead: when defeated, one card of the top 5 with no victory points and not an objective to the victory display", (effects) => {
    const { tab, run: pending, scout } = defeated(effects, [PLACE, OBJECTIVE, WORTHY, FORD, HILL, MARSH, WOOD]);
    const [objective, worthy, ford, hill, marsh, wood] = [OBJECTIVE, WORTHY, FORD, HILL, MARSH, WOOD].map((code) => idsOf(tab, code));
    expect(pending.state.cards[scout]?.zone).toBe("victory");
    expect(triggers(pending.state, tab)).toContain("10009:response:1");
    let run = sendUnledgered(pending, { type: "Trigger", cardId: scout, effectId: "10009:response:1" }, tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "look", cardIds: [objective, worthy, ford, hill, marsh] });
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([ford, hill, marsh].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: hill }, tab.ctx);
    expect(run.state.victory).toEqual([scout, hill]);
    // The other four go back on top in the order picked: the marsh first.
    expect(choices(run.state, tab).sort()).toEqual([objective, worthy, ford, marsh].sort());
    for (const id of [marsh, objective, worthy]) run = sendUnledgered(run, { type: "Choose", optionId: id }, tab.ctx);
    expect(run.state.encounterDeck).toEqual([marsh, objective, worthy, ford, wood]);
  });

  // "X is the number of players in the game plus 4.": with two players the staging step reveals two cards, and under them the sixth card,
  // the wood, is searched too; the seventh, the road, is not.
  it("10009:A:2 Scout Ahead: with two players the top 6 cards are searched", () => {
    const { tab, run: pending, scout } = defeated(EFFECTS, [PLACE, PLACE, WORTHY, OBJECTIVE, FORD, HILL, MARSH, WOOD, ROAD], 2);
    let run = sendUnledgered(pending, { type: "Trigger", cardId: scout, effectId: "10009:response:1" }, tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "look", cardIds: [WORTHY, OBJECTIVE, FORD, HILL, MARSH, WOOD].map((code) => idsOf(tab, code)) });
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([FORD, HILL, MARSH, WOOD].map((code) => idsOf(tab, code)).sort());
  });
});
