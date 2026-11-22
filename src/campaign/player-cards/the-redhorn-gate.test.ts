// Rules: rr.response, rr.action, rr.forced, rr.attachment-cards, rr.limits, rr.modifiers, rr.in-play-and-out-of-play, rr.ready,
// rr.reveal, rr.play-and-put-into-play, rr.event-cards, rr.drawing-cards, rr.damage, rr.destroy, rr.resources, trg.secrecy
// (data/rules/entries.json).
// The Redhorn Gate player cards, each printed line tested from the words on the card: Elrohir 04001:A:1 and A:2, Taking Initiative
// 04002:A:1, Timely Aid 04003:A:2, Keeping Count 04005:A:1 and A:3, Renewed Friendship 04007:A:1, Good Meal 04010:A:1. The lines are the
// text of data/cards (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, combat, hosts, passAll, play, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ELROHIR = "04001";
const INITIATIVE = "04002";
const TIMELY = "04003";
const COUNT = "04005";
const FRIENDSHIP = "04007";
const MEAL = "04010";
// Elladan: the hero (Tactics) and the ally (Lore, cost 3).
const ELLADAN = "04028";
const ELLADAN_ALLY = "146007";
// Cards with no text: a Lore hero, a Tactics hero of Attack 3, a Spirit Hobbit hero, an ally that is a Hobbit, unique allies, and events of
// printed cost 1, 2 and 3 for the top of a deck.
const SAGE = "sage";
const TACTICIAN = "tactician";
const HOBBIT = "spirit-hobbit";
const HOBBIT_ALLY = "hobbit-ally";
const HERO_FRIEND = "hero-friend";
const UNIQUE = "unique-ally";
const COST1 = "cost1";
const COST2 = "cost2";
const COST3 = "cost3";
const PAL = "pal";
const ALLY = "ally";
// Enemies: one a single hit kills, and one no attack here destroys.
const FRAIL = "frail";
const WALL = "wall";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([ELROHIR, INITIATIVE, TIMELY, COUNT, FRIENDSHIP, MEAL, ELLADAN, ELLADAN_ALLY]))]);
  cards.set(SAGE, definePrinted({ code: SAGE, name: "Sage", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 4 }));
  cards.set(TACTICIAN, definePrinted({ code: TACTICIAN, name: "Tactician", type: "hero", sphere: "tactics", threat: 8, willpower: 1, attack: 3, defense: 1, health: 4 }));
  cards.set(HOBBIT, definePrinted({ code: HOBBIT, name: "Spirit Hobbit", type: "hero", sphere: "spirit", threat: 6, willpower: 1, attack: 1, defense: 1, health: 3, traits: ["Hobbit"] }));
  cards.set(HOBBIT_ALLY, definePrinted({ code: HOBBIT_ALLY, name: "Hobbit Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Hobbit"] }));
  cards.set(HERO_FRIEND, definePrinted({ code: HERO_FRIEND, name: "Hero Friend", type: "hero", sphere: "leadership", threat: 8, willpower: 1, attack: 1, defense: 1, health: 4 }));
  cards.set(UNIQUE, definePrinted({ code: UNIQUE, name: "Unique Ally", type: "ally", sphere: "leadership", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2, isUnique: true }));
  for (const [code, cost] of [[COST1, 1], [COST2, 2], [COST3, 3]] as const) cards.set(code, definePrinted({ code, name: code, type: "event", sphere: "lore", cost }));
  cards.set(FRAIL, definePrinted({ code: FRAIL, name: "Frail", type: "enemy", threat: 1, engagementCost: 40, attack: 0, defense: 0, health: 1 }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 40, attack: 0, defense: 3, health: 9 }));
  base = { ...starter, cards };
});

describe("Elrohir (04001:A:1, A:2)", () => {
  // "While Elladan is in play, Elrohir gets +2 Defense.": with Elladan in the hand Elrohir has his printed Defense; the ally Elladan,
  // played from the hand, gives him +2 in the state that intent returns.
  lineSpec("04001:A:1", "Elrohir: +2 Defense once Elladan is played", (effects) => {
    const tab = table(effects, { heroes: [{ code: ELROHIR, seat: 0 }, { code: SAGE, seat: 0 }], hand: [{ code: ELLADAN_ALLY, seat: 0 }] });
    const elrohir = idsOf(tab, ELROHIR);
    expect(stat(tab.state, tab, elrohir, "defense")).toBe(1);
    const run = play(begin(tab.state), tab, idsOf(tab, ELLADAN_ALLY));
    expect(stat(run.state, tab, elrohir, "defense")).toBe(1 + 2);
  });

  // "in play": the hero Elladan controlled by the other player counts too.
  it("04001:A:1 Elrohir: the other player's Elladan counts", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: ELROHIR, seat: 0 }, { code: ELLADAN, seat: 1 }] });
    expect(stat(tab.state, tab, idsOf(tab, ELROHIR), "defense")).toBe(1 + 2);
  });

  // Elrohir and the Sage, a Wall engaged with the player: the combat phase runs to the defense step of the Wall's attack.
  function defending(effects: readonly Effect[], resources = 6): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: ELROHIR, seat: 0 }, { code: SAGE, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] }, resources);
    return { tab, run: passAll(combat(tab.state, tab), tab.ctx) };
  }

  // "Response: After Elrohir is declared as a defender, pay 1 resource from his resource pool to ready him.": Elrohir defends, pays 1 of
  // his 6 resources and is ready again.
  lineSpec("04001:A:2", "Elrohir: after he is declared as a defender, pay 1 resource from his pool to ready him", (effects) => {
    const { tab, run: start } = defending(effects);
    const elrohir = idsOf(tab, ELROHIR);
    expect(start.state.window?.kind).toBe("defense");
    let run = sendUnledgered(start, { type: "DeclareDefender", defenderId: elrohir }, tab.ctx);
    expect(run.state.cards[elrohir]?.exhausted).toBe(true);
    expect(triggers(run.state, tab)).toContain("04001:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: elrohir, effectId: "04001:response:1", payments: [{ heroId: elrohir, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[elrohir]?.exhausted).toBe(false);
    expect(run.state.cards[elrohir]?.resources).toBe(6 - 1);
  });

  // With no resource in his pool the cost cannot be paid; when the Sage defends Elrohir is not declared: neither offers the Response.
  it("04001:A:2 Elrohir: not offered with an empty pool, nor when another character defends", () => {
    const empty = defending(EFFECTS, 0);
    const run = sendUnledgered(empty.run, { type: "DeclareDefender", defenderId: idsOf(empty.tab, ELROHIR) }, empty.tab.ctx);
    expect(triggers(run.state, empty.tab)).not.toContain("04001:response:1");
    const other = defending(EFFECTS);
    const sage = sendUnledgered(other.run, { type: "DeclareDefender", defenderId: idsOf(other.tab, SAGE) }, other.tab.ctx);
    expect(triggers(sage.state, other.tab)).not.toContain("04001:response:1");
  });
});

describe("Taking Initiative (04002:A:1)", () => {
  // The Pal and the Hero Friend (2 characters the player controls; the other player's Sage is not one), the card given on top of the
  // deck, two cards under it, a Wall engaged with the other player and a Frail one in the staging area.
  function initiative(effects: readonly Effect[], top: string): { tab: Table; run: Run } {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: HERO_FRIEND, seat: 0 }, { code: SAGE, seat: 1 }], hand: [{ code: INITIATIVE, seat: 0 }], playerDeck: [{ code: top, seat: 0 }, { code: "card", seat: 0 }, { code: "card", seat: 0 }], engaged: [{ code: WALL, seat: 1 }], staging: [FRAIL] });
    return { tab, run: play(begin(tab.state), tab, idsOf(tab, INITIATIVE)) };
  }

  // "Action: Discard the top card of your deck. If the discarded card's printed cost is equal to or higher than the number of characters
  // you control, draw 2 cards and deal 2 damage to any enemy.": a top card of cost 2 against 2 characters: it is discarded, the player
  // draws 2 and chooses any enemy (the one engaged with the other player is a choice), which takes 2 damage.
  lineSpec("04002:A:1", "Taking Initiative: a discarded cost equal to the characters you control draws 2 and deals 2 damage to any enemy", (effects) => {
    const { tab, run: played } = initiative(effects, COST2);
    const [top, wall, frail] = [idsOf(tab, COST2), idsOf(tab, WALL), idsOf(tab, FRAIL)];
    expect(played.state.cards[top]?.zone).toBe("discard");
    expect(played.state.seats[0]?.deck).toHaveLength(0);
    expect(played.state.seats[0]?.hand).toEqual(expect.arrayContaining(tab.ids.card ?? []));
    expect(choices(played.state, tab).sort()).toEqual([wall, frail].sort());
    const run = sendUnledgered(played, { type: "Choose", optionId: wall }, tab.ctx);
    expect(run.state.cards[wall]?.damage).toBe(2);
    expect(run.state.cards[frail]?.zone).toBe("staging");
    expect(run.state.cards[idsOf(tab, INITIATIVE)]?.zone).toBe("discard");
    expect(run.state.seats[0]?.hand).toHaveLength(2);
  });

  // A top card of cost 1 is lower than the 2 characters: it is discarded and nothing else happens.
  it("04002:A:1 Taking Initiative: a lower cost draws nothing and deals no damage", () => {
    const { tab, run } = initiative(EFFECTS, COST1);
    expect(run.state.cards[idsOf(tab, COST1)]?.zone).toBe("discard");
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.seats[0]?.hand).toHaveLength(0);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    expect(run.state.cards[idsOf(tab, WALL)]?.damage).toBe(0);
    expect(run.state.cards[idsOf(tab, FRAIL)]?.damage).toBe(0);
  });

  // An ally played first makes 3 characters: the cost 2 card is now lower.
  it("04002:A:1 Taking Initiative: an ally the player controls counts as a character", () => {
    const tab = table(EFFECTS, { heroes: [{ code: PAL, seat: 0 }, { code: HERO_FRIEND, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: INITIATIVE, seat: 0 }], playerDeck: [{ code: COST2, seat: 0 }, { code: "card", seat: 0 }, { code: "card", seat: 0 }], staging: [FRAIL] });
    const run = play(begin(tab.state), tab, idsOf(tab, INITIATIVE));
    expect(run.state.cards[idsOf(tab, COST2)]?.zone).toBe("discard");
    expect(run.state.seats[0]?.hand).toHaveLength(0);
  });
});

describe("Timely Aid (04003:A:2)", () => {
  // The deck from the top: a card, the Ally, two cards, the Unique Ally, the Hobbit Ally (sixth) and a card; the Pal pays.
  const deck = [{ code: "card", seat: 0 }, { code: ALLY, seat: 0 }, { code: COST1, seat: 0 }, { code: COST2, seat: 0 }, { code: UNIQUE, seat: 0 }, { code: HOBBIT_ALLY, seat: 0 }, { code: COST3, seat: 0 }];

  // "Action: Reveal the top 5 cards of your deck and put 1 revealed ally into play, if able. Shuffle all other revealed cards back into
  // your deck.": the two allies among the top 5 are the choices, the sixth card is not; the chosen one enters play, the other stays in
  // the deck, which is shuffled. Secrecy 3 (threat 8): it costs 1.
  lineSpec("04003:A:2", "Timely Aid: one ally of the top 5 into play, the others shuffled back", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }], hand: [{ code: TIMELY, seat: 0 }], playerDeck: deck });
    const [ally, unique, sixth, pal] = [idsOf(tab, ALLY), idsOf(tab, UNIQUE), idsOf(tab, HOBBIT_ALLY), idsOf(tab, PAL)];
    const before = tab.state.seats[0]?.deck ?? [];
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, TIMELY), payments: [{ heroId: pal, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[pal]?.resources).toBe(6 - 1);
    expect(choices(run.state, tab).sort()).toEqual([ally, unique].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: unique }, tab.ctx);
    expect(run.state.cards[unique]).toMatchObject({ zone: "play", controller: 0 });
    expect(run.state.cards[ally]?.zone).toBe("deck");
    expect(run.state.cards[sixth]?.zone).toBe("deck");
    const after = run.state.seats[0]?.deck ?? [];
    expect([...after].sort()).toEqual(before.filter((id) => id !== unique).sort());
    expect(after).not.toEqual(before.filter((id) => id !== unique));
  });

  // "if able": a unique ally whose copy is in play cannot enter play, so the Ally is put into play without a choice.
  it("04003:A:2 Timely Aid: a unique ally with a copy in play is not a choice", () => {
    const tab = table(EFFECTS, { heroes: [{ code: PAL, seat: 0 }], allies: [{ code: UNIQUE, seat: 0 }], hand: [{ code: TIMELY, seat: 0 }], playerDeck: deck });
    const ally = idsOf(tab, ALLY);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, TIMELY), payments: [{ heroId: idsOf(tab, PAL), amount: 1 }] }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[ally]?.zone).toBe("play");
    expect(run.state.cards[tab.ids[UNIQUE]?.[1] ?? ""]?.zone).toBe("deck");
  });
});

describe("Keeping Count (04005:A:1, A:3)", () => {
  // "Attach to a hero. Limit 1 per hero.": the Tactician and the Pal are offered; the Sage, who holds a copy already, and an ally are not.
  lineSpec("04005:A:1", "Keeping Count: Attach to a hero, limit 1 per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: TACTICIAN, seat: 0 }, { code: PAL, seat: 0 }, { code: SAGE, seat: 0 }], attached: [{ code: COUNT, host: SAGE }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: COUNT, seat: 0 }] });
    const count = tab.ids[COUNT]?.[1] ?? "";
    expect(hosts(tab, count)).toEqual([idsOf(tab, TACTICIAN), idsOf(tab, PAL)].sort());
    expect(play(begin(tab.state), tab, count, idsOf(tab, PAL)).state.cards[count]?.host).toBe(idsOf(tab, PAL));
  });

  // The Tactician holds Keeping Count; the Frail enemy (1 hit point) and the Wall are engaged with the player.
  const counted = (effects: readonly Effect[]) =>
    table(effects, { heroes: [{ code: TACTICIAN, seat: 0 }, { code: PAL, seat: 0 }], attached: [{ code: COUNT, host: TACTICIAN }], engaged: [{ code: FRAIL, seat: 0 }, { code: WALL, seat: 0 }] });

  // "Forced: After attached hero attacks and destroys an enemy, place 1 resource token on this card.": the Tactician destroys the Frail
  // enemy and the card holds 1 resource token.
  lineSpec("04005:A:3", "Keeping Count: 1 resource token after the attached hero attacks and destroys an enemy", (effects) => {
    const tab = counted(effects);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, FRAIL), attackerIds: [idsOf(tab, TACTICIAN)] }, tab.ctx);
    run = passAll(run, tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, FRAIL)]?.zone).not.toBe("engaged");
    expect(run.state.cards[idsOf(tab, COUNT)]?.resources).toBe(1);
  });

  // An attack that does not destroy the Wall, and the Pal destroying the Frail enemy, place nothing.
  it("04005:A:3 Keeping Count: nothing when the enemy survives or another character destroys it", () => {
    const tab = counted(EFFECTS);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [idsOf(tab, TACTICIAN)] }, tab.ctx);
    run = passAll(run, tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, WALL)]?.zone).toBe("engaged");
    expect(run.state.cards[idsOf(tab, COUNT)]?.resources).toBe(0);
    expect(run.state.window?.kind).toBe("playerAttack");
    run = passAll(sendUnledgered(run, { type: "DeclareAttackers", enemyId: idsOf(tab, FRAIL), attackerIds: [idsOf(tab, PAL)] }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, FRAIL)]?.zone).not.toBe("engaged");
    expect(run.state.cards[idsOf(tab, COUNT)]?.resources).toBe(0);
  });
});

describe("Renewed Friendship (04007:A:1)", () => {
  // The first player holds Renewed Friendship and the Spirit Hobbit; the other player (the Pal, exhausted, and the Hero Friend) plays
  // Good Meal on the Spirit Hobbit, or on his own Pal.
  function friendship(effects: readonly Effect[], host: string): { tab: Table; run: Run } {
    const scene = table(effects, { seats: 2, heroes: [{ code: HOBBIT, seat: 0 }, { code: PAL, seat: 1 }, { code: HERO_FRIEND, seat: 1 }], hand: [{ code: FRIENDSHIP, seat: 0 }, { code: MEAL, seat: 1 }], playerDeck: [{ code: "card", seat: 1 }, { code: "card", seat: 1 }] });
    const tab = { ...scene, state: updateCard(scene.state, idsOf(scene, PAL), { exhausted: true }) };
    // Both players pass the first player's planning window; in the other player's own window, that player plays Good Meal.
    const passed = sendUnledgered(sendUnledgered(begin(tab.state), { type: "Pass" }, tab.ctx), { type: "Pass" }, tab.ctx);
    expect(passed.state.planningSeat).toBe(1);
    return { tab, run: sendUnledgered(passed, { type: "PlayCard", cardId: idsOf(tab, MEAL), hostId: idsOf(tab, host), payments: [] }, tab.ctx) };
  }
  const answer = (tab: Table, run: Run, option: string): Run => {
    const played = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, FRIENDSHIP), effectId: "04007:response:1", payments: [] }, tab.ctx);
    expect(choices(played.state, tab)).toEqual(expect.arrayContaining(["ready", "draw", "threat"]));
    return sendUnledgered(played, { type: "Choose", optionId: option }, tab.ctx);
  };

  // "Response: After another player plays an attachment on a hero you control, you may (choose 1): ready 1 of that player's heroes, have
  // that player draw 1 card, or lower that player's threat by 2.": each option acts on the other player.
  // FAULT: the card answers another player playing an attachment on your hero, but the engine reads who controls the attachment once it is
  // attached (the hero's controller, rr.attachment-cards), so the Response is never offered.
  it.fails("04007:A:1 Renewed Friendship: after another player plays an attachment on your hero, ready, draw or lower threat for that player", () => {
    const first = friendship(EFFECTS, HOBBIT);
    expect(first.run.state.cards[idsOf(first.tab, MEAL)]?.host).toBe(idsOf(first.tab, HOBBIT));
    expect(triggers(first.run.state, first.tab)).toContain("04007:response:1");
    const threat = answer(first.tab, first.run, "threat");
    expect(threat.state.seats[1]?.threat).toBe(6 - 2);
    expect(threat.state.seats[0]?.threat).toBe(8);
    const drawn = answer(first.tab, first.run, "draw");
    expect(drawn.state.seats[1]?.hand).toHaveLength(1);
    const readied = answer(first.tab, first.run, "ready");
    expect(readied.state.cards[idsOf(first.tab, PAL)]?.exhausted).toBe(false);
  });

  // The other player's attachment on his own hero is not on a hero you control: no Response.
  it("04007:A:1 Renewed Friendship: not offered for an attachment on the other player's own hero", () => {
    const { tab, run } = friendship(EFFECTS, PAL);
    expect(run.state.cards[idsOf(tab, MEAL)]?.host).toBe(idsOf(tab, PAL));
    expect(triggers(run.state, tab)).not.toContain("04007:response:1");
  });

  // An attachment the first player plays on his own hero is not played by another player: no Response.
  it("04007:A:1 Renewed Friendship: not offered for your own attachment", () => {
    const tab = table(EFFECTS, { heroes: [{ code: HOBBIT, seat: 0 }], hand: [{ code: FRIENDSHIP, seat: 0 }, { code: MEAL, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, MEAL), idsOf(tab, HOBBIT));
    expect(triggers(run.state, tab)).not.toContain("04007:response:1");
  });
});

describe("Good Meal (04010:A:1)", () => {
  // "Attach to a Hobbit hero.": the Pal and the Spirit Hobbit (Hobbit heroes) are offered; the Sage (not a Hobbit) and a Hobbit ally are not.
  lineSpec("04010:A:1", "Good Meal: Attach to a Hobbit hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: HOBBIT, seat: 0 }, { code: SAGE, seat: 0 }], allies: [{ code: HOBBIT_ALLY, seat: 0 }], hand: [{ code: MEAL, seat: 0 }] });
    const meal = idsOf(tab, MEAL);
    expect(hosts(tab, meal)).toEqual([idsOf(tab, PAL), idsOf(tab, HOBBIT)].sort());
    expect(play(begin(tab.state), tab, meal, idsOf(tab, HOBBIT)).state.cards[meal]?.host).toBe(idsOf(tab, HOBBIT));
  });
});
