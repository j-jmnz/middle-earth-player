// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages, dcce.heading, dcce.campaign-mode, rr.attachment-cards, rr.forced, rr.search (data/rules/entries.json).
// Lines: 12019:A:2, 12019:A:3, 110042:A:2, 110042:A:3, 110042:B:3, 110042:B:4, 12013:A:1, 12013:B:2, 12014:B:2, 12015:B:2. The Stormcaller on both printings and both sides of the reprint, and the
// players' quest stages of Flight of the Stormcaller, each read from its printed line on a table of plain-number heroes (test/scenarios/flight-of-the-stormcaller/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { definePrinted } from "../../../rules/core/printed.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { areaOf } from "../../../rules/families/stormcaller/zone.ts";
import { revealFromTop } from "../../../../test/harness/scene-kit.ts";
import { CODES, SHIPS, codesIn, finish, flightTable, idOf, loadFlightWorld, resolveRecords, type FlightLayout, type FlightWorld } from "../../../../test/scenarios/flight-of-the-stormcaller/scene.ts";

let world: FlightWorld;

beforeAll(async () => {
  const loaded = await loadFlightWorld();
  const cards = new Map(loaded.cards);
  // A player attachment with no text, to try on the Stormcaller.
  cards.set("attachment", definePrinted({ code: "attachment", name: "attachment", type: "attachment", sphere: "neutral", cost: 0 }));
  world = { ...loaded, cards };
});

const make = (layout: FlightLayout = {}) => flightTable(world, layout);
type Table = ReturnType<typeof make>;

// The round ends, as the engine does when the refresh phase is over: the Stormcaller's stage takes its progress.
function endRound(made: Table, state: ScenarioState): ScenarioState {
  return finish({ state: settle({ ...state, phase: "Beginning of round", boundaryPhase: "End of round", mode: "beginRound", window: null }, made.ctx, []), steps: [] }, made.ctx).state;
}

// The table with the Stormcaller on the face given ("up" is side A of the card the layout deals).
function withFace(layout: FlightLayout, face: "up" | "B"): Table {
  const made = make(layout);
  return { ...made, state: syncConstants(updateCard(made.state, made.caller, { face }), made.ctx) };
}

describe("the Stormcaller (12019, 110042)", () => {
  it("12019:A:2 cannot have attachments: neither a player attachment nor an encounter card attaches to it", () => {
    const made = make({});
    expect(attachBlocked(made.state, made.ctx, made.caller, "attachment")).toBe(true);
    expect(attachBlocked(made.state, made.ctx, made.caller, CODES.squall)).toBe(true);
  });

  it("110042:A:2 cannot have player attachments: a player attachment is refused, an encounter card is not", () => {
    const made = withFace({ campaignSide: true }, "up");
    expect(attachBlocked(made.state, made.ctx, made.caller, "attachment")).toBe(true);
    expect(attachBlocked(made.state, made.ctx, made.caller, CODES.squall)).toBe(false);
  });

  it("110042:A:2 is printed on side A only: on its Campaign Mode only side the Stormcaller can have a player attachment", () => {
    const made = withFace({ campaignSide: true }, "B");
    expect(attachBlocked(made.state, made.ctx, made.caller, "attachment")).toBe(false);
  });

  // "When the Stormcaller advances to the next quest stage, return it to the Stormcaller's area." The players are at its stage 2 and it is engaged with the first player, so it is no card of the area any more:
  // only the line takes it back.
  const engagedThenAdvanced = (layout: FlightLayout, face?: "up" | "B"): { state: ScenarioState; made: Table } => {
    const made = face ? withFace({ ...layout, stage: "12013", callerProgress: 10, deck: ["f3"] }, face) : make({ ...layout, stage: "12013", callerProgress: 10, deck: ["f3"] });
    const same = settle(made.state, made.ctx, []);
    const engaged = settle(moveCard(same, made.caller, { zone: "engaged", seat: 0 }), made.ctx, []);
    expect(engaged.cards[made.caller]?.zone).toBe("engaged");
    expect(areaOf(engaged)?.members).not.toContain(made.caller);
    return { state: endRound(made, engaged), made };
  };

  it("12019:A:3 returns the Stormcaller to its area from a player's engagement when it advances to the next stage", () => {
    const { state, made } = engagedThenAdvanced({});
    expect(areaOf(state)?.number).toBe(3);
    expect(state.cards[made.caller]?.zone).toBe("stormcallerArea");
    expect(state.seats[0]?.engaged).not.toContain(made.caller);
  });

  it("110042:A:3 returns the reprint's side A to its area from a player's engagement when it advances", () => {
    const { state, made } = engagedThenAdvanced({ campaignSide: true }, "up");
    expect(areaOf(state)?.number).toBe(3);
    expect(state.cards[made.caller]?.zone).toBe("stormcallerArea");
  });

  it("110042:B:4 returns the Campaign Mode only side to its area from a player's engagement when it advances", () => {
    const { state, made } = engagedThenAdvanced({ campaignSide: true }, "B");
    expect(areaOf(state)?.number).toBe(3);
    expect(state.cards[made.caller]?.zone).toBe("stormcallerArea");
    expect(state.seats[0]?.engaged).not.toContain(made.caller);
  });

  // "If you are at the Stormcaller's stage, no more than 9 progress can be placed on your quest each round." Stage 3B prints 18 quest points, so the cap is what stops it.
  const placedOn = (layout: FlightLayout, amounts: readonly number[]): number => {
    const made = make({ stage: "12014", ...layout });
    let state = settle(made.state, made.ctx, []);
    for (const amount of amounts) state = placeQuestProgress(state, amount, world.cards, [], () => true);
    return state.cards[state.questStage ?? ""]?.progress ?? 0;
  };

  it("110042:B:3 lets no more than 9 progress be placed on the quest in a round at the Stormcaller's stage, in one placement or in two", () => {
    expect(placedOn({ caller: 3, campaignSide: true }, [12])).toBe(9);
    expect(placedOn({ caller: 3, campaignSide: true }, [5, 5])).toBe(9);
  });

  it("110042:B:3 caps nothing while the players are at another stage than the Stormcaller, and side A of the original prints no cap", () => {
    expect(placedOn({ caller: 4, campaignSide: true }, [12])).toBe(12);
    expect(placedOn({ caller: 3 }, [12])).toBe(12);
  });
});

describe("Full Sail Ahead, stage 2 (12013)", () => {
  it("12013:A:1 adds only 1 copy of Swift Raider to the staging area when the encounter deck holds two", () => {
    const made = make({ stage: "12013", deck: [CODES.raider, "f0", CODES.raider] });
    const run = resolveRecords(made.state, made.ctx, "12013", "whenRevealed", made.state.questStage ?? undefined);
    expect(codesIn(run.state, "staging").filter((code) => code === CODES.raider)).toHaveLength(1);
    expect(run.state.encounterDeck.map((id) => run.state.cards[id]?.code).filter((code) => code === CODES.raider)).toHaveLength(1);
  });

  it("12013:A:1 adds nothing and fails nothing when neither the encounter deck nor its discard pile holds a Swift Raider", () => {
    const made = make({ stage: "12013", deck: ["f0", "f3"], discard: ["f0"] });
    const run = resolveRecords(made.state, made.ctx, "12013", "whenRevealed", made.state.questStage ?? undefined);
    expect(run.state.failure).toBeNull();
    // The Stormcaller stands in the staging area at the players' stage 2; nothing joins it.
    expect(codesIn(run.state, "staging")).toEqual([CODES.stormcallerOriginal]);
    expect(run.state.encounterDeck).toHaveLength(2);
  });

  // "No more than 8 progress can be placed here each round. If you are off-course (Cloud, Rain, or Storm), no more than 4 progress can be placed here each round instead." The Stormcaller is at stage 3, so its
  // own cap does not apply.
  const placed = (heading: "Sun" | "Cloud" | "Rain" | "Storm", amounts: readonly number[]): number => {
    let state = make({ stage: "12013", caller: 3, heading }).state;
    for (const amount of amounts) state = placeQuestProgress(state, amount, world.cards, [], () => true);
    return state.cards[state.questStage ?? ""]?.progress ?? 0;
  };

  it("12013:B:2 lets no more than 8 progress be placed on it in a round on-course, added over two placements", () => {
    expect(placed("Sun", [5, 5])).toBe(8);
    expect(placed("Sun", [7])).toBe(7);
  });

  it("12013:B:2 lets no more than 4 progress be placed on it in a round off-course, on each off-course heading", () => {
    for (const heading of ["Cloud", "Rain", "Storm"] as const) expect(placed(heading, [3, 3]), heading).toBe(4);
  });
});

describe("The Weather Turns Foul, stage 3 (12014)", () => {
  // The staging step of the round: one card for each player, and one more at its end off-course.
  const revealedIn = (heading: "Sun" | "Storm", seats: 1 | 2): number => {
    const made = make({ stage: "12014", caller: 2, heading, seats, deck: ["f0", "f0", "f0", "f0", "f0", "f0"] });
    let state = settle({ ...made.state, mode: "staging", window: null }, made.ctx, []);
    for (let guard = 0; guard < 12 && state.mode === "staging"; guard += 1) state = settle(state, made.ctx, []);
    return state.staging.length;
  };

  it("12014:B:2 reveals one additional encounter card at the end of the staging step when off-course, with one player and with two", () => {
    expect(revealedIn("Storm", 1)).toBe(2);
    expect(revealedIn("Storm", 2)).toBe(3);
  });

  it("12014:B:2 reveals no additional card on-course", () => {
    expect(revealedIn("Sun", 1)).toBe(1);
    expect(revealedIn("Sun", 2)).toBe(2);
  });
});

describe("The Cape of Andrast, stage 4 (12015)", () => {
  // "Forced: After a Weather treachery is revealed, deal 1 damage to each Ship objective and Ship enemy at this stage." Two players, each with a ship-objective; a Ship enemy engaged with the first player and one
  // in the staging area; the Stormcaller at stage 3, in its area.
  const revealed = (code: string): ScenarioState => {
    const made = make({ stage: "12015", caller: 3, seats: 2, engaged: [{ code: "ship", seat: 0 }], staging: [CODES.raider], deck: ["f0", "f0"] });
    const second = spawn(made.state, SHIPS.dawnStar, { zone: "play", seat: 1 });
    const steps: EngineStep[] = [];
    return finish({ state: revealFromTop(syncConstants(second.state, made.ctx), made.ctx, code, steps).state, steps }, made.ctx).state;
  };
  const damage = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.damage ?? 0;

  it("12015:B:2 deals 1 damage to each player's Ship objective and to each Ship enemy at the players' stage, engaged or in the staging area, after a Weather treachery is revealed", () => {
    const state = revealed("weather");
    expect([damage(state, SHIPS.dreamChaser), damage(state, SHIPS.dawnStar)]).toEqual([1, 1]);
    expect([damage(state, "ship"), damage(state, CODES.raider)]).toEqual([1, 1]);
    // The Stormcaller is at another stage, in its area: it takes none.
    expect(damage(state, CODES.stormcallerOriginal)).toBe(0);
  });

  it("12015:B:2 deals no damage after a treachery without the Weather trait is revealed", () => {
    const state = revealed("treachery");
    expect([damage(state, SHIPS.dreamChaser), damage(state, SHIPS.dawnStar), damage(state, "ship"), damage(state, CODES.raider)]).toEqual([0, 0, 0, 0]);
  });
});
