// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages, dcce.immune, dcce.sailing-tests, rr.quest-advancement, rr.winning-the-game (data/rules/entries.json). The Stormcaller's area on a table of plain-number
// heroes and the Campaign Expansion's cards (scripts/stormcaller-scene.ts): where its cards stand, the end of the round, the stage advance, catching up, and the progress that moves onto its stage.
import { beforeAll, describe, expect, it } from "vitest";

import { holds } from "../../conditions.ts";
import { ruleCause } from "../../cause.ts";
import { modifiedStat, placeDamage } from "../../keywords.ts";
import { settle } from "../../machine.ts";
import type { EngineStep } from "../../intents.ts";
import { legalTargets } from "../../legal.ts";
import { moveCard } from "../../zones.ts";
import { placeQuestProgress } from "../../quest.ts";
import { travelCostUnpayable } from "../../restrictions.ts";
import type { ScenarioState } from "../../state.ts";
import { CODES, codesIn, finish, idOf, loadFlightWorld, flightTable, resolveRecords, type FlightLayout, type FlightWorld } from "../../../../scripts/stormcaller-scene.ts";
import { areaOf } from "./zone.ts";

let world: FlightWorld;

beforeAll(async () => {
  world = await loadFlightWorld();
});

const make = (layout: FlightLayout = {}) => flightTable(world, layout);
type Table = ReturnType<typeof make>;
type Run = { state: ScenarioState; steps: EngineStep[] };

const zoneOf = (state: ScenarioState, id: string): string | undefined => state.cards[id]?.zone;
const stageOf = (state: ScenarioState): { number: number; progress: number; code: string } => {
  const area = areaOf(state)!;
  return { number: area.number, progress: state.cards[area.stage]?.progress ?? 0, code: state.cards[area.stage]?.code ?? "" };
};

// The round ends: the phase after "End of round" is reached, as the engine does when the refresh phase is over.
function endRound(made: Table, state: ScenarioState = made.state): Run {
  const steps: EngineStep[] = [];
  const settled = finish({ state: settle({ ...state, phase: "Beginning of round", boundaryPhase: "End of round", mode: "beginRound", window: null }, made.ctx, steps), steps }, made.ctx);
  return { state: settled.state, steps: settled.steps };
}

describe("the Stormcaller's area (dcce.stormcallers-area)", () => {
  it("holds the Stormcaller and its current stage outside the staging area while the players are at another stage, immune to player card effects", () => {
    const made = make({ staging: ["place"], area: [CODES.escort] });
    const { state } = made;
    expect(zoneOf(state, made.caller)).toBe("stormcallerArea");
    expect(zoneOf(state, made.callerStage)).toBe("stormcallerArea");
    expect(state.staging.map((id) => state.cards[id]?.code)).toEqual(["place"]);
    expect(areaOf(state)?.members).toEqual([made.caller, idOf(state, CODES.escort)].filter((id) => id !== made.callerStage));
    // The Threat of the area does not count in the staging area, and a player card cannot choose it.
    expect(legalTargets(state, { type: "DeclareAttackers", cardId: made.hero }, made.ctx)).not.toContain(made.caller);
    expect(holds(state, { kind: "stormcaller", is: "sameStage" }, { actor: 0, sourceId: null, returned: 0 }, made.ctx)).toBe(false);
  });

  it("puts its cards in the staging area when the players reach the Stormcaller's stage, and back in the area when the Stormcaller moves on", () => {
    const made = make({ stage: "12013", area: [CODES.escort, CODES.coastland] });
    const same = settle(made.state, made.ctx, []);
    expect(codesIn(same, "staging")).toEqual([CODES.coastland, CODES.escort, CODES.stormcallerOriginal].sort());
    expect(codesIn(same, "stormcallerArea")).toEqual(["12016"]);
    expect(areaOf(same)?.members).toHaveLength(3);
    // The Stormcaller advances: its cards go back to its area, where they are no longer in the staging area.
    const ahead = flightTable(world, { stage: "12013", area: [CODES.escort, CODES.coastland], caller: 3 });
    const apart = settle(ahead.state, ahead.ctx, []);
    expect(codesIn(apart, "staging")).toEqual([]);
    expect(codesIn(apart, "stormcallerArea").sort()).toEqual([CODES.coastland, CODES.escort, CODES.stormcallerOriginal, "12017"].sort());
  });

  it("stops being a card of the area when it leaves it, and a card of the staging area that was never in it is left alone", () => {
    const made = make({ stage: "12013", staging: ["place"], area: [CODES.escort] });
    const same = settle(made.state, made.ctx, []);
    expect(codesIn(same, "staging")).toContain("place");
    const escort = idOf(same, CODES.escort);
    // Engaged with a player, the Escort is no longer in the area: the Stormcaller advancing does not take it back.
    const engaged = { ...same, cards: { ...same.cards, [escort]: { ...same.cards[escort]!, zone: "engaged" as const, controller: 0 } }, staging: same.staging.filter((id) => id !== escort), seats: [{ ...same.seats[0], engaged: [escort] }, same.seats[1]] as ScenarioState["seats"] };
    const settled = settle(engaged, made.ctx, []);
    expect(areaOf(settled)?.members).not.toContain(escort);
  });
});

describe("a card discarded from the encounter deck (11193:B:2)", () => {
  it("is announced in a game with ships even where the Stormcaller's area does not exist", () => {
    const made = make({ deck: ["f3"] });
    const noArea: ScenarioState = { ...made.state, sea: { ...made.state.sea!, stormcaller: undefined } };
    const top = noArea.encounterDeck[0]!;
    const moved = moveCard(noArea, top, { zone: "encounterDiscard" });
    expect(moved.pendingEvents?.some((event) => event.trigger === "discardedFromEncounterDeck")).toBe(true);
    const plain: ScenarioState = { ...noArea, sea: undefined };
    expect(moveCard(plain, top, { zone: "encounterDiscard" }).pendingEvents?.some((event) => event.trigger === "discardedFromEncounterDeck") ?? false).toBe(false);
  });
});

describe("the end of the round (12016:B:3, 12017:B:3, 12018:B:1)", () => {
  it("discards the top card of the encounter deck and places progress on the Stormcaller's stage equal to its Threat plus the Threat of that card", () => {
    const made = make({ deck: ["f3", "f0"] });
    const { state, steps } = endRound(made);
    // The Stormcaller prints Threat 2 and the discarded card 3.
    expect(stageOf(state).progress).toBe(5);
    expect(codesIn(state, "encounterDiscard")).toEqual(["f3"]);
    const progress = steps.filter((step) => step.kind === "progress");
    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({ amount: 5, cause: { effect: "12016:forced:1" } });
  });

  it("adds the Threat of each Sahír's Escort in the area, also while the players are at the Stormcaller's stage and it stands in the staging area (dcce.stormcallers-area-stages)", () => {
    const made = make({ deck: ["f0"], area: [CODES.escort, CODES.escort] });
    expect(stageOf(endRound(made).state).progress).toBe(2 + 2 + 2);
    const caught = make({ stage: "12013", deck: ["f0"], area: [CODES.escort, CODES.escort] });
    const caughtRound = endRound(caught, settle(caught.state, caught.ctx, []));
    expect(codesIn(caughtRound.state, "staging")).toContain(CODES.escort);
    expect(stageOf(caughtRound.state).progress).toBe(2 + 2 + 2);
  });

  it("gets +2 Threat while the players are off-course (12016:B:1, 12017:B:1), and the printed Threat of the discarded card only", () => {
    const made = make({ deck: ["f3"], heading: "Rain" });
    expect(modifiedStat(made.state, made.state.cards[made.caller]!, "threat", world.cards)).toBe(4);
    expect(stageOf(endRound(made).state).progress).toBe(4 + 3);
  });

  it("takes no more than 4 damage each round on stage 2, and 8 on stage 3 (12016:B:2, 12017:B:2)", () => {
    const damageAfter = (layout: FlightLayout, dealt: number): number => {
      const made = make({ ...layout, staging: [] });
      const hit = placeDamage(made.state, made.caller, dealt, world.cards, [], "framework", ruleCause("rr.damage"));
      // A second blow in the same round finds the cap used.
      return placeDamage(hit, made.caller, dealt, world.cards, [], "framework", ruleCause("rr.damage")).cards[made.caller]?.damage ?? 0;
    };
    expect(damageAfter({ caller: 2 }, 3)).toBe(4);
    expect(damageAfter({ caller: 3 }, 6)).toBe(8);
  });

  it("advances when the stage is full: the progress it needed is placed, the new stage's When Revealed resolves (a Sahír's Escort joins the area) and the Stormcaller returns to the area", () => {
    const made = make({ caller: 2, callerProgress: 10, deck: ["f3"], discard: [CODES.escort], stage: "12013", staging: [] });
    // At the same stage the Stormcaller stands in the staging area; it returns when its stage advances.
    const { state, steps } = endRound(made, settle(made.state, made.ctx, []));
    expect(stageOf(state)).toMatchObject({ number: 3, progress: 0, code: "12017" });
    expect(steps.some((step) => step.kind === "progress" && step.amount === 2)).toBe(true);
    expect(zoneOf(state, made.caller)).toBe("stormcallerArea");
    expect(codesIn(state, "stormcallerArea")).toContain(CODES.escort);
    // The defeated stage 2D is out of play.
    expect(zoneOf(state, made.callerStage)).toBe("setAside");
  });

  it("loses the game when the Stormcaller fills its last stage (12018:B:2)", () => {
    const made = make({ caller: 4, callerProgress: 20, deck: ["f3"] });
    const { state } = endRound(made);
    expect(state.lost).toBe(true);
    expect(state.lossReason).toContain("Captain Sahír has gotten away with the key");
  });
});

describe("destroying the Stormcaller (12019:A:4, 110042:A:4, 110042:B:5)", () => {
  it("wins the game when the Stormcaller is destroyed, on either side, and puts it in the victory display", () => {
    for (const campaignSide of [false, true]) {
      const made = make({ stage: "12013", campaignSide });
      const settled = settle(made.state, made.ctx, []);
      const worn = { ...settled, cards: { ...settled.cards, [made.caller]: { ...settled.cards[made.caller]!, damage: campaignSide ? 19 : 17 } } };
      const state = settle({ ...placeDamage(worn, made.caller, 1, world.cards, [], "framework", ruleCause("rr.damage")), window: null }, made.ctx, []);
      expect(state.stageCleared, String(campaignSide)).toBe(true);
      expect(state.victory.map((id) => state.cards[id]?.code)).toEqual([campaignSide ? CODES.stormcaller : CODES.stormcallerOriginal]);
    }
  });

  it("is not destroyed by the damage the Campaign Mode only side's extra hit points absorb", () => {
    const made = make({ stage: "12013", campaignSide: true });
    const worn = { ...made.state, cards: { ...made.state.cards, [made.caller]: { ...made.state.cards[made.caller]!, damage: 17 } } };
    const state = settle({ ...placeDamage(worn, made.caller, 1, world.cards, [], "framework", ruleCause("rr.damage")), window: null }, made.ctx, []);
    expect(state.stageCleared).toBe(false);
    expect(modifiedStat(state, state.cards[made.caller]!, "hitPoints", world.cards)).toBe(20);
  });
});

describe("catching up to the Stormcaller (12013:B:3, 12014:B:3, 12015:B:3)", () => {
  // The players place `amount` progress on the quest card.
  const place = (layout: FlightLayout, amount: number): ScenarioState => placeQuestProgress(make(layout).state, amount, world.cards, [], () => true);

  it("wins when stage 2B is defeated while the Stormcaller is at stage 2, and advances to stage 3 when it is at stage 3", () => {
    const won = place({ stage: "12013", progress: 10, caller: 2 }, 2);
    expect(won.stageCleared).toBe(true);
    expect(won.cards[won.questStage ?? ""]?.code).toBe("12013");
    const moved = place({ stage: "12013", progress: 10, caller: 3 }, 2);
    expect(moved.stageCleared).toBe(false);
    expect(moved.cards[moved.questStage ?? ""]?.code).toBe("12014");
  });

  it("wins when stage 3B is defeated at the Stormcaller's stage 3, and stage 4B wins whenever it is defeated", () => {
    expect(place({ stage: "12014", progress: 16, caller: 3 }, 2).stageCleared).toBe(true);
    const moved = place({ stage: "12014", progress: 16, caller: 4 }, 2);
    expect(moved.stageCleared).toBe(false);
    expect(moved.cards[moved.questStage ?? ""]?.code).toBe("12015");
    expect(place({ stage: "12015", progress: 22, caller: 4 }, 2).stageCleared).toBe(true);
  });
});

describe("moving progress onto the Stormcaller's stage (12012:B:2, 12026:A:1)", () => {
  it("moves up to 2 progress from the quest at the end of the quest phase when off-course, and none on-course", () => {
    const off = make({ stage: "12012", progress: 5, heading: "Cloud", phase: "Quest" });
    const moved = settle({ ...off.state, phase: "Travel", mode: "travel", window: null }, off.ctx, []);
    expect(off.state.cards[off.state.questStage ?? ""]?.progress).toBe(5);
    expect(stageOf(moved).progress).toBe(2);
    expect(moved.cards[moved.questStage ?? ""]?.progress).toBe(3);
    const on = make({ stage: "12012", progress: 5, heading: "Sun", phase: "Quest" });
    const same = settle({ ...on.state, phase: "Travel", mode: "travel", window: null }, on.ctx, []);
    expect([stageOf(same).progress, same.cards[same.questStage ?? ""]?.progress]).toEqual([0, 5]);
  });

  it("moves up to 2 progress and a full stage advances (Hidden Cove's Travel), and cannot be travelled to while the quest holds less than 2", () => {
    const made = make({ stage: "12013", progress: 2, callerProgress: 10, staging: [CODES.cove] });
    const cove = idOf(made.state, CODES.cove);
    expect(travelCostUnpayable(made.state, made.ctx, cove)).toBe(false);
    const run = resolveRecords(made.state, made.ctx, CODES.cove, "travel", cove);
    expect(run.state.cards[run.state.questStage ?? ""]?.progress).toBe(0);
    expect(stageOf(run.state)).toMatchObject({ number: 3, progress: 0 });
    const short = make({ stage: "12013", progress: 1, callerProgress: 11, staging: [CODES.cove] });
    expect(travelCostUnpayable(short.state, short.ctx, idOf(short.state, CODES.cove))).toBe(true);
  });
});
