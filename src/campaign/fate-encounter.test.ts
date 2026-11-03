// Rules: dcce.uncharted, rr.engaged, rr.shadow-effects, rr.search, rr.refresh-phase, rr.discard-pile-and-victory-display, rr.attachment-cards (data/rules/entries.json). The encounter cards
// of The Fate of Númenor that no template reads (the Fate of Númenor, Drowned Dead and Ruins of Númenor sets): each line of the ledger (data/printed/dream-chaser.json) has a record, and these
// tests run them on a table of plain-number heroes (scripts/fate-scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/interpret/constants.ts";
import { modifiedStat } from "../rules/core/keywords.ts";
import { runInstruction } from "../rules/interpret/interpret.ts";
import { settle } from "../rules/engine/machine.ts";
import { legalIntents, type PlayerIntent } from "../rules/engine/reduce.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { CODES, codesIn, fateFight, fateTable, finish, idOf, loadFateWorld, resolveReveal, send, start, type FateLayout, type FateWorld, type Run } from "../../scripts/fate-scene.ts";

let world: FateWorld;

beforeAll(async () => {
  world = await loadFateWorld();
});

function make(layout: FateLayout = {}) {
  const made = fateTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}
type Table = ReturnType<typeof make>;

// An answer that takes the option `wanted` when a window offers it, else the first option (the question a card that follows asks).
const choose = (wanted: string) => (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.includes(wanted) ? wanted : (state.window.options[0] ?? "")) : "");
const L = (code: string, progress = 0) => ({ code, face: "B" as const, progress });
const stat = (made: Table, state: ScenarioState, code: string, which: "attack" | "willpower" | "threat" | "defense" | "hitPoints") => modifiedStat(state, state.cards[idOf(state, code)]!, which, made.ctx.cards);
const handCodes = (state: ScenarioState, seat = 0) => (state.seats[seat]?.hand ?? []).map((id) => state.cards[id]?.code);
const deckCodes = (state: ScenarioState, seat = 0) => (state.seats[seat]?.deck ?? []).map((id) => state.cards[id]?.code);
const discardCodes = (state: ScenarioState, seat = 0) => (state.seats[seat]?.discard ?? []).map((id) => state.cards[id]?.code);

// An enemy engages seat 0 in the encounter phase (the player's threat is high enough to engage it by choice); the Forced effect it opens is settled, look windows closed, choices answered.
function engage(made: Table, code: string, pick?: (state: ScenarioState) => string): Run {
  const id = idOf(made.state, code);
  return finish(send(start(made.state), { type: "Engage", enemyId: id }, made.ctx), made.ctx, pick);
}

describe("Servant of the Deceiver (11029:A:1)", () => {
  it("looks at the top card of the engaged player's deck when it engages them; at a printed cost of 2 or less the card goes to the bottom and the Servant gets +2 Attack until the end of the round", () => {
    const cheap = make({ phase: "Encounter", threat: [40, 26], staging: [CODES.servant], deckOf: ["c1", "c3", "c5"] });
    expect(stat(cheap, cheap.state, CODES.servant, "attack")).toBe(3);
    const done = engage(cheap, CODES.servant);
    expect(deckCodes(done.state)).toEqual(["c3", "c5", "c1"]);
    expect(stat(cheap, done.state, CODES.servant, "attack")).toBe(5);
    expect(done.state.modifiers.some((modifier) => modifier.stat === "attack" && modifier.until === "endOfRound")).toBe(true);
    const costly = engage(make({ phase: "Encounter", threat: [40, 26], staging: [CODES.servant], deckOf: ["c3", "c1", "c5"] }), CODES.servant);
    expect(deckCodes(costly.state)).toEqual(["c3", "c1", "c5"]);
    expect(stat(cheap, costly.state, CODES.servant, "attack")).toBe(3);
  });
});

describe("Steep Plateau (11032:A:1, 11032:A:2)", () => {
  it("offers a look at the facedown side of an Uncharted location in the staging area after it is explored (11032:A:1)", () => {
    const made = make({ active: { code: CODES.steepPlateau, progress: 2 }, staging: [L(CODES.lushJungle)], uncharted: [] });
    const next = runInstruction({ ...made.state, window: null }, { verb: "ProgressQuest", amount: 1 }, { seat: 0, sourceId: made.state.questStage }, made.ctx, []);
    const state = settle(syncConstants(next, made.ctx), made.ctx, []);
    expect(state.window?.kind).toBe("response");
    const offered = legalIntents(state, made.ctx).filter((intent): intent is Extract<PlayerIntent, { type: "Trigger" }> => intent.type === "Trigger");
    expect(offered.map((intent) => intent.effectId)).toEqual(["11032:response:1"]);
    const looked = send(start(state), offered[0]!, made.ctx);
    expect(looked.state.window).toMatchObject({ kind: "look", cardIds: [idOf(state, CODES.lushJungle)], side: "A" });
    expect(looked.state.cards[idOf(state, CODES.lushJungle)]?.face).toBe("B");
  });

  it("is not offered with no Uncharted location in the staging area", () => {
    const made = make({ active: { code: CODES.steepPlateau, progress: 2 }, staging: [CODES.fog] });
    const next = runInstruction({ ...made.state, window: null }, { verb: "ProgressQuest", amount: 1 }, { seat: 0, sourceId: made.state.questStage }, made.ctx, []);
    const state = settle(syncConstants(next, made.ctx), made.ctx, []);
    expect(legalIntents(state, made.ctx).filter((intent) => intent.type === "Trigger")).toEqual([]);
  });

  it("as a Shadow discards the bottom card of the defending player's deck, and at a printed cost of 2 or less the attacker gets +2 Attack (11032:A:2)", () => {
    const cheap = fateFight(world, CODES.steepPlateau, "mild", { deckOf: ["c5", "c2"] });
    expect(discardCodes(cheap.run.state)).toEqual(["c2"]);
    expect(deckCodes(cheap.run.state)).toEqual(["c5"]);
    const hurt = cheap.run.state.cards[cheap.made.hero]?.damage ?? 0;
    const costly = fateFight(world, CODES.steepPlateau, "mild", { deckOf: ["c2", "c5"] });
    expect(discardCodes(costly.run.state)).toEqual(["c5"]);
    // 3 Attack against 2 Defense is 1 damage; with +2 Attack, 3.
    expect(hurt).toBe(3);
    expect(costly.run.state.cards[costly.made.hero]?.damage).toBe(1);
  });
});

describe("Mysterious Fog (11033:A:1, 11033:A:2)", () => {
  it("lets the first player choose: each player exhausts a character, or each Lost Island in the staging area gets +1 Threat until the end of the phase (11033:A:1)", () => {
    const made = make({ staging: [L(CODES.lushJungle), L(CODES.forbiddenCoast), CODES.steepPlateau] });
    const asked = resolveReveal(made.state, made.ctx, CODES.fog, choose("exhaust"));
    expect(["hero", "hero2"].map((key) => asked.state.cards[key === "hero" ? made.hero : made.hero2]?.exhausted).filter(Boolean)).toHaveLength(1);
    const threatened = resolveReveal(made.state, made.ctx, CODES.fog, choose("threat"));
    for (const id of threatened.state.staging) {
      const card = threatened.state.cards[id]!;
      if (card.face === "B") expect(modifiedStat(threatened.state, card, "threat", made.ctx.cards)).toBe(3);
      else if (card.code === CODES.steepPlateau) expect(modifiedStat(threatened.state, card, "threat", made.ctx.cards)).toBe(1);
    }
    expect(threatened.state.modifiers.filter((modifier) => modifier.stat === "threat" && modifier.until === "endOfPhase")).toHaveLength(2);
  });

  it("asks each player of a table to exhaust a character they control", () => {
    const made = make({ seats: 2, staging: [] });
    const asked = resolveReveal(made.state, made.ctx, CODES.fog, choose("exhaust"));
    expect(asked.state.cards[made.seat1Hero ?? ""]?.exhausted).toBe(true);
    expect([made.hero, made.hero2].filter((id) => asked.state.cards[id]?.exhausted)).toHaveLength(1);
  });

  it("as a Shadow discards the bottom card of your deck and, at a printed cost of 2 or less, exhausts a character you control (11033:A:2)", () => {
    const second = (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.includes(idOf(state, "dh2")) ? idOf(state, "dh2") : (state.window.options[0] ?? "")) : "");
    const cheap = fateFight(world, CODES.fog, "mild", { deckOf: ["c5", "c1"], hand: ["filler"] }, { pick: second });
    expect(discardCodes(cheap.run.state)).toEqual(["c1"]);
    expect(cheap.made.state.cards[cheap.made.hero2]?.exhausted).toBe(false);
    expect(cheap.during.cards[cheap.made.hero2]?.exhausted).toBe(true);
    const costly = fateFight(world, CODES.fog, "mild", { deckOf: ["c1", "c5"], hand: ["filler"] }, { pick: second });
    expect(discardCodes(costly.run.state)).toEqual(["c5"]);
    expect(costly.during.cards[costly.made.hero2]?.exhausted).toBe(false);
  });
});

describe("Lingering Malevolence (11034:A:1, 11034:A:2)", () => {
  it("makes the first player discard the bottom card of their deck, then each card in their hand with a higher printed cost (11034:A:1)", () => {
    const made = make({ deckOf: ["c0", "c2"], hand: ["c1", "c2", "c3", "c5", "filler"] });
    const done = resolveReveal(made.state, made.ctx, CODES.malevolence);
    expect(discardCodes(done.state).sort()).toEqual(["c2", "c3", "c5"].sort());
    expect(handCodes(done.state).sort()).toEqual(["c1", "c2", "filler"]);
    expect(deckCodes(done.state)).toEqual(["c0"]);
  });

  it("discards nothing from the hand when the deck is empty, and keeps equal and lower costs", () => {
    const made = make({ hand: ["c1", "c5"] });
    expect(handCodes(resolveReveal(made.state, made.ctx, CODES.malevolence).state).sort()).toEqual(["c1", "c5"]);
  });

  it("as a Shadow works as Steep Plateau's does (11034:A:2)", () => {
    const cheap = fateFight(world, CODES.malevolence, "mild", { deckOf: ["c5", "c0"] });
    expect(discardCodes(cheap.run.state)).toEqual(["c0"]);
    expect(cheap.run.state.cards[cheap.made.hero]?.damage).toBe(3);
  });
});

describe("Ruins of Ages Past (11035:A:2)", () => {
  it("adds a Lost Island from the top of the Uncharted deck to the staging area and shuffles the Lost Islands there, bare of progress", () => {
    const made = make({ uncharted: [CODES.drownedGraves, CODES.cursedTemple], staging: [L(CODES.lushJungle, 3), L(CODES.forbiddenCoast, 2)] });
    const done = resolveReveal(made.state, made.ctx, CODES.ruins);
    const staged = done.state.staging.filter((id) => done.state.cards[id]?.face === "B");
    expect(staged.map((id) => done.state.cards[id]?.code).sort()).toEqual([CODES.drownedGraves, CODES.forbiddenCoast, CODES.lushJungle].sort());
    expect(staged.every((id) => done.state.cards[id]?.progress === 0)).toBe(true);
    expect((done.state.uncharted?.deck ?? []).map((id) => done.state.cards[id]?.code)).toEqual([CODES.cursedTemple]);
  });
});


// An ally with 2 hit points and 1 Defense defends against the enemy and is destroyed by 4 or more Attack.
const allyDefends = { play: ["ally2"], defender: (made: { state: ScenarioState }) => idOf(made.state, "ally2") };

describe("Drowned Dead (11068:A:1, 11068:A:2)", () => {
  it("puts an ally it destroys on the bottom of its owner's deck, and a hero it hurts nothing (11068:A:1)", () => {
    const done = fateFight(world, "f0", CODES.drownedDead, { play: ["ally2"], deckOf: ["c3", "c5"] }, { defender: allyDefends.defender });
    expect(codesIn(done.run.state, "discard")).toEqual([]);
    expect(deckCodes(done.run.state)).toEqual(["c3", "c5", "ally2"]);
    const survives = fateFight(world, "f0", CODES.drownedDead, { play: ["ally2"], deckOf: ["c3"] });
    expect(deckCodes(survives.run.state)).toEqual(["c3"]);
    expect(survives.run.state.cards[survives.made.hero]?.damage).toBe(2);
  });

  it("as a Shadow does the same for the enemy it is dealt to, when its attack destroys an ally (11068:A:2)", () => {
    const done = fateFight(world, CODES.drownedDead, "bruiser", { play: ["ally2"], deckOf: ["c3"] }, { defender: allyDefends.defender });
    expect(deckCodes(done.run.state)).toEqual(["c3", "ally2"]);
    const hero = fateFight(world, CODES.drownedDead, "bruiser", { play: ["ally2"], deckOf: ["c3"] });
    expect(deckCodes(hero.run.state)).toEqual(["c3"]);
  });
});

describe("Soulless Cadaver (11069:A:1, 11069:A:2)", () => {
  it("makes your deck unsearchable while you are engaged with it (11069:A:1)", () => {
    const engaged = make({ phase: "Encounter", engaged: [{ code: CODES.cadaver, seat: 0 }], deckOf: ["c1", "c2"] });
    expect(engaged.state.modifiers.some((modifier) => modifier.stat === "noDeckSearch" && modifier.instanceId === "seat:0")).toBe(true);
    const free = make({ phase: "Encounter", staging: [CODES.cadaver], deckOf: ["c1"] });
    expect(free.state.modifiers.some((modifier) => modifier.stat === "noDeckSearch")).toBe(false);
  });

  it("puts each card in your hand with a printed cost of 2 or less on the bottom of your deck when it engages you (11069:A:2)", () => {
    const made = make({ phase: "Encounter", threat: [40, 26], staging: [CODES.cadaver], deckOf: ["c5"], hand: ["c0", "c1", "c2", "c3", "c5"] });
    const done = engage(made, CODES.cadaver);
    expect(handCodes(done.state).sort()).toEqual(["c3", "c5"]);
    expect(deckCodes(done.state).sort()).toEqual(["c0", "c1", "c2", "c5"]);
    expect(deckCodes(done.state)[0]).toBe("c5");
  });
});

describe("Throngs of Unfaithful (11070:A:2)", () => {
  // The enemy engaged with the first seat takes 4 damage (its 4 hit points) and is destroyed; the Forced effect it opens is settled.
  function destroyed(deckOf: readonly string[]): Run {
    const made = make({ phase: "Combat", engaged: [{ code: CODES.throngs, seat: 0 }], deckOf, deck: ["f0", "f3"] });
    const next = runInstruction({ ...made.state, window: null }, { verb: "DamageEach", amount: 4, pick: { type: "enemy", control: "any", engaged: "you" } }, { seat: 0, sourceId: made.state.questStage }, made.ctx, []);
    return finish(start(settle(syncConstants(next, made.ctx), made.ctx, [])), made.ctx);
  }

  it("discards the bottom card of the engaged player's deck when it is destroyed, and at a printed cost of 2 or less it returns to the top of the encounter deck", () => {
    const cheap = destroyed(["c5", "c2"]);
    expect(discardCodes(cheap.state)).toEqual(["c2"]);
    expect(cheap.state.encounterDeck.map((id) => cheap.state.cards[id]?.code)).toEqual([CODES.throngs, "f0", "f3"]);
    expect(codesIn(cheap.state, "encounterDiscard")).toEqual([]);
  });

  it("stays in the encounter discard pile at a printed cost of 3 or more", () => {
    const costly = destroyed(["c2", "c3"]);
    expect(discardCodes(costly.state)).toEqual(["c3"]);
    expect(costly.state.encounterDeck.map((id) => costly.state.cards[id]?.code)).toEqual(["f0", "f3"]);
    expect(codesIn(costly.state, "encounterDiscard")).toEqual([CODES.throngs]);
  });
});

describe("Curse of the Downfallen (11071:A:1, 11071:A:2)", () => {
  it("deals 1 damage to each non-objective ally with a printed cost of 2 or less, and an ally it destroys goes to the bottom of its owner's deck (11071:A:1)", () => {
    const made = make({ play: ["ally1", "ally2", "ally3"], deckOf: ["c5"], damage: [["ally1", 1]] });
    const done = resolveReveal(made.state, made.ctx, CODES.curse);
    const damageOf = (code: string) => done.state.cards[idOf(done.state, code)]?.damage;
    // ally1 had 1 damage of 2 hit points: destroyed. ally2 took 1. ally3 costs 3.
    expect(deckCodes(done.state)).toEqual(["c5", "ally1"]);
    expect(damageOf("ally2")).toBe(1);
    expect(damageOf("ally3")).toBe(0);
    expect(damageOf("dh1")).toBe(0);
  });

  it("does not hurt Calphon, an objective ally", () => {
    const made = make({ calphon: "up", play: ["ally2"] });
    expect(resolveReveal(made.state, made.ctx, CODES.curse).state.cards[made.calphon ?? ""]?.damage).toBe(0);
  });

  it("as a Shadow discards the bottom card of your deck and, at a printed cost of 2 or less, the attacking enemy makes an additional attack (11071:A:2)", () => {
    const cheap = fateFight(world, CODES.curse, "mild", { deckOf: ["c5", "c0"] });
    expect(discardCodes(cheap.run.state)).toEqual(["c0"]);
    // 3 Attack against 2 Defense is 1 damage; the defender is exhausted for the additional attack, which falls undefended: 3 damage.
    expect(cheap.run.state.cards[cheap.made.hero]?.damage).toBe(4);
    const costly = fateFight(world, CODES.curse, "mild", { deckOf: ["c0", "c5"] });
    expect(costly.run.state.cards[costly.made.hero]?.damage).toBe(1);
  });
});

describe("Aimless Wandering (11075:A:1)", () => {
  // The two heroes (2 Willpower each) are committed to the quest.
  function committed(layout: FateLayout) {
    const made = make(layout);
    return { ...made, state: syncConstants([made.hero, made.hero2].reduce((state, id) => ({ ...state, cards: { ...state.cards, [id]: { ...state.cards[id]!, committed: true } } }), made.state), made.ctx) };
  }

  it("makes the players remove characters with a total of at least X Willpower from the quest, X the Uncharted locations in the staging area", () => {
    const one = committed({ staging: [L(CODES.lushJungle), CODES.steepPlateau] });
    const first = resolveReveal(one.state, one.ctx, CODES.wandering, choose("skip"));
    expect([one.hero, one.hero2].filter((id) => !first.state.cards[id]?.committed)).toHaveLength(1);
    const two = committed({ staging: [L(CODES.lushJungle), L(CODES.forbiddenCoast), L(CODES.floodedRuins)] });
    const all = resolveReveal(two.state, two.ctx, CODES.wandering, choose("skip"));
    // X is 3: one hero (2 Willpower) is not enough, the second brings the total to 4.
    expect([two.hero, two.hero2].filter((id) => all.state.cards[id]?.committed)).toEqual([]);
    const none = committed({ staging: [CODES.steepPlateau] });
    expect([none.hero, none.hero2].filter((id) => none.state.cards[id]?.committed)).toHaveLength(2);
    expect([none.hero, none.hero2].filter((id) => resolveReveal(none.state, none.ctx, CODES.wandering, choose("skip")).state.cards[id]?.committed)).toHaveLength(2);
  });

  it("may be given doomed 2 by the first player to look at the facedown side of an Uncharted location in the staging area", () => {
    const made = committed({ staging: [L(CODES.lushJungle)], threat: [28, 26] });
    const looked = resolveReveal(made.state, made.ctx, CODES.wandering, choose("look"));
    expect(looked.state.seats[0]?.threat).toBe(30);
    expect(looked.state.cards[idOf(looked.state, CODES.lushJungle)]?.face).toBe("B");
    const skipped = resolveReveal(made.state, made.ctx, CODES.wandering, choose("skip"));
    expect(skipped.state.seats[0]?.threat).toBe(28);
  });

  it("offers no look when there is no Uncharted location in the staging area", () => {
    const made = committed({ staging: [CODES.steepPlateau] });
    expect(resolveReveal(made.state, made.ctx, CODES.wandering, choose("look")).state.seats[0]?.threat).toBe(28);
  });
});
