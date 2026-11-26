// Rules: rm.time-x, rm.does-not-stack, rr.engaged, rr.forced, rr.drawing-cards, rr.active-location, rr.cannot (data/rules/entries.json).
// The engine pieces The Dunland Trap adds (the spec rows hold the cards' own lines): Time X counted for the players of the game, Hills of Dunland acting once, Chief Turch, the stage that wins or loses at its last counter and the draw of the resource phase.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; dh1 and dh2 are the first seat's, dh3 the second's.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../../rules/core/state.ts";
import { timeLimit, timeOnReveal } from "../../../rules/families/angmar/time.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import type { GameEvent, ScenarioState } from "../../../rules/core/state.ts";
import { heldStat, NO_COUNTS } from "../../../rules/interpret/constants.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { placeDamage } from "../../../rules/core/damage.ts";
import { fight, finish, idOf, idsOf, opened, resolveRecords, revealedTop, run, tableFromLayout, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-dunland-trap";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const STAGE_1 = "08011";
const STAGE_3 = "08013";
const HILLS = "08020";
const TURCH = "08014";
// The Forced effects that hear this event resolve (a draw by the first seat is `cardsDrawn`), and the choices they open are answered.
function hear(made: { ctx: ReturnType<typeof table>["ctx"] }, state: ScenarioState, event: Partial<GameEvent> & Pick<GameEvent, "trigger">): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: settle(fireForced({ ...state, window: null }, { seat: 0, ...event } as GameEvent, made.ctx, steps), made.ctx, steps), steps }, made.ctx).state;
}
const DRAWS: Pick<GameEvent, "trigger"> & { amount: number } = { trigger: "cardsDrawn", amount: 1 };

describe("Time X is 5 times the players (08013:B:1)", () => {
  const turned = (layout: Layout, eliminate?: number) => {
    const t = table({ stage: STAGE_3, side: "A", ...layout });
    const stage = t.state.questStage ?? "";
    const seats = (eliminate == null ? t.state.seats : t.state.seats.map((seat, at) => (at === eliminate ? { ...seat, eliminated: true } : seat))) as typeof t.state.seats;
    return timeOnReveal(updateCard({ ...t.state, seats }, stage, { face: "B" }), stage, t.ctx).cards[stage]?.resources;
  };

  it("08013:B:1 one player puts 5 time counters on the stage", () => {
    expect(turned({ seats: 1 })).toBe(5);
  });

  it("08013:B:1 two players put 10", () => {
    expect(turned({ seats: 2 })).toBe(10);
  });

  it("08013:B:1 a player eliminated before the stage turns is not counted", () => {
    expect(turned({ seats: 2 }, 1)).toBe(5);
  });

  it("08011:B:1 the first stage keeps its printed Time 2, and the limit is 5 for each player on stage 3B", () => {
    const t = table({ seats: 2, stage: STAGE_3 });
    expect(timeLimit(t.state, t.ctx, STAGE_1)).toBe(2);
    expect(timeLimit(t.state, t.ctx, STAGE_3)).toBe(10);
  });
});

describe("Hills of Dunland does not stack (08020:A:1)", () => {
  const DUNLAND = "07046";
  const draw = (made: ReturnType<typeof table>, state = made.state) => hear(made, opened(made, state).state, DRAWS);
  const discarded = (state: ReturnType<typeof run>) => state.encounterDiscard.length;

  it("08020:A:1 two copies in the staging area discard one card for one draw", () => {
    const t = table({ staging: [HILLS, HILLS], deck: [DUNLAND, "f0", "f0"], deckOf: [{ code: "filler", seat: 0 }, { code: "filler", seat: 0 }] });
    const done = draw(t);
    expect(done.encounterDeck.length).toBe(t.state.encounterDeck.length - 1);
    expect(done.seats[0]?.engaged.map((id) => done.cards[id]?.code)).toEqual([DUNLAND]);
  });

  it("08020:A:1 when the older copy leaves the staging area the other one acts", () => {
    const t = table({ staging: [HILLS, HILLS], deck: ["f0", "f0", "f0"], deckOf: [{ code: "filler", seat: 0 }, { code: "filler", seat: 0 }] });
    const [older] = idsOf(t.state, HILLS);
    const left = updateCard(t.state, older ?? "", { zone: "encounterDiscard" });
    expect(discarded(draw(t, left)) - discarded(left)).toBe(1);
  });

  it("08020:A:1 a copy that is the active location gives nothing", () => {
    const t = table({ active: HILLS, deck: ["f0", "f0", "f0"], deckOf: [{ code: "filler", seat: 0 }, { code: "filler", seat: 0 }] });
    expect(discarded(draw(t))).toBe(discarded(t.state));
  });
});

describe("Chief Turch (08013:A:1, 08014)", () => {
  const STAGE = (layout: Layout = {}) => table({ stage: STAGE_3, phase: "Quest", timeCounters: 10, seats: 2, setAside: [TURCH], ...layout });

  it("08013:A:1 he enters engaged with the first player and his own engagement takes the first counter", () => {
    const t = STAGE();
    const stage = t.state.questStage ?? "";
    const done = resolveRecords(opened(t).state, t.ctx, STAGE_3, "whenRevealed", stage).state;
    expect(zoneOf(done, TURCH)).toBe("engaged");
    expect(done.cards[idOf(done, TURCH)]?.controller).toBe(0);
    expect(done.cards[stage]?.resources).toBe(9);
  });

  it("08014:A:1 damage past his hit points leaves him in play", () => {
    const t = table({ stage: STAGE_3, engaged: [{ code: TURCH, seat: 0 }] });
    const state = opened(t).state;
    const id = idOf(state, TURCH);
    const done = settle(placeDamage(state, id, 9, t.ctx.cards, [], "framework", ruleCause("test")), t.ctx, []);
    expect(zoneOf(done, TURCH)).toBe("engaged");
  });

  it("08014:A:2 when the first player token passes he follows it and the engagement takes a counter", () => {
    const t = STAGE({ setAside: [], engaged: [{ code: TURCH, seat: 0 }] });
    const state = { ...opened(t).state, firstPlayer: 1 as const };
    const done = hear(t, state, { trigger: "firstPlayerTokenPassed", seat: 1 });
    expect(done.cards[idOf(done, TURCH)]?.controller).toBe(1);
    expect(done.cards[done.questStage ?? ""]?.resources).toBe(9);
  });
});

describe("The last counter of stage 3B (08013:B:2, B:3)", () => {
  const LAST = (layout: Layout = {}) => table({ stage: STAGE_3, phase: "Refresh", timeCounters: 1, engaged: [{ code: "f0", seat: 0 }], ...layout });

  it("08013:B:3 the last counter ends in a win when no hero is destroyed", () => {
    const t = LAST();
    const done = run(t, opened(t).state, { verb: "RemoveTimeFromQuest", amount: 1 });
    const played = fight(t, { state: done, steps: [] }, (state) => state.lost || state.stageCleared);
    expect(played.state.lost).toBe(false);
    expect(played.state.stageCleared).toBe(true);
  });

  it("08013:B:2 a hero destroyed by an attack of the last round loses the game", () => {
    const t = LAST({ engaged: [{ code: "f0", seat: 0 }] });
    const done = run(t, opened(t).state, { verb: "RemoveTimeFromQuest", amount: 1 });
    const hurt = updateCard(done, done.seats[0]?.heroes[0] ?? "", { damage: 5 });
    const played = fight(t, { state: hurt, steps: [] }, (state) => state.lost || state.stageCleared);
    expect(played.state.lost).toBe(true);
    expect(played.state.stageCleared).toBe(false);
  });
});

describe("Every way an enemy engages a player is heard by Chief Turch (08014:A:3)", () => {
  const STAGE = (layout: Layout = {}) => table({ stage: STAGE_3, phase: "Quest", timeCounters: 10, engaged: [{ code: TURCH, seat: 0 }], ...layout });
  const counters = (state: ScenarioState): number | undefined => state.cards[state.questStage ?? ""]?.resources;

  it("08014:A:3 a search that puts an enemy into play engaged takes a counter (stage 2B's search, its card a stand-in source)", () => {
    const t = STAGE({ deck: ["08018", "f0"] });
    const onlyB = { ...t.ctx, effects: t.ctx.effects.filter((effect) => effect.id !== "08012:whenRevealed:1") };
    const done = resolveRecords(opened(t).state, onlyB, "08012", "whenRevealed");
    expect(done.state.seats[0]?.engaged.map((id) => done.state.cards[id]?.code)).toContain("08018");
    expect(counters(done.state)).toBe(9);
  });

  it("08014:A:3 each enemy an engagement check puts into play engaged takes a counter", () => {
    const t = STAGE({ staging: ["08018", "08018"], threat: [30, 30] });
    const stage = t.state.questStage ?? "";
    const done = hear(t, opened(t).state, { trigger: "lastTimeCounterRemoved", cardId: stage, subject: stage });
    expect(done.seats[0]?.engaged.length).toBe(3);
    expect(counters(done)).toBe(8);
  });

  it("08020:A:1 a Dunland enemy that Hills of Dunland puts into play engaged takes a counter", () => {
    const t = STAGE({ staging: [HILLS], deck: ["07046", "f0", "f0"], deckOf: [{ code: "filler", seat: 0 }, { code: "filler", seat: 0 }] });
    const done = hear(t, opened(t).state, DRAWS);
    expect(counters(done)).toBe(9);
  });
});

describe("The draw of the resource phase (08021:A:1, 08022:A:1)", () => {
  const held = (layout: Layout): number => {
    const t = table(layout);
    return heldStat(opened(t).state, 0, "extraDraw", NO_COUNTS);
  };

  it("08021:A:1 Plains of Enedwaith takes the one card, and draw clamps at 0 so no draw is announced", () => {
    expect(1 + held({ active: "08021" })).toBe(0);
  });

  it("08022:A:1 Hithaeglir Stream makes it 2, and neither location changes the draw from the staging area", () => {
    expect(1 + held({ active: "08022" })).toBe(2);
    expect(held({ staging: ["08021", "08022"] })).toBe(0);
  });
});

describe("Encounter cards that draw, discard and attach (08023, 08024, 08018)", () => {
  const ALLY = "01015";
  // The card behind 08023 on the deck is revealed when it has surge.
  const revealed = (hand: Layout["hand"]) => {
    const t = tableFromLayout(SCENARIO, { seats: 2, deckOf: [{ code: "filler", seat: 0 }, { code: "filler", seat: 1 }], hand, deck: ["place", "f0"] }, { extra: [ALLY] });
    return revealedTop(t, "08023");
  };

  it("08023:A:1 with no ally in any hand it gains surge", () => {
    expect(zoneOf(revealed([{ code: "filler", seat: 0 }]), "place")).toBe("staging");
  });

  it("08023:A:1 with an ally discarded from a hand it does not", () => {
    const done = revealed([{ code: ALLY, seat: 1 }]);
    expect(zoneOf(done, "place")).toBe("encounterDeck");
    expect(done.seats[1]?.hand.some((id) => done.cards[id]?.code === ALLY)).toBe(false);
  });
});

describe("Stage 2A (08012:A:1)", () => {
  const FARAMIR = "01014";
  const SON = "01015";
  const GUARD = "01013";
  it("08012:A:1 the Ravine becomes the active location, Old South Road goes back to the staging area, each player keeps one ally", () => {
    const t = tableFromLayout(SCENARIO, { stage: "08012", side: "A", seats: 2, active: "08016", setAside: ["08015"], play: [FARAMIR, SON, { code: GUARD, seat: 1 }, { code: SON, seat: 1 }] }, { extra: [FARAMIR, SON, GUARD] });
    const done = resolveRecords(opened(t).state, t.ctx, "08012", "whenRevealed", t.state.questStage ?? "", (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")).state;
    expect(zoneOf(done, "08015")).toBe("activeLocation");
    expect(zoneOf(done, "08016")).toBe("staging");
    const allies = (seat: number) => (done.cards ? Object.values(done.cards).filter((card) => card.controller === seat && card.zone === "play" && ["01013", "01014", "01015"].includes(card.code)).length : 0);
    expect(allies(0)).toBe(1);
    expect(allies(1)).toBe(1);
  });
});

describe("Stage 2A with nothing to discard (08012:A:1)", () => {
  it("08012:A:1 a player with no ally and no Item keeps playing", () => {
    const t = table({ stage: "08012", side: "A", seats: 2, active: "08016", setAside: ["08015"] });
    const onlyA = { ...t.ctx, effects: t.ctx.effects.filter((effect) => effect.id !== "08012:whenRevealed:2") };
    const done = resolveRecords(opened(t).state, onlyA, "08012", "whenRevealed", t.state.questStage ?? "").state;
    expect(zoneOf(done, "08015")).toBe("activeLocation");
  });
});

describe("Dunlending Ambush on the active location (08024:A:2)", () => {
  it("08024:A:2 it attaches to the active location and, once the location is explored, each player's search puts a Dunland enemy into play engaged", () => {
    const t = table({ seats: 2, active: "08019", deck: ["07046", "07046", "07046", "f0"], phase: "Quest" });
    const revealed = revealedTop({ state: opened(t).state, ctx: t.ctx }, "08024");
    const ambush = idOf(revealed, "08024");
    const location = idOf(revealed, "08019");
    expect(revealed.cards[ambush]?.zone).toBe("attached");
    expect(revealed.cards[ambush]?.host).toBe(location);
    const explored = run(t, revealed, { verb: "PlaceProgressOn", amount: 9, target: "activeLocation" });
    expect(zoneOf(explored, "08019")).not.toBe("activeLocation");
    expect(explored.seats[0]?.engaged.length + (explored.seats[1]?.engaged.length ?? 0)).toBe(2);
  });
});

describe("Draw triggers and the end of the combat phase (08017, 08018, 08011:B:2, 08012:B:2)", () => {
  const DECK = [{ code: "filler", seat: 0 }, { code: "filler", seat: 0 }, { code: "filler", seat: 0 }];

  it("08018:A:1 a draw by the player a Warrior is engaged with deals it a shadow card, and the one of another player deals none", () => {
    const t = table({ seats: 2, engaged: [{ code: "08018", seat: 0 }], deck: ["f0", "f0", "f0"] });
    const warrior = idOf(opened(t).state, "08018");
    const dealt = hear(t, opened(t).state, DRAWS);
    expect(dealt.cards[warrior]?.shadowId).not.toBeNull();
    const other = hear(t, opened(t).state, { ...DRAWS, seat: 1 });
    expect(other.cards[warrior]?.shadowId ?? null).toBeNull();
  });

  it("08017:A:2 a draw by the player a Stalker is engaged with puts a resource token on it", () => {
    const t = table({ seats: 2, engaged: [{ code: "08017", seat: 0 }] });
    const done = hear(t, opened(t).state, DRAWS);
    expect(done.cards[idOf(done, "08017")]?.resources).toBe(1);
  });

  it("08011:B:2 the last counter makes each player discard the hand and draw 2, and 2 counters go on the stage", () => {
    const t = table({ seats: 2, stage: STAGE_1, hand: [{ code: "filler", seat: 0 }, { code: "filler", seat: 0 }, { code: "filler", seat: 1 }], deckOf: [...DECK, ...DECK.map(() => ({ code: "filler", seat: 1 }))] });
    const stage = t.state.questStage ?? "";
    const done = hear(t, opened(t).state, { trigger: "lastTimeCounterRemoved", cardId: stage, subject: stage });
    expect(done.cards[stage]?.resources).toBe(2);
    expect(done.seats[0]?.hand.length).toBe(2);
    expect(done.seats[1]?.hand.length).toBe(2);
  });

  it("08012:B:2 the end of the combat phase advances the quest to stage 3A, and the end of another phase does not", () => {
    const t = table({ stage: "08012", phase: "Combat", setAside: [TURCH] });
    const refresh = table({ stage: "08012", phase: "Refresh", setAside: [TURCH] });
    const other = hear(refresh, opened(refresh).state, { trigger: "endOfPhase" });
    expect(other.cards[other.questStage ?? ""]?.code).toBe("08012");
    const done = hear(t, opened(t).state, { trigger: "endOfPhase" });
    expect(done.cards[done.questStage ?? ""]?.code).toBe(STAGE_3);
  });
});
