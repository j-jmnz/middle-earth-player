// Rules: ats.underworld, ats.underworld-example, rr.reveal, rr.staging, rr.surge, rr.explored, rr.search, rr.in-play-and-out-of-play (data/rules/entries.json).
// The stacks of Underworld X on The Steward's Fear's own cards: what each location takes when it is revealed, found by a search or made active, the cards under any location revealed one at a time when it leaves play (the active location Sewers stacks under too), the Response of The Fourth Star and
// Unwelcome Discovery. The rest of the scenario's lines are in lines.test.ts and spec.test.ts. Each test builds its moment with the scene kit and its title starts with the line it proves.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { fightEnemy, finish, idOf, idsOf, legalIntents, resolveRecords, revealedTop, send, type Layout } from "../../../../test/harness/scene-kit.ts";
import { CODES, DECK_CODES, codeOf, deckCodes, discarded, explored, run, stackOne, stagedCodes, table, underCodes, withDeck } from "../../../../test/scenarios/the-stewards-fear/table.ts";

const CITY_STREET = "05038";
const MARKET_SQUARE = "05039";

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
      const stacked = stackOne(t, t.state, sewers);
      const under = underCodes(stacked, sewers);
      const gone = leave === "explored" ? explored(t, stacked) : discarded(t, stacked, sewers);
      expect(underCodes(gone, sewers)).toHaveLength(0);
      expect(gone.staging.map((id) => gone.cards[id]?.code)).toContain(under[0]);
    }
  });
});

describe("ats.underworld the reveal of a stacked card", () => {
  it("06018:A:1 the reveal step of a card released from under a location that left play cites ats.underworld, not the staging step", () => {
    const t = withDeck({ active: CODES.sewers });
    const sewers = idOf(t.state, CODES.sewers);
    const stacked = stackOne(t, t.state, sewers);
    const steps: EngineStep[] = [];
    settle({ ...moveCard(stacked, sewers, { zone: "encounterDiscard" }), window: null }, t.ctx, steps);
    const reveals = steps.filter((step): step is Extract<EngineStep, { kind: "reveal" }> => step.kind === "reveal");
    expect(reveals).toHaveLength(1);
    expect(reveals[0]?.cause).toEqual({ rule: "ats.underworld" });
  });
});

describe("06018:A:1 Sewers explored in an action window", () => {
  // Secret Map (06027:A:2) explores the active location in an open action window: the cards under it are revealed at once, with the window still open (ats.underworld: "when a location leaves play").
  for (const phase of ["Planning", "Combat"] as const) {
    it(`06018:A:1 the card under Sewers is revealed and staged the moment Secret Map explores it in the ${phase} action window, before anyone passes`, () => {
      const t = withDeck({ phase, active: CODES.sewers, attached: [{ code: CODES.map, to: "dh1", encounter: true }] });
      const sewers = idOf(t.state, CODES.sewers);
      const stacked = { ...stackOne(t, t.state, sewers), window: t.state.window };
      const under = underCodes(stacked, sewers);
      expect(under).toHaveLength(1);
      expect(stacked.window?.kind).toBe("pass");
      const offered = legalIntents(stacked, t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "06027:action:2");
      expect(offered).toBeDefined();
      const done = finish(send({ state: stacked, steps: [] }, offered as Parameters<typeof send>[1], t.ctx), t.ctx).state;
      expect(done.cards[sewers]?.zone).toBe("encounterDiscard");
      expect(done.window?.kind).toBe("pass");
      expect(underCodes(done, sewers)).toHaveLength(0);
      expect(done.staging.map((id) => codeOf(done, id))).toContain(under[0]);
      expect(done.cards[done.staging.find((id) => codeOf(done, id) === under[0]) ?? ""]?.face).toBe("up");
    });
  }
});

describe("06018:A:1 Sewers explored as the stage advances", () => {
  it("06011:B:3 the card under the explored location is revealed before the stage advances: the location left play first, the stage's Forced effect is after it", () => {
    const t = withDeck({ active: CODES.sewers, stage: CODES.conspiracy, side: "B", setAside: ["06029", CODES.roots] }, ["05042"]);
    const sewers = idOf(t.state, CODES.sewers);
    const stage = t.state.questStage ?? "";
    const stacked = stackOne(t, { ...t.state, round: 1, cards: { ...t.state.cards, [stage]: { ...t.state.cards[stage]!, resources: 3 } } }, sewers);
    expect(underCodes(stacked, sewers)).toEqual(["05042"]);
    const steps: EngineStep[] = [];
    const done = settle(run(t, stacked, { verb: "PlaceProgressOn", amount: 9, target: "activeLocation" }), t.ctx, steps);
    expect(codeOf(done, done.questStage)).toBe(CODES.design);
    const revealed = steps.filter((step) => step.kind === "reveal").map((step) => codeOf(done, step.cardId));
    expect(revealed.slice(0, 2)).toEqual(["05042", "06029"]);
    expect(stagedCodes(done).slice(0, 2)).toEqual(["05042", "06029"]);
  });
});

describe("06019 Roots of Mindolluin", () => {
  it("06019:A:1 takes its Underworld 1 card when stage 2 makes it the active location from the set aside zone, and the old active location keeps its stack", () => {
    const t = withDeck({ active: CODES.sewers, setAside: [CODES.roots], stage: CODES.design, side: "A" });
    const sewers = idOf(t.state, CODES.sewers);
    const stacked = stackOne(t, t.state, sewers);
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
    const stacked = stackOne(t, t.state, roots);
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

  it("06020:A:1 revealed from the encounter deck it takes 1 card", () => {
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
      expect(deckCodes(revealed), location).toHaveLength(DECK_CODES.length - amount);
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

  it("06022:A:3 is offered when the settle sweep explores it in the staging area, its progress at its quest points (rr.explored)", () => {
    const t = table({ seats: 2, firstPlayer: 1, staging: [{ code: CODES.star, progress: 9 }], deckOf: Array.from({ length: 6 }, (_, index) => ({ code: "filler", seat: index % 2 })) });
    const open = settle({ ...t.state, window: null }, t.ctx, []);
    expect(open.cards[idOf(open, CODES.star)]?.zone).not.toBe("staging");
    expect(open.window).toMatchObject({ kind: "response", seat: 1 });
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

