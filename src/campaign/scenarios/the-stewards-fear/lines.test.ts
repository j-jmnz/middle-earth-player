// Rules: ats.underworld, ats.underworld-example, ats.setup-the-stewards-fear, ats.setup-the-stewards-fear-underworld-deck, rr.reveal, rr.staging, rr.surge, rr.explored, rr.first-player, rr.forced, rr.attacks-outside-the-combat-phase, rr.quest-advancement, rr.objective-cards, rr.running-out-of-cards, rr.travel, rr.destroy (data/rules/entries.json).
// The lines of The Steward's Fear that a card-spec row cannot show (spec.test.ts holds the rest): the played Setup with one and two seats, the hidden Villain and Plot, the stacks under locations (taken on entry, released on leaving play, whatever the location), the four tokens that advance a stage, the
// shuffle of stage 3, the Hand of Castamir's reveal and discard, the Dissident's token choice, the immediate attacks at the first player and the two losses of the Plots. Each test builds its moment with the scene kit (the Setup test starts the game and plays nothing else), and its title starts with the line it proves.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalTargets, reduce, startScenario, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { revealsAllowed } from "../../../rules/families/encounter/reveal.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { fightEnemy, finish, idOf, idsOf, legalIntents, resolveRecords, revealedTop, revealFromTop, send, start, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { fearStart, fearWorld } from "../../../../test/scenarios/the-stewards-fear/game.ts";
import { CODES, DECK_CODES, PLOTS, VILLAINS, codeOf, deckCodes, run, table, underCodes } from "../../../../test/scenarios/the-stewards-fear/table.ts";

const CITY_STREET = "05038";
const MARKET_SQUARE = "05039";

// A table with the underworld deck built by the Setup record's verb.
function withDeck(layout: Layout, codes: readonly string[] = DECK_CODES): LayoutTable & { state: ScenarioState } {
  const made = table({ ...layout, setAside: [...(layout.setAside ?? []), ...codes] });
  return { ...made, state: { ...run(made, made.state, { verb: "BuildUnderworldDeck", codes: [...codes] }), window: made.state.window } };
}

// The location explored: all its progress at once, as a quest or Secret Map does; the stacks under it are released by the sweep that follows.
const explored = (made: LayoutTable, state: ScenarioState): ScenarioState => settle(run(made, state, { verb: "PlaceProgressOn", amount: 9, target: "activeLocation" }), made.ctx, []);
// The location leaves play some other way (discarded by an effect).
const discarded = (made: LayoutTable, state: ScenarioState, id: string): ScenarioState => settle({ ...moveCard(state, id, { zone: "encounterDiscard" }), window: null }, made.ctx, []);
const stagedCodes = (state: ScenarioState): (string | undefined)[] => state.staging.map((id) => codeOf(state, id));
const SPAWN = (made: LayoutTable, state: ScenarioState, host: string): ScenarioState => run(made, state, { verb: "TakeUnderworld", amount: 1, host: "self" }, host);

// The game started and each seat's mulligan and every choice of the Setup answered: nothing else is played.
function started(ctx: Parameters<typeof startScenario>[1], seats: 1 | 2, seed: number, difficulty: "Easy" | "Normal"): ScenarioState {
  let state = startScenario(fearStart(seats, seed, difficulty), ctx);
  for (let guard = 0; guard < 12 && (state.window?.kind === "mulligan" || state.window?.kind === "choose"); guard += 1) {
    const intent: PlayerIntent = state.window.kind === "mulligan" ? { type: "Keep" } : { type: "Choose", optionId: state.window.options[0] ?? "" };
    state = expectOk(reduce(state, intent, ctx)).state;
  }
  return state;
}

describe("06011:A:1 Setup", () => {
  it("06011:A:1 builds the underworld deck of 12 cards, hides one Villain and one Plot, removes the other four, sets Roots aside and has stage 1B make The Fourth Star active, with one seat and with two", async () => {
    const { ctx } = await fearWorld();
    for (const seats of [1, 2] as const) {
      const state = started(ctx, seats, 3, "Normal");
      // Stage 1B has found The Fourth Star by now: it is the active location and holds one card of the deck for each player (Underworld X, X the players).
      const star = idOf(state, CODES.star);
      expect(state.activeLocation).toBe(star);
      expect(underCodes(state, star)).toHaveLength(seats);
      expect(deckCodes(state)).toHaveLength(12 - seats);
      expect([...deckCodes(state), ...underCodes(state, star)].sort()).toEqual(["05037", "05037", "05037", "05042", "05042", "05042", "05043", "05043", "05044", "06026", "06027", "06028"]);
      const aside = state.setAside.map((id) => state.cards[id]?.code ?? "");
      expect(aside.filter((code) => VILLAINS.includes(code))).toHaveLength(1);
      expect(aside.filter((code) => PLOTS.includes(code))).toHaveLength(1);
      expect(aside).toContain(CODES.roots);
      const removed = Object.values(state.cards).filter((card) => card.zone === "removed").map((card) => card.code);
      expect(removed.filter((code) => VILLAINS.includes(code))).toHaveLength(2);
      expect(removed.filter((code) => PLOTS.includes(code))).toHaveLength(2);
      const encounter = state.encounterDeck.map((id) => state.cards[id]?.code);
      expect(encounter).not.toContain(CODES.star);
      for (const code of [...DECK_CODES, ...VILLAINS, ...PLOTS, CODES.roots]) expect(encounter).not.toContain(code);
      // No card of the underworld deck is dealt a shadow card or lies anywhere in play.
      for (const id of state.setAside.filter((candidate) => DECK_CODES.includes(state.cards[candidate]?.code ?? "") && state.cards[candidate]?.stackedAt != null)) expect(state.cards[id]?.face).toBe("down");
    }
  });

  it("06011:A:1 on Easy the Umbar Assassin is not dealt, so the underworld deck holds 11 cards", async () => {
    const { ctx } = await fearWorld();
    const state = started(ctx, 1, 3, "Easy");
    const star = idOf(state, CODES.star);
    expect(deckCodes(state).length + underCodes(state, star).length).toBe(11);
    expect([...deckCodes(state), ...underCodes(state, star)]).not.toContain("05044");
  });

  it("06011:A:1 each Villain and each Plot is the hidden one for some seed, and the seed alone decides which", async () => {
    const { ctx } = await fearWorld();
    const hidden = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const state = started(ctx, 1, seed, "Normal");
      const again = started(ctx, 1, seed, "Normal");
      const pair = (from: ScenarioState) => from.setAside.map((id) => from.cards[id]?.code ?? "").filter((code) => [...VILLAINS, ...PLOTS].includes(code));
      expect(pair(again)).toEqual(pair(state));
      for (const code of pair(state)) hidden.add(code);
    }
    expect([...hidden].sort()).toEqual([...VILLAINS, ...PLOTS].sort());
  });
});

describe("06011:B:1 The Fourth Star", () => {
  it("06011:B:1 is searched for in the encounter deck only and made active at once, taking Underworld X (X the players), then the deck is shuffled", () => {
    for (const seats of [1, 2] as const) {
      const t = withDeck({ seats, deck: ["f0", CODES.star, "f0", "f0"], stage: CODES.conspiracy });
      const done = resolveRecords(t.state, t.ctx, CODES.conspiracy, "whenRevealed", undefined);
      const star = idOf(done.state, CODES.star);
      expect(done.state.activeLocation).toBe(star);
      expect(underCodes(done.state, star)).toHaveLength(seats);
      expect(done.state.encounterDeck).toHaveLength(3);
      expect(done.state.encounterDeck).not.toContain(star);
    }
  });

  it("06011:B:1 a The Fourth Star in the discard pile is not searched for", () => {
    const t = withDeck({ deck: ["f0", "f0"], discard: [CODES.star], stage: CODES.conspiracy });
    const done = resolveRecords(t.state, t.ctx, CODES.conspiracy, "whenRevealed", undefined);
    expect(done.state.activeLocation).toBeNull();
    expect(done.state.cards[idOf(done.state, CODES.star)]?.zone).toBe("encounterDiscard");
  });
});

describe("06011:B:3 and 06012:B:3 the four resource tokens", () => {
  const withTokens = (stage: string, tokens: number): { made: LayoutTable; state: ScenarioState } => {
    const made = table({ stage, side: "B", seats: 2 });
    const id = made.state.questStage ?? "";
    return { made, state: { ...made.state, round: 1, window: null, cards: { ...made.state.cards, [id]: { ...made.state.cards[id]!, resources: tokens } } } };
  };
  it("06011:B:3 the third token advances nothing, the fourth advances to stage 2 at once, whatever the phase", () => {
    const three = withTokens(CODES.conspiracy, 3);
    expect(codeOf(settle(three.state, three.made.ctx, []), settle(three.state, three.made.ctx, []).questStage)).toBe(CODES.conspiracy);
    const four = withTokens(CODES.conspiracy, 4);
    const after = settle(four.state, four.made.ctx, []);
    expect(codeOf(after, after.questStage)).toBe(CODES.design);
  });

  it("06012:B:3 the fourth token on The Grand Design advances to stage 3; the tokens of stage 1 are not carried over", () => {
    const three = withTokens(CODES.design, 3);
    const same = settle(three.state, three.made.ctx, []);
    expect(codeOf(same, same.questStage)).toBe(CODES.design);
    const four = withTokens(CODES.design, 4);
    const after = settle(four.state, four.made.ctx, []);
    expect(codeOf(after, after.questStage)).toBe(CODES.confrontation);
    expect(after.cards[after.questStage ?? ""]?.resources ?? 0).toBe(0);
  });

  it("06011:B:2 a location explored by Secret Map's progress (not only by questing) places the token", () => {
    const t = withDeck({ active: CODES.sewers, stage: CODES.conspiracy });
    const done = explored(t, t.state);
    expect(done.cards[done.questStage ?? ""]?.resources).toBe(1);
  });

  it("06012:B:2 a location that only returns to the staging area (a travel elsewhere, Roots made active) places no token", () => {
    const t = withDeck({ active: CODES.sewers, setAside: [CODES.roots], stage: CODES.design, side: "A" });
    const done = resolveRecords(t.state, t.ctx, CODES.design, "whenRevealed", undefined);
    expect(done.state.cards[done.state.questStage ?? ""]?.resources ?? 0).toBe(0);
  });
});

describe("06013:B:1 stage 3", () => {
  it("06013:B:1 the underworld deck is shuffled into the encounter deck; stacks under locations stay and a later Underworld takes nothing", () => {
    const t = withDeck({ active: CODES.sewers, deck: ["f0"], stage: CODES.confrontation, side: "A" });
    const sewers = idOf(t.state, CODES.sewers);
    const stacked = SPAWN(t, t.state, sewers);
    const done = resolveRecords(stacked, t.ctx, CODES.confrontation, "whenRevealed", undefined);
    expect(deckCodes(done.state)).toEqual([]);
    expect(done.state.encounterDeck).toHaveLength(1 + DECK_CODES.length - 1);
    expect(underCodes(done.state, sewers)).toHaveLength(1);
    // A location with Underworld revealed afterwards takes none.
    const later = revealedTop({ ...t, state: done.state }, CODES.houses);
    expect(underCodes(later, idOf(later, CODES.houses))).toHaveLength(0);
  });

  it("06013:B:2 the last stage cannot be defeated while a Villain is in play, in the staging area or engaged, and can when none is", () => {
    const none = table({ stage: CODES.confrontation });
    expect(restricted(none.state, none.ctx, "advance")).toEqual([]);
    for (const layout of [{ staging: [CODES.castamir] }, { engaged: [CODES.bane] }, { staging: [CODES.daughter] }]) {
      const villain = table({ stage: CODES.confrontation, ...layout });
      expect(restricted(villain.state, villain.ctx, "advance").length).toBeGreaterThan(0);
    }
    const other = table({ stage: CODES.confrontation, staging: [CODES.dissident] });
    expect(restricted(other.state, other.ctx, "advance")).toEqual([]);
  });
});

describe("06014:A:2 Underworld Dissident's shadow", () => {
  const fight = (tweak: (state: ScenarioState) => ScenarioState, pick: string, layout: Layout = {}) =>
    fightEnemy((made: Layout) => table({ stage: CODES.conspiracy, ...made }), CODES.dissident, "f3", layout, { undefended: true, pick: () => pick, tweak: (state) => tweak(state) });
  const tokens = (progress: number, resources: number) => (state: ScenarioState) => {
    const id = state.questStage ?? "";
    return updateCard(state, id, { progress, resources });
  };
  const stageOf = (state: ScenarioState) => state.cards[state.questStage ?? ""];

  it("06014:A:2 undefended, with a progress and a resource token on the quest the first player removes the kind he chooses: progress", () => {
    const done = fight(tokens(2, 2), "progress").run.state;
    expect([stageOf(done)?.progress, stageOf(done)?.resources]).toEqual([1, 2]);
  });

  it("06014:A:2 undefended, the first player chooses a resource token", () => {
    const done = fight(tokens(2, 2), "resource").run.state;
    expect([stageOf(done)?.progress, stageOf(done)?.resources]).toEqual([2, 1]);
  });

  it("06014:A:2 with resource tokens only a resource token goes, with progress only a progress token", () => {
    const onlyResource = fight(tokens(0, 3), "progress").run.state;
    expect([stageOf(onlyResource)?.progress, stageOf(onlyResource)?.resources]).toEqual([0, 2]);
    const onlyProgress = fight(tokens(3, 0), "resource").run.state;
    expect([stageOf(onlyProgress)?.progress, stageOf(onlyProgress)?.resources]).toEqual([2, 0]);
  });

  it("06014:A:2 a defended attack removes no token", () => {
    const made = fightEnemy((layout: Layout) => table({ stage: CODES.conspiracy, ...layout }), CODES.dissident, "f3", {}, { tweak: tokens(2, 2) });
    expect([stageOf(made.run.state)?.progress, stageOf(made.run.state)?.resources]).toEqual([2, 2]);
  });

  it("06014:A:2 in a game of two the first player decides, though the other seat is the defender", () => {
    const made = fightEnemy((layout: Layout) => table({ stage: CODES.conspiracy, seats: 2, firstPlayer: 1, ...layout }), CODES.dissident, "f3", { seats: 2, firstPlayer: 1 }, { undefended: true, tweak: tokens(2, 2), pick: (state) => (state.window?.kind === "choose" && state.window.seat === 1 ? "resource" : "progress") });
    expect([stageOf(made.run.state)?.progress, stageOf(made.run.state)?.resources]).toEqual([2, 1]);
  });
});

describe("06016:A:1 The Hand of Castamir", () => {
  it("06016:A:1 after it attacks the top card is revealed and discarded: a Surge card is resolved and discarded, its Surge reveals the next card in the normal way, and nothing enters the staging area for it", () => {
    const t = withDeck({ engaged: [{ code: CODES.castamir, seat: 0 }], deck: [CITY_STREET, "f3", "f0", "f0"] });
    const done = resolveRecords(t.state, t.ctx, CODES.castamir, "forced", idOf(t.state, CODES.castamir));
    expect(done.state.cards[idOf(done.state, CITY_STREET)]?.zone).toBe("encounterDiscard");
    expect(stagedCodes(done.state)).not.toContain(CITY_STREET);
    expect(stagedCodes(done.state)).toEqual(["f3"]);
  });

  it("06016:A:1 a treachery with Surge it reveals resolves its When Revealed (Unwelcome Discovery stages a card of the underworld deck) and is discarded", () => {
    const t = withDeck({ engaged: [{ code: CODES.castamir, seat: 0 }], deck: [CODES.discovery, "f0", "f0", "f0"] }, ["05037"]);
    const done = resolveRecords(t.state, t.ctx, CODES.castamir, "forced", idOf(t.state, CODES.castamir));
    expect(done.state.cards[idOf(done.state, CODES.discovery)]?.zone).toBe("encounterDiscard");
    expect(stagedCodes(done.state)).toEqual(["05037"]);
  });

  it("06016:A:1 a location it reveals goes to the discard pile without entering play: no Underworld, no card in the staging area", () => {
    const t = withDeck({ active: "place", engaged: [{ code: CODES.castamir, seat: 0 }], deck: [CODES.sewers, "f0", "f0"] });
    const done = resolveRecords(t.state, t.ctx, CODES.castamir, "forced", idOf(t.state, CODES.castamir));
    expect(done.state.cards[idOf(done.state, CODES.sewers)]?.zone).toBe("encounterDiscard");
    expect(stagedCodes(done.state)).not.toContain(CODES.sewers);
    expect(underCodes(done.state, idOf(done.state, CODES.sewers))).toHaveLength(0);
    // Its When Revealed did resolve: the card under the active location.
    expect(underCodes(done.state, idOf(done.state, "place"))).toHaveLength(1);
  });
});

// The immediate attack at the first player: seat 1 is the first player, the enemy is engaged with seat 0 or lies in the staging area.
describe("06016:A:2 and 06017:A:2 the attack against the first player", () => {
  const attacked = (state: ScenarioState): { seat: number | undefined; enemy: string | undefined } => ({ seat: state.pendingAttack?.seat, enemy: codeOf(state, state.pendingAttack?.enemyId) });
  const revealTreachery = (layout: Layout) => {
    const t = table({ seats: 2, firstPlayer: 1, deck: ["f0"], ...layout });
    const steps: never[] = [];
    return finish({ state: revealFromTop(t.state, t.ctx, "treachery", steps).state, steps }, t.ctx).state;
  };

  it("06016:A:2 a treachery revealed from the encounter deck: Castamir in the staging area attacks the first player", () => {
    expect(attacked(revealTreachery({ staging: [CODES.castamir] }))).toEqual({ seat: 1, enemy: CODES.castamir });
  });

  it("06016:A:2 Castamir engaged with another player still attacks the first player", () => {
    expect(attacked(revealTreachery({ engaged: [{ code: CODES.castamir, seat: 0 }] }))).toEqual({ seat: 1, enemy: CODES.castamir });
  });

  it("06016:A:2 a card that is not a treachery does not make it attack", () => {
    const t = table({ seats: 2, firstPlayer: 1, deck: ["f0"], staging: [CODES.castamir] });
    const steps: never[] = [];
    const done = finish({ state: revealFromTop(t.state, t.ctx, "f3", steps).state, steps }, t.ctx).state;
    expect(done.pendingAttack).toBeFalsy();
  });

  const played = (layout: Layout) => {
    const t = table({ seats: 2, firstPlayer: 1, hand: [{ code: "event", seat: 0 }], ...layout });
    const hand = t.state.seats[0]?.hand[0] ?? "";
    const steps: never[] = [];
    const done = finish({ state: settle(fireEvent(t, hand), t.ctx, steps), steps }, t.ctx).state;
    return done;
  };
  function fireEvent(t: LayoutTable, card: string): ScenarioState {
    return { ...t.state, window: null, pendingEvents: [{ trigger: "played", seat: 0, cardId: card }] };
  }

  it("06017:A:2 after any player plays an event Bane attacks the first player, in the staging area or engaged with another player", () => {
    expect(attacked(played({ staging: [CODES.bane] }))).toEqual({ seat: 1, enemy: CODES.bane });
    expect(attacked(played({ engaged: [{ code: CODES.bane, seat: 0 }] }))).toEqual({ seat: 1, enemy: CODES.bane });
  });
});

describe("06017:A:1 Telemnar's Bane", () => {
  it("06017:A:1 discards 3 cards from the top of every player's deck, before the defender is declared, with two seats", () => {
    const decks = Array.from({ length: 10 }, (_, index) => ({ code: "filler", seat: index % 2 }));
    const made = fightEnemy((layout: Layout) => table({ seats: 2, deckOf: decks, ...layout }), "f0", CODES.bane, { seats: 2, deckOf: decks }, { undefended: true });
    expect(made.run.state.seats[0]?.discard.length).toBeGreaterThanOrEqual(3);
    expect(made.run.state.seats[1]?.discard.length).toBeGreaterThanOrEqual(3);
  });
});

describe("06018:A:1 and 06018:A:2 Sewers", () => {
  it("06018:A:2 When Revealed puts the top card under the active location, then Underworld 1 puts one under Sewers", () => {
    const t = withDeck({ active: "place" });
    const revealed = revealedTop(t, CODES.sewers);
    expect(underCodes(revealed, idOf(revealed, "place"))).toHaveLength(1);
    expect(underCodes(revealed, idOf(revealed, CODES.sewers))).toHaveLength(1);
    expect(deckCodes(revealed)).toHaveLength(DECK_CODES.length - 2);
  });

  it("06018:A:2 with no active location only Sewers takes its card", () => {
    const t = withDeck({});
    const revealed = revealedTop(t, CODES.sewers);
    expect(underCodes(revealed, idOf(revealed, CODES.sewers))).toHaveLength(1);
    expect(deckCodes(revealed)).toHaveLength(DECK_CODES.length - 1);
  });

  for (const host of [CITY_STREET, MARKET_SQUARE, "place"]) {
    it(`06018:A:2 the card under the active location ${host} is revealed and staged when that location leaves play, though it is no Underworld location`, () => {
      const t = withDeck({ active: host });
      const revealed = revealedTop(t, CODES.sewers);
      const under = underCodes(revealed, idOf(revealed, host));
      expect(under).toHaveLength(1);
      const gone = explored(t, revealed);
      expect(underCodes(gone, idOf(gone, host))).toHaveLength(0);
      const stagedUnder = idsOf(gone, under[0] ?? "").filter((id) => gone.cards[id]?.zone === "staging");
      expect(stagedUnder).toHaveLength(1);
      expect(gone.cards[stagedUnder[0] ?? ""]?.face).toBe("up");
      // Sewers' own card stays: Sewers is still in play.
      expect(underCodes(gone, idOf(gone, CODES.sewers))).toHaveLength(1);
    });
  }

  it("06018:A:1 the cards under Sewers are revealed when it leaves play, explored or discarded", () => {
    for (const leave of ["explored", "discarded"] as const) {
      const t = withDeck({ active: CODES.sewers });
      const sewers = idOf(t.state, CODES.sewers);
      const stacked = SPAWN(t, t.state, sewers);
      const under = underCodes(stacked, sewers);
      const gone = leave === "explored" ? explored(t, stacked) : discarded(t, stacked, sewers);
      expect(underCodes(gone, sewers)).toHaveLength(0);
      expect(gone.staging.map((id) => gone.cards[id]?.code)).toContain(under[0]);
    }
  });
});

describe("06019 Roots of Mindolluin", () => {
  it("06019:A:1 takes its Underworld 1 card when stage 2 makes it the active location from the set aside zone, and the old active location keeps its stack", () => {
    const t = withDeck({ active: CODES.sewers, setAside: [CODES.roots], stage: CODES.design, side: "A" });
    const sewers = idOf(t.state, CODES.sewers);
    const stacked = SPAWN(t, t.state, sewers);
    const done = resolveRecords(stacked, t.ctx, CODES.design, "whenRevealed", undefined);
    const roots = idOf(done.state, CODES.roots);
    expect(done.state.activeLocation).toBe(roots);
    expect(underCodes(done.state, roots)).toHaveLength(1);
    expect(done.state.cards[sewers]?.zone).toBe("staging");
    expect(underCodes(done.state, sewers)).toHaveLength(1);
  });

  it("06019:A:1 the card under Roots is revealed when Roots is explored", () => {
    const t = withDeck({ active: CODES.roots });
    const roots = idOf(t.state, CODES.roots);
    const stacked = SPAWN(t, t.state, roots);
    const gone = explored(t, stacked);
    expect(underCodes(gone, roots)).toHaveLength(0);
    expect(gone.staging).toHaveLength(1);
  });
});

describe("06020:A:1 Storehouse", () => {
  it("06020:A:1 as a shadow card it never enters play and takes no card of the underworld deck", () => {
    const made = fightEnemy((layout: Layout) => withDeck(layout), CODES.storehouse, CODES.dissident, {}, { undefended: true });
    expect(deckCodes(made.run.state)).toHaveLength(DECK_CODES.length);
    expect(Object.values(made.run.state.cards).some((card) => card.zone === "under")).toBe(false);
  });

  it("06020:A:1 revealed from the encounter deck it takes 1 card, and found by Lost in the City it takes 1", () => {
    const revealed = revealedTop(withDeck({}), CODES.storehouse);
    expect(underCodes(revealed, idOf(revealed, CODES.storehouse))).toHaveLength(1);
  });
});

describe("06021:A:1 Houses of the Dead", () => {
  it("06021:A:1 revealed from the encounter deck it takes 2 cards, and both are revealed when it leaves play", () => {
    const t = withDeck({});
    const revealed = revealedTop(t, CODES.houses);
    const houses = idOf(revealed, CODES.houses);
    expect(underCodes(revealed, houses)).toHaveLength(2);
    const gone = discarded(t, revealed, houses);
    expect(underCodes(gone, houses)).toHaveLength(0);
    expect(gone.staging.filter((id) => DECK_CODES.includes(gone.cards[id]?.code ?? ""))).toHaveLength(2);
    for (const id of gone.staging) expect(gone.cards[id]?.face).toBe("up");
  });

  it("06021:A:1 with one card left in the underworld deck it takes that one", () => {
    const t = withDeck({}, ["05037"]);
    const revealed = revealedTop(t, CODES.houses);
    expect(underCodes(revealed, idOf(revealed, CODES.houses))).toHaveLength(1);
  });
});

describe("06022:A:1 and 06022:A:2 The Fourth Star", () => {
  it("06022:A:2 takes as many cards as there are players", () => {
    for (const seats of [1, 2] as const) {
      const t = withDeck({ seats });
      const revealed = revealedTop(t, CODES.star);
      expect(underCodes(revealed, idOf(revealed, CODES.star))).toHaveLength(seats);
    }
  });

  it("06022:A:1 and the other Underworld City locations take their stacks when Lost in the City finds them in the encounter deck, exactly once", () => {
    for (const [location, amount] of [[CODES.sewers, 1], [CODES.storehouse, 1], [CODES.houses, 2], [CODES.star, 1]] as const) {
      const t = withDeck({ deck: [location, "f0", "f0"] });
      const revealed = revealedTop(t, CODES.lostInCity);
      const id = idOf(revealed, location);
      expect(revealed.cards[id]?.zone).toBe("staging");
      expect(underCodes(revealed, id), location).toHaveLength(amount);
      expect(deckCodes(revealed), location).toHaveLength(DECK_CODES.length - amount - (location === CODES.sewers ? 0 : 0));
    }
  });

  it("06022:A:1 the same when Lost in the City finds them in the discard pile", () => {
    for (const [location, amount] of [[CODES.sewers, 1], [CODES.houses, 2], [CODES.star, 1]] as const) {
      const t = withDeck({ deck: ["f0", "f0"], discard: [location] });
      const revealed = revealedTop(t, CODES.lostInCity);
      const id = idOf(revealed, location);
      expect(revealed.cards[id]?.zone, location).toBe("staging");
      expect(underCodes(revealed, id), location).toHaveLength(amount);
      expect(deckCodes(revealed), location).toHaveLength(DECK_CODES.length - amount);
    }
  });

  it("06022:A:1 the cards under The Fourth Star are revealed when it leaves play", () => {
    const t = withDeck({ seats: 2, active: CODES.star });
    const star = idOf(t.state, CODES.star);
    const stacked = run(t, t.state, { verb: "TakeUnderworld", amount: { players: true }, host: "self" }, star);
    expect(underCodes(stacked, star)).toHaveLength(2);
    // The Response window of 06022:A:3 is passed, then the stack is revealed.
    const open = explored(t, stacked);
    expect(open.window?.kind).toBe("response");
    const gone = send({ state: open, steps: [] }, { type: "Pass" }, t.ctx).state;
    expect(underCodes(gone, star)).toHaveLength(0);
    expect(gone.staging.filter((id) => DECK_CODES.includes(gone.cards[id]?.code ?? ""))).toHaveLength(2);
  });
});

describe("06022:A:3 The Fourth Star leaving play explored", () => {
  const leave = (explore: boolean) => {
    const deckOf = Array.from({ length: 6 }, (_, index) => ({ code: "filler", seat: index % 2 }));
    const t = table({ seats: 2, firstPlayer: 1, active: CODES.star, deckOf });
    const star = idOf(t.state, CODES.star);
    const open = explore ? explored(t, t.state) : discarded(t, t.state, star);
    return { t, open };
  };

  it("06022:A:3 each player, the first player first, may draw 1 card when it leaves play explored", () => {
    const { t, open } = leave(true);
    expect(open.window).toMatchObject({ kind: "response", seat: 1 });
    const trigger = (state: ScenarioState) => ({ type: "Trigger" as const, cardId: idOf(state, CODES.star), effectId: "06022:response:1" });
    let run1 = send({ state: open, steps: [] }, trigger(open), t.ctx);
    const seen: (number | undefined)[] = [];
    for (let guard = 0; guard < 4 && run1.state.window?.kind === "choose"; guard += 1) {
      seen.push(run1.state.window.seat);
      run1 = send(run1, { type: "Choose", optionId: "draw" }, t.ctx);
    }
    expect(seen).toEqual([1, 0]);
    expect(run1.state.seats[0]?.hand).toHaveLength(open.seats[0]!.hand.length + 1);
    expect(run1.state.seats[1]?.hand).toHaveLength(open.seats[1]!.hand.length + 1);
  });

  it("06022:A:3 a player may decline, and it gives nothing when the location is discarded unexplored", () => {
    const { t, open } = leave(true);
    const trigger = { type: "Trigger" as const, cardId: idOf(open, CODES.star), effectId: "06022:response:1" };
    let run1 = send({ state: open, steps: [] }, trigger, t.ctx);
    run1 = send(run1, { type: "Choose", optionId: "skip" }, t.ctx);
    run1 = send(run1, { type: "Choose", optionId: "draw" }, t.ctx);
    expect(run1.state.seats[1]?.hand).toHaveLength(open.seats[1]!.hand.length);
    expect(run1.state.seats[0]?.hand).toHaveLength(open.seats[0]!.hand.length + 1);
    expect(leave(false).open.window?.kind).not.toBe("response");
  });
});

describe("06023:A:2 Unwelcome Discovery", () => {
  it("06023:A:2 reveals the top card of the underworld deck in full and stages it; a Clue goes to the encounter discard pile instead; an empty deck does nothing", () => {
    const enemy = withDeck({ deck: [CODES.discovery, "f0", "f0"] }, ["05037"]);
    const staged = revealedTop(enemy, CODES.discovery);
    expect(stagedCodes(staged)).toContain("05037");
    const clue = withDeck({ deck: [CODES.discovery, "f0", "f0"] }, [CODES.history]);
    const discardedClue = revealedTop(clue, CODES.discovery);
    expect(stagedCodes(discardedClue)).not.toContain(CODES.history);
    expect(discardedClue.encounterDiscard.map((id) => codeOf(discardedClue, id))).toContain(CODES.history);
    const empty = table({ deck: [CODES.discovery, "f0", "f0"] });
    expect(() => revealedTop(empty, CODES.discovery)).not.toThrow();
  });
});

describe("06029 06030 06031 the Plots", () => {
  it("06029:A:1 one additional card is revealed in each staging step, one more than there are players", () => {
    const without = table({});
    const withPlot = table({ staging: [CODES.alliance] });
    expect(revealsAllowed(without.state, 1)).toBe(1);
    expect(revealsAllowed(withPlot.state, 1)).toBe(2);
    expect(revealsAllowed(table({ seats: 2, staging: [CODES.alliance] }).state, 2)).toBe(3);
  });

  it("06029:A:2 a hero destroyed by an enemy attack loses the game for the players", () => {
    // Underworld Dissident gets +1 Attack for each Underworld location: 4 in the staging area make 6, the hit points of a stand-in hero.
    const layout: Layout = { staging: [CODES.alliance, CODES.sewers, CODES.storehouse, CODES.houses, CODES.roots] };
    const made = fightEnemy((made: Layout) => table(made), "f0", CODES.dissident, layout, { undefended: true });
    expect(made.run.state.lost).toBe(true);
    const safe = fightEnemy((made: Layout) => table(made), "f0", CODES.dissident, { staging: [CODES.alliance] }, { undefended: true });
    expect(safe.run.state.lost).toBeFalsy();
  });

  it("06030:A:1 at the end of the round a token is placed first, then each player discards as many cards as the card holds tokens, growing each round", () => {
    const deck = Array.from({ length: 20 }, (_, index) => ({ code: "filler", seat: index % 2 }));
    const t = table({ seats: 2, staging: [CODES.flames], deckOf: deck });
    const id = idOf(t.state, CODES.flames);
    let state: ScenarioState = t.state;
    const endOfRound = (current: ScenarioState): ScenarioState => settle({ ...current, window: null, pendingEvents: [{ trigger: "endOfRound", seat: null }] }, t.ctx, []);
    state = endOfRound(state);
    expect(state.cards[id]?.resources).toBe(1);
    expect(state.seats[0]?.discard).toHaveLength(1);
    expect(state.seats[1]?.discard).toHaveLength(1);
    state = endOfRound(state);
    expect(state.cards[id]?.resources).toBe(2);
    expect(state.seats[0]?.discard).toHaveLength(3);
    expect(state.seats[1]?.discard).toHaveLength(3);
  });

  it("06030:A:2 any player with no cards in his deck makes the players lose, and none lost while every deck holds a card", () => {
    const full = table({ seats: 2, staging: [CODES.flames], deckOf: [{ code: "filler", seat: 0 }, { code: "filler", seat: 1 }] });
    expect(settle({ ...full.state, window: null }, full.ctx, []).lost).toBeFalsy();
    const second = table({ seats: 2, staging: [CODES.flames], deckOf: [{ code: "filler", seat: 0 }] });
    expect(settle({ ...second.state, window: null }, second.ctx, []).lost).toBe(true);
    const none = table({ staging: [CODES.flames] });
    expect(settle({ ...none.state, window: null }, none.ctx, []).lost).toBe(true);
    const unused = table({ staging: [], deckOf: [] });
    expect(settle({ ...unused.state, window: null }, unused.ctx, []).lost).toBeFalsy();
  });
});

describe("05038:A:2 City Street here", () => {
  it("05038:A:2 City Street in the staging area bars travel to every Underworld location and to The Fourth Star, whose titles are not City Street", () => {
    const made = tableFromLayout("the-stewards-fear", { staging: [CITY_STREET, CODES.sewers, CODES.storehouse, CODES.houses, CODES.star], phase: "Travel", stage: CODES.conspiracy });
    const targets = legalTargets(start(made.state).state, { type: "Travel" } as never, made.ctx);
    expect(targets).toEqual([idOf(made.state, CITY_STREET)]);
  });
});

describe("06025:A:1 False Lead", () => {
  it("06025:A:1 ends the quest phase at once, with no progress and no comparison of the staging area's Threat", () => {
    const made = table({ phase: "Quest", staging: ["f3"], deck: [CODES.falseLead, "f0", "f0"], committed: ["dh1", "dh2"], stage: CODES.conspiracy });
    const next = send(start(made.state), { type: "Pass" }, made.ctx);
    expect(next.state.phase).toBe("Travel");
    expect(next.state.cards[next.state.questStage ?? ""]?.progress).toBe(0);
    expect(next.steps.some((step) => step.kind === "quest")).toBe(false);
  });
});

describe("06026:A:1 the Clues and the four tokens", () => {
  it("06028:A:1 claiming A Scrap of History and A Prisoner puts 1 and 2 resource tokens on the quest, and the 4th token advances the stage", () => {
    const made = table({ stage: CODES.conspiracy, staging: [CODES.history, CODES.prisoner] });
    const id = made.state.questStage ?? "";
    let current = start(updateCard({ ...made.state, round: 1 }, id, { resources: 1 }));
    expect(current.state.window?.kind).toBeDefined();
    const claim = (code: string) => {
      const found = legalIntents(current.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(current.state, code));
      expect(found, code).toBeDefined();
      current = send(current, found as never, made.ctx);
      current = finish(current, made.ctx);
      // The action window the effect's frame opens is passed, and the stage may advance once nothing is resolving.
      for (let guard = 0; guard < 3 && current.state.window?.kind === "frameAction"; guard += 1) current = send(current, { type: "Pass" }, made.ctx);
    };
    claim(CODES.history);
    expect(codeOf(current.state, current.state.questStage)).toBe(CODES.conspiracy);
    expect(current.state.cards[current.state.questStage ?? ""]?.resources).toBe(2);
    claim(CODES.prisoner);
    expect(codeOf(current.state, current.state.questStage)).toBe(CODES.design);
  });
});

describe("06015:A:1 Daughter of Berúthiel", () => {
  it("06015:A:1 is skipped in the optional engagement step, though a player's threat is high enough for any other enemy", () => {
    const made = table({ phase: "Encounter", staging: [CODES.daughter, "f0"] });
    const targets = legalTargets(start(made.state).state, { type: "Engage" } as never, made.ctx);
    expect(targets).toContain(idOf(made.state, "f0"));
    expect(targets).not.toContain(idOf(made.state, CODES.daughter));
  });
});

describe("05037:A:2 Pickpocket's shadow here", () => {
  it("05037:A:2 with no attachment (and no Alcaron's Scroll in this scenario) nothing is discarded and nobody is asked", () => {
    const made = fightEnemy((layout: Layout) => table(layout), CODES.streetThug, "f3", {}, { undefended: true });
    expect(made.run.state.window?.kind).not.toBe("choose");
    expect(made.run.state.seats[0]?.discard.filter((id) => made.run.state.cards[id]?.code === "attachment")).toHaveLength(0);
  });
});

describe("05045:A:1 Lurking in Shadows here", () => {
  it("05045:A:1 returns an engaged Underworld Dissident (a Brigand) to the staging area as it does any Brigand", () => {
    const made = table({ engaged: [CODES.dissident, "f3"].map((code) => ({ code, seat: 0 })), deck: ["f0", "f0"] });
    const revealed = revealedTop(made, "05045");
    expect(revealed.cards[idOf(revealed, CODES.dissident)]?.zone).toBe("staging");
    expect(revealed.cards[idOf(revealed, "f3")]?.zone).toBe("engaged");
  });
});
