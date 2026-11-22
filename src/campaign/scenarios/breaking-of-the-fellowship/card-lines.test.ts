// Rules: rr.shadow-effects, faq.additional-attacks, rr.attachment-cards, rr.travel, rr.search, rr.in-play-and-out-of-play, rr.printed, rr.ownership-and-control,
// rr.response, mec109.multiple-staging-areas, mec109.setup, rr.boons (data/rules/entries.json). The encounter cards and the Lórien gifts of Breaking of the Fellowship,
// read from their printed lines: 142069:A:1, 142069:A:2, 142069:A:3, 142071:A:2, 142071:A:3, 142073:A:2, 142078:A:2, 142080:A:3, 142082:A:2, 142083:A:1,
// 142090:A:2, 142015:A:1, 142016:A:1, 142017:A:1, 142018:A:1 (data/printed/fellowship-of-the-ring.json). Each test plays the moment through the reducer on the
// scenario's own table (test/scenarios/breaking-of-the-fellowship/scene.ts), with separate staging areas once stage 2B has been played.
import { beforeAll, describe, expect, it } from "vitest";

import { definePrinted } from "../../../rules/core/printed.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { addStandIns, fightEnemy, first, type FightTable } from "../../../../test/harness/scene-kit.ts";
import { payFor } from "../../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { breakingGameWorld, breakingStart } from "../../../../test/scenarios/breaking-of-the-fellowship/game.ts";
import { codes, fire, ids, loadBreakingWorld, makeBreaking, PARTH_GALEN, type BreakingLayout, type BreakingTable, type BreakingWorld } from "../../../../test/scenarios/breaking-of-the-fellowship/scene.ts";

const CAPTAIN = "142069";
const TRACKER = "142071";
const SHORELINE = "142078";
const GROWING = "142080";
const ARROWS = "142082";
const FALLEN = "142083";
const ILL_FATE = "142090";
const SNARE = "01069";
const MINER = "01061";

let world: BreakingWorld;

beforeAll(async () => {
  world = await loadBreakingWorld();
  for (const [code, card] of await loadPrinted([SNARE, MINER])) world.cards.set(code, card);
  addStandIns(world.cards, ["f0", "attachment"]);
  const ally = (code: string, defense: number, health: number) => definePrinted({ code, name: code, type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense, health });
  // Printed hit points around the Captain's 3 and the Tracker's line of 2; a lore hero pays for Forest Snare and Miner of the Iron Hills.
  for (const card of [ally("ally2", 1, 2), ally("ally3", 1, 3), ally("wall2", 4, 2), ally("wall3", 4, 3), ally("frail", 0, 5), ally("sturdy", 0, 30)]) world.cards.set(card.code, card);
  world.cards.set("sage", definePrinted({ code: "sage", name: "sage", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 20 }));
}, 60_000);

// True solo after stage 2B: one seat on Orc Hunting (142066), its own staging area, the strong and the weak hero.
const SOLO: BreakingLayout = { seats: 1, stage: "separate", stages: ["142066"], frodo: false, heroes: [["strong", "weak"]], threats: [30] };
// Two-handed after stage 2B: seat 0 on Orc Hunting, seat 1 on Guard the Hobbits, each with its own staging area.
const TWO: BreakingLayout = { seats: 2, stage: "separate", stages: ["142066", "142064"], frodo: false, heroes: [["strong"], ["weak"]], threats: [30, 30] };

type Fighting = BreakingTable & FightTable;
// The scenario's table for scene-kit's fightEnemy: `allies` are put into play for the first seat; `hero` defends, `hero2` takes the archery.
function fightTable(base: BreakingLayout, allies: readonly string[] = []) {
  return (layout: BreakingLayout): Fighting => {
    const made = makeBreaking(world, { ...base, ...layout });
    const state = allies.reduce((current, code) => spawn(current, code, { zone: "play", seat: 0 }).state, made.state);
    return { ...made, state: syncConstants(state, made.ctx), hero: made.heroes[0]?.[0] ?? "", hero2: made.heroes[0]?.[1] ?? made.heroes[1]?.[0] ?? "" };
  };
}

function send(ctx: ReduceContext, state: ScenarioState, intent: PlayerIntent): ScenarioState {
  return expectOk(reduce(state, intent, ctx)).state;
}

// The planning phase of the table, the first seat to act.
const planning = (state: ScenarioState): ScenarioState => ({ ...state, phase: "Planning", boundaryPhase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0 });

describe("Uruk-hai Captain (142069)", () => {
  // "Cannot have attachments.": Forest Snare ("Attach to an enemy engaged with a player") is offered for the other engaged enemy, not for the Captain.
  it("142069:A:1 cannot have attachments: Forest Snare may go on another engaged enemy and not on the Captain", () => {
    const table = makeBreaking(world, { ...SOLO, heroes: [["sage"]], engaged: [{ code: CAPTAIN, seat: 0 }, { code: "grunt", seat: 0 }] });
    const snare = spawn(table.state, SNARE, { zone: "hand", seat: 0 });
    const state = syncConstants(planning(updateCard(snare.state, table.heroes[0]?.[0] ?? "", { resources: 5 })), table.ctx);
    const hosts = legalTargets(state, { type: "PlayCard", cardId: snare.id }, table.ctx);
    expect(hosts).toContain(first(state, "grunt"));
    expect(hosts).not.toContain(first(state, CAPTAIN));
    const refused = reduce(state, { type: "PlayCard", cardId: snare.id, hostId: first(state, CAPTAIN), payments: payFor(state, table.ctx, snare.id) }, table.ctx);
    expect(refused.ok).toBe(false);
  });

  // "Allies with fewer printed hit points than Uruk-hai Captain cannot defend against Uruk-hai Captain." The Captain has 3 printed hit points.
  it("142069:A:2 an ally with fewer printed hit points than the Captain cannot defend against it; one with as many can", () => {
    const table = fightTable(SOLO, ["ally2", "ally3"]);
    expect(() => fightEnemy(table, "f0", CAPTAIN, {}, { defender: (made) => first(made.state, "ally2") })).toThrow(/DeclareDefender refused/);
    // The Captain's 5 Attack against the ally's 1 Defense destroys it: it defended.
    const big = fightEnemy(table, "f0", CAPTAIN, {}, { defender: (made) => first(made.state, "ally3") });
    expect(big.run.state.cards[first(big.run.state, "ally3")]?.zone).toBe("discard");
  });

  it("142069:A:2 only the Captain's own attacks: the same small ally defends against another enemy", () => {
    const fight = fightEnemy(fightTable(SOLO, ["ally2"]), "f0", "grunt", {}, { defender: (made) => first(made.state, "ally2") });
    expect(fight.run.steps.some((step) => step.kind === "strike" && step.side === "enemy")).toBe(true);
  });

  // "Shadow: Attacking enemy makes an additional attack after this one." Undefended, the grunt's 1 Attack lands twice; the second attack is dealt a new shadow card.
  it("142069:A:3 the attacking enemy attacks again after the attack, dealt a new shadow card", () => {
    const fight = fightEnemy(fightTable(SOLO), CAPTAIN, "grunt", {}, { undefended: true });
    const hero = fight.made.hero;
    expect(fight.run.state.cards[hero]?.damage).toBe(2);
    // Four cards in the deck: the Captain as the first shadow, a stand-in as the second.
    expect(fight.run.state.encounterDeck).toHaveLength(2);
  });
});

describe("Uruk-hai Tracker (142071)", () => {
  // "Uruk-hai Tracker gets +2 Attack against characters with 2 or fewer printed hit points." Its 3 Attack against 4 Defense: 1 damage with the bonus, none without.
  it("142071:A:2 gets +2 Attack against a defender with 2 printed hit points, and not against one with 3", () => {
    const two = fightEnemy(fightTable(SOLO, ["wall2"]), "f0", TRACKER, {}, { defender: (made) => first(made.state, "wall2") });
    expect(two.run.state.cards[first(two.run.state, "wall2")]?.damage).toBe(1);
    const three = fightEnemy(fightTable(SOLO, ["wall3"]), "f0", TRACKER, {}, { defender: (made) => first(made.state, "wall3") });
    expect(three.run.state.cards[first(three.run.state, "wall3")]?.damage ?? 0).toBe(0);
  });

  // "Shadow: Discard a non-objective attachment you control." The defending player (seat 0) controls an attachment and The One Ring (an objective); seat 1 controls
  // another attachment. Asked, the test picks The One Ring or seat 1's card first, so a filter that offers them fails.
  it("142071:A:3 discards a non-objective attachment the defending player controls: not The One Ring, not the other player's", () => {
    let ring = "";
    let theirs = "";
    let mine = "";
    const tweak = (state: ScenarioState, made: Fighting): ScenarioState => {
      const own = spawn(state, "attachment", { zone: "play", seat: 0 });
      const other = spawn(attachTo(own.state, own.id, made.hero), "attachment", { zone: "play", seat: 1 });
      [mine, theirs, ring] = [own.id, other.id, made.ring ?? ""];
      return attachTo(other.state, other.id, made.heroes[1]?.[0] ?? "");
    };
    const pick = (state: ScenarioState): string => {
      const options = state.window?.kind === "choose" ? state.window.options : [];
      return options.find((id) => id === ring || id === theirs) ?? options[0] ?? "";
    };
    const fight = fightEnemy(fightTable({ ...TWO, frodo: true, heroes: [["strong"], ["weak"]] }), TRACKER, "grunt", {}, { tweak, pick });
    const state = fight.run.state;
    expect(state.cards[mine]?.zone).toBe("discard");
    expect(state.cards[ring]?.host).toBe(fight.made.frodo);
    expect(state.cards[theirs]?.host).toBe(fight.made.heroes[1]?.[0]);
  });
});

describe("Growing Threat (142080:A:3)", () => {
  // "Shadow: After this attack, move attacking enemy to the first player's staging area." One seat: the grunt is back in its staging area, no longer engaged.
  it("142080:A:3 moves the attacking enemy to the first player's staging area after the attack", () => {
    const fight = fightEnemy(fightTable(SOLO), GROWING, "grunt", {});
    const state = fight.run.state;
    const grunt = first(state, "grunt");
    expect(state.cards[grunt]?.zone).toBe("staging");
    expect(state.seats[0].staging).toContain(grunt);
    expect(state.seats[0].engaged).not.toContain(grunt);
    expect(state.cards[first(state, GROWING)]?.zone).toBe("encounterDiscard");
  });

  // Two players, seat 0 the first player: the grunt attacks seat 1 and goes to seat 0's staging area, not to seat 1's.
  it("142080:A:3 with two players the enemy goes to the first player's staging area, not the defending player's", () => {
    const fight = fightEnemy(fightTable(TWO), GROWING, "grunt", { engaged: [{ code: "grunt", seat: 1 }] }, { defender: (made) => made.heroes[1]?.[0] ?? "" });
    const state = fight.run.state;
    const grunt = first(state, "grunt");
    expect(fight.start.firstPlayer).toBe(0);
    expect(state.seats[0].staging).toContain(grunt);
    expect(state.seats[1].staging).not.toContain(grunt);
    expect(state.seats[1].engaged).not.toContain(grunt);
  });
});

describe("Black Feathered Arrows (142082:A:2)", () => {
  // "Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if the defending character has fewer printed hit points than the attacking enemy)." The brute has 1 Attack
  // and 20 hit points; both defenders have 0 Defense.
  it("142082:A:2 gives +2 Attack instead of +1 against a defender with fewer printed hit points than the attacker", () => {
    const frail = fightEnemy(fightTable(SOLO, ["frail"]), ARROWS, "brute", {}, { defender: (made) => first(made.state, "frail") });
    expect(frail.run.state.cards[first(frail.run.state, "frail")]?.damage).toBe(3);
  });

  it("142082:A:2 gives +1 Attack against a defender with more printed hit points than the attacker", () => {
    const sturdy = fightEnemy(fightTable(SOLO, ["sturdy"]), ARROWS, "brute", {}, { defender: (made) => first(made.state, "sturdy") });
    expect(sturdy.run.state.cards[first(sturdy.run.state, "sturdy")]?.damage).toBe(2);
  });
});

describe("the Travel effects of Parth Galen (142073:A:2) and Wooded Shoreline (142078:A:2)", () => {
  // "Search the encounter deck and discard pile for an enemy and add it to [this] staging area to travel here. Shuffle the encounter deck." Seat 1 travels; the only enemy
  // out of play is in the discard pile; an enemy already in seat 1's staging area and one engaged are in play and are not what the search finds.
  const DECK = ["mist", "place", "filler", "mist", "place", "filler"];
  it.each([
    ["142073:A:2", PARTH_GALEN],
    ["142078:A:2", SHORELINE],
  ])("%s finds an enemy in the discard pile, adds it to the traveling seat's staging area and shuffles the encounter deck", (_line, location) => {
    const table = makeBreaking(world, { ...TWO, areas: [[], [location, "scout"]], deck: DECK, discard: ["grunt", "mist"], engaged: [{ code: "brute", seat: 1 }], phase: "Travel" });
    const before = table.state.encounterDeck;
    let state = send(table.ctx, { ...table.state, travelDone: [0], activeSeat: 1 }, { type: "Travel", locationId: first(table.state, location) });
    for (let guard = 0; guard < 6 && state.window?.kind === "choose"; guard += 1) state = send(table.ctx, state, { type: "Choose", optionId: state.window.options[0] ?? "" });
    expect(state.seats[1].active).toBe(first(state, location));
    const grunt = first(state, "grunt");
    expect(state.seats[1].staging).toContain(grunt);
    expect(state.cards[grunt]?.zone).toBe("staging");
    expect(state.seats[0].staging).toEqual([]);
    expect(state.cards[first(state, "scout")]?.zone).toBe("staging");
    expect(state.cards[first(state, "brute")]?.zone).toBe("engaged");
    expect([...state.encounterDeck].sort()).toEqual([...before].sort());
    expect(state.encounterDeck).not.toEqual(before);
  });
});

describe("Fallen Into Evil (142083:A:1) and Ill Fate (142090:A:2) count as Condition attachments", () => {
  // Miner of the Iron Hills: "Response: After Miner of the Iron Hills enters play, choose and discard 1 Condition attachment from play."
  function playMiner(table: BreakingTable, state: ScenarioState): ScenarioState {
    const miner = spawn(state, MINER, { zone: "hand", seat: 0 });
    const ready = syncConstants(planning(updateCard(miner.state, first(miner.state, "sage"), { resources: 5 })), table.ctx);
    let next = send(table.ctx, ready, { type: "PlayCard", cardId: miner.id, payments: payFor(ready, table.ctx, miner.id) });
    const trigger = legalIntents(next, table.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "01061:response:1");
    expect(trigger, "Miner of the Iron Hills' Response is offered").toBeDefined();
    next = send(table.ctx, next, trigger as PlayerIntent);
    for (let guard = 0; guard < 6 && next.window?.kind === "choose"; guard += 1) next = send(table.ctx, next, { type: "Choose", optionId: next.window.options[0] ?? "" });
    return next;
  }

  // "(Counts as a Condition attachment with the text: ... If Fallen into Evil is discarded, return attached hero to its owner's control.)" Seat 1's weak hero falls into
  // the first player's staging area; seat 0 discards the Condition with Miner of the Iron Hills.
  function fallAndDiscard(): { state: ScenarioState; hero: string } {
    const table = makeBreaking(world, { ...TWO, heroes: [["sage"], ["strong", "weak"]], areas: [[FALLEN], []] });
    const hero = table.heroes[1]?.[1] ?? "";
    const fallen = fire(table, table.state, first(table.state, FALLEN), "142083:whenRevealed:1", [hero], "whenRevealed", 0);
    expect(fallen.seats[0].staging).toContain(hero);
    return { state: playMiner(table, fallen), hero };
  }

  it("142083:A:1 is a Condition attachment a player card can discard", () => {
    const { state } = fallAndDiscard();
    expect(state.cards[first(state, FALLEN)]?.zone).toBe("encounterDiscard");
  });

  // FAULT: the card prints "If Fallen into Evil is discarded, return attached hero to its owner's control", but discarded by a player card (Miner of the Iron Hills) it
  // leaves the hero in the staging area as the enemy weak~enemy: no leftPlay event is announced for it, so 142083:triggered:1 never runs.
  it.fails("142083:A:1 discarded by a player card, it returns the attached hero to its owner's control", () => {
    const { state, hero } = fallAndDiscard();
    expect(state.cards[hero]?.code).toBe("weak");
    expect(state.cards[hero]?.controller).toBe(1);
    expect(state.seats[1].heroes).toContain(hero);
    expect(state.seats[0].heroes).not.toContain(hero);
    expect(state.seats[0].staging).not.toContain(hero);
  });

  it("142090:A:2 is a Condition attachment a player card can discard", () => {
    const table = makeBreaking(world, { ...SOLO, heroes: [["sage", "strong"]], areas: [[ILL_FATE]] });
    const fate = first(table.state, ILL_FATE);
    const attached = fire(table, table.state, fate, "142090:whenRevealed:1", [table.heroes[0]?.[1] ?? ""], "whenRevealed", 0);
    expect(attached.cards[fate]?.zone).toBe("attached");
    const state = playMiner(table, attached);
    expect(state.cards[fate]?.zone).toBe("encounterDiscard");
  });
});

describe("the Lórien gifts: Setup: Attach to a hero in play (142015:A:1 to 142018:A:1)", () => {
  // A gift shuffled into its player's deck is found by the Setup and attached to a hero in play; it is not left in the deck or the opening hand.
  it.each([
    ["142015:A:1", "142015"],
    ["142016:A:1", "142016"],
    ["142017:A:1", "142017"],
    ["142018:A:1", "142018"],
  ])("%s attaches the gift found in the player's deck to a hero in play", async (_line, code) => {
    const { ctx } = await breakingGameWorld();
    const start = breakingStart(1, 3);
    const seats = start.seats.map((seat, index) => (index === 0 ? { ...seat, deck: [...seat.deck, code] } : seat));
    let state = startScenario({ ...start, seats }, ctx);
    for (let guard = 0; guard < 10 && state.window?.kind !== "mulligan" && state.window?.kind === "choose"; guard += 1) state = send(ctx, state, { type: "Choose", optionId: state.window.options[0] ?? "" });
    const gifts = ids(state, code);
    expect(gifts).toHaveLength(1);
    const gift = state.cards[gifts[0] ?? ""];
    expect(gift?.zone).toBe("play");
    expect(state.seats[0].heroes).toContain(gift?.host);
    expect(codes(state, state.seats[0].hand)).not.toContain(code);
  });
});
