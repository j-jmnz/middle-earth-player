// Rules: mec109.ringbearers-life, mec109.burden-deck, rr.attachment-cards, rr.travel, rr.explored, rr.then, rr.in-play-and-out-of-play, rr.reveal, rr.forced (data/rules/entries.json).
// Lines: 141063:A:1, 906302:A:1, 906303:A:2, 906304:A:2, 906305:A:1, 906305:A:2, 906306:A:1, 906306:A:2, 906307:A:1, 906308:A:2, 906309:A:2, 141056:B:1. The Flight to the Ford cards whose lines no test
// named, each read from its printed line on the scene's table (test/scenarios/flight-to-the-ford/scene.ts: Frodo the Ring-bearer with The One Ring and An Evil Wound, Sam, life 15), and each run again
// with the records of its line removed (test/harness/card-spec.ts, withoutLine), where it must not hold.
import { beforeAll, describe, expect, it } from "vitest";

import { sideInstructions } from "../../../catalog/scenario-data.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { GameEvent, ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { countsAsAttachment, hasTrait } from "../../../rules/interpret/conditions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { withoutLine } from "../../../../test/harness/card-spec.ts";
import { addStandIns, finish, first, idOf, resolveRecords, revealFromTop, sceneEffects, send, type Run } from "../../../../test/harness/scene-kit.ts";
import { BURDENS, FELL_RIDER, fordTable, loadFordWorld, WITCH_KING, type FordLayout, type FordWorld } from "../../../../test/scenarios/flight-to-the-ford/scene.ts";

const NIGHTMARE = ["906302", "906303", "906304", "906305", "906306", "906307", "906308", "906309"];
const BLACK_STEED = "141074"; // a Morgul treachery that attaches to a Nazgûl
const ALL = sceneEffects();
const without = (...lines: string[]) => lines.reduce(withoutLine, ALL);

let world: FordWorld;
beforeAll(async () => {
  world = await loadFordWorld();
  for (const [code, card] of await loadPrinted(NIGHTMARE)) world.cards.set(code, card);
  // A player attachment with no text, to try on the Fell Riders.
  addStandIns(world.cards, ["attachment"]);
}, 120_000);

function make(layout: FordLayout = {}) {
  const made = fordTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

// The engine announces the event to the Forced effects; what they start resolves, a choice answered by `pick` (the first option by default), and the round stops where it is (resolveRecords,
// test/harness/scene-kit.ts).
function announce(state: ScenarioState, event: GameEvent, ctx: ReduceContext, pick?: (state: ScenarioState) => string): Run {
  const steps: EngineStep[] = [];
  return finish({ state: settle({ ...fireForced({ ...state, window: null }, event, ctx, steps), mode: "stopped" }, ctx, steps), steps }, ctx, pick);
}

// The card is revealed from the top of the encounter deck and what it opens is answered.
function reveal(state: ScenarioState, ctx: ReduceContext, code: string): Run & { id: string } {
  const steps: EngineStep[] = [];
  const shown = revealFromTop(state, ctx, code, steps);
  return { ...finish({ state: shown.state, steps }, ctx), id: shown.id };
}

// The windows an effect leaves open are passed (a response window after an enemy engages) until it has resolved.
function passOut(run: Run, ctx: ReduceContext): Run {
  let current = run;
  for (let guard = 0; guard < 20 && current.state.window?.kind === "response"; guard += 1) current = send(current, { type: "Pass" }, ctx);
  return finish(current, ctx);
}

const lifeSteps = (run: Run, effect: string) => run.steps.filter((step) => step.kind === "life" && "effect" in step.cause && step.cause.effect === effect);

describe("Fell Rider (141063, 906302)", () => {
  // "Cannot have non-Morgul attachments."
  for (const [code, line] of [[FELL_RIDER, "141063:A:1"], ["906302", "906302:A:1"]] as const) {
    it(`${line} a player attachment is refused on it, a Morgul card (Black Steed) is not`, () => {
      const made = make({ staging: [code] });
      const rider = idOf(made.state, code);
      expect(attachBlocked(made.state, made.ctx, rider, "attachment")).toBe(true);
      expect(attachBlocked(made.state, made.ctx, rider, BLACK_STEED)).toBe(false);
      const bare = make({ staging: [code], effects: without(line) });
      expect(attachBlocked(bare.state, bare.ctx, idOf(bare.state, code), "attachment")).toBe(false);
    });
  }
});

describe("the Nightmare locations' Travel costs (906303, 906304)", () => {
  // "Travel: Each player searches the encounter deck and discard pile for a Nazgûl enemy and puts it into play engaged with him. Shuffle the encounter deck."
  it("906303:A:2 each player takes a Nazgûl from the encounter deck or its discard pile, engaged with him", () => {
    const layout: FordLayout = { seats: 2, stage: "141029", active: "906303", deck: ["f0", FELL_RIDER, "f0"], discard: [WITCH_KING] };
    const made = make(layout);
    const { state } = passOut(resolveRecords(made.state, made.ctx, "906303", "travel", idOf(made.state, "906303")), made.ctx);
    const engaged = (seat: 0 | 1) => state.seats[seat].engaged.map((id) => state.cards[id]?.code);
    expect(engaged(0)).toHaveLength(1);
    expect(engaged(1)).toHaveLength(1);
    expect([...engaged(0), ...engaged(1)].sort()).toEqual([FELL_RIDER, WITCH_KING].sort());
    const bare = make({ ...layout, effects: without("906303:A:2") });
    const after = resolveRecords(bare.state, bare.ctx, "906303", "travel", idOf(bare.state, "906303")).state;
    expect(after.seats[0].engaged).toEqual([]);
  });

  // "Travel: Reduce the Ring-bearer's life by 1 to travel here."
  it("906304:A:2 traveling to Trollshaw Forest reduces the Ring-bearer's life by 1", () => {
    const made = make({ staging: ["906304"] });
    expect(resolveRecords(made.state, made.ctx, "906304", "travel", idOf(made.state, "906304")).state.life).toBe(14);
    const bare = make({ staging: ["906304"], effects: without("906304:A:2") });
    expect(resolveRecords(bare.state, bare.ctx, "906304", "travel", idOf(bare.state, "906304")).state.life).toBe(15);
  });
});

describe("Great East Road (906305)", () => {
  // "X is 1 plus the number of Nazgûl enemies in play." A Nazgûl in the staging area is in play (rr.in-play-and-out-of-play).
  const threat = (layout: FordLayout) => {
    const made = make(layout);
    const road = made.state.cards[idOf(made.state, "906305")];
    return road ? modifiedStat(made.state, road, "threat", made.ctx.cards) : -1;
  };

  it("906305:A:1 its Threat is 1 plus the Nazgûl engaged with the players", () => {
    expect(threat({ staging: ["906305"] })).toBe(1);
    expect(threat({ staging: ["906305"], engaged: [{ code: FELL_RIDER, seat: 0 }] })).toBe(2);
    expect(threat({ staging: ["906305"], engaged: [{ code: FELL_RIDER, seat: 0 }], effects: without("906305:A:1") })).not.toBe(2);
  });

  // FAULT: the card counts the Nazgûl "in play", and a Nazgûl in the staging area is in play (rr.in-play-and-out-of-play); the engine counts only the engaged ones, so a Fell Rider in the staging area adds nothing.
  it.fails("906305:A:1 a Nazgûl in the staging area is in play and counts for X", () => {
    expect(threat({ staging: ["906305", FELL_RIDER] })).toBe(2);
    expect(threat({ staging: ["906305", FELL_RIDER], engaged: [{ code: WITCH_KING, seat: 0 }] })).toBe(3);
  });

  // "While Great East Road is in the staging area, each Nazgûl enemy gets -5 engagement cost."
  it("906305:A:2 each Nazgûl gets -5 engagement cost while it is in the staging area, and not while it is the active location", () => {
    const cost = (layout: FordLayout) => {
      const made = make(layout);
      const rider = made.state.cards[idOf(made.state, FELL_RIDER)];
      return rider ? modifiedStat(made.state, rider, "engagementCost", made.ctx.cards) : -1;
    };
    expect(cost({ staging: ["906305", FELL_RIDER] })).toBe(25);
    expect(cost({ staging: [FELL_RIDER], active: "906305" })).toBe(30);
    expect(cost({ staging: ["906305", FELL_RIDER], effects: without("906305:A:2") })).toBe(30);
  });
});

describe("Pathless Wilderness (906306)", () => {
  // "Pathless Wilderness enters play with 3 resource tokens on it."
  it("906306:A:1 it enters play with 3 resource tokens on it", () => {
    const made = make({ deck: ["f0"] });
    const shown = reveal(made.state, made.ctx, "906306");
    expect(shown.state.cards[shown.id]?.resources).toBe(3);
    const bare = make({ deck: ["f0"], effects: without("906306:A:1") });
    const plain = reveal(bare.state, bare.ctx, "906306");
    expect(plain.state.cards[plain.id]?.resources ?? 0).toBe(0);
  });

  // "Forced: At the end of the round, discard 1 resource token here. Then, if there are no resource tokens here, reduce the Ring-bearer's life by 3."
  const endOfRound = (tokens: number, effects = ALL) => {
    const made = make({ staging: ["906306"], effects });
    const id = idOf(made.state, "906306");
    const state = { ...made.state, cards: { ...made.state.cards, [id]: { ...made.state.cards[id]!, resources: tokens } } };
    const run = announce(state, { trigger: "endOfRound", seat: null, phase: "End of round" }, made.ctx);
    return { run, resources: run.state.cards[id]?.resources ?? 0, lost: lifeSteps(run, "906306:forced:1").reduce((sum, step) => sum + ("amount" in step ? -step.amount : 0), 0) };
  };

  it("906306:A:2 one token comes off at the end of the round, and with tokens left the life is not reduced", () => {
    expect(endOfRound(2)).toMatchObject({ resources: 1, lost: 0 });
    expect(endOfRound(2, without("906306:A:2"))).toMatchObject({ resources: 2, lost: 0 });
  });

  it("906306:A:2 the last token taken off reduces the Ring-bearer's life by 3", () => {
    expect(endOfRound(1)).toMatchObject({ resources: 0, lost: 3 });
  });

  // FAULT: the card reduces the life by 3 only "then", after a token was discarded (rr.then); with no token left to discard the engine still reduces the life by 3 at the end of every round.
  it.fails("906306:A:2 with no token left to discard, the part after Then does not resolve and the life is not reduced (rr.then)", () => {
    expect(endOfRound(0)).toMatchObject({ resources: 0, lost: 0 });
  });
});

describe("Ettendales (906307)", () => {
  // "Forced: When Ettendales is explored, shuffle the top card of the burden deck into the encounter deck."
  const explore = (amount: number, effects = ALL) => {
    const made = make({ active: "906307", effects });
    const steps: EngineStep[] = [];
    const placed = runInstruction(made.state, { verb: "PlaceProgressOn", amount, target: "activeLocation" }, { seat: 0, sourceId: made.state.questStage ?? null }, made.ctx, steps);
    const state = finish({ state: settle({ ...placed, window: null }, made.ctx, steps), steps }, made.ctx).state;
    return state.cards[first(state, BURDENS[0])]?.zone;
  };

  it("906307:A:1 explored, it shuffles the top card of the burden deck into the encounter deck", () => {
    expect(explore(3)).toBe("encounterDeck");
    expect(explore(3, without("906307:A:1"))).toBe("burdenDeck");
  });

  it("906307:A:1 progress that does not explore it moves no burden", () => {
    expect(explore(2)).toBe("burdenDeck");
  });
});

describe("Come Back! (906308)", () => {
  // "When Revealed: Reduce the Ring-bearer's life by 1 and remove all progress from the current quest."
  it("906308:A:2 reduces the life by 1 and removes all progress from the current quest", () => {
    const made = make({ progress: 5, deck: ["f0"] });
    const { state } = reveal(made.state, made.ctx, "906308");
    expect(state.life).toBe(14);
    expect(state.cards[state.questStage ?? ""]?.progress).toBe(0);
    const bare = make({ progress: 5, deck: ["f0"], effects: without("906308:A:2") });
    const plain = reveal(bare.state, bare.ctx, "906308").state;
    expect(plain.life).toBe(15);
    expect(plain.cards[plain.questStage ?? ""]?.progress).toBe(5);
  });
});

describe("The Twilight World (906309)", () => {
  // "When Revealed: Attach to the Ring-bearer. Limit 1 per hero. (Counts as a Condition attachment with the text: 'Forced: At the beginning of the planning phase, either exhaust The One Ring, or reduce
  // the Ring-bearer's life by 1.')"
  const PLANNING: GameEvent = { trigger: "beginningOfPhase", seat: null, phase: "Planning" };

  it("906309:A:2 it attaches to the Ring-bearer", () => {
    const made = make({ deck: ["f0"] });
    const once = reveal(made.state, made.ctx, "906309");
    expect(once.state.cards[once.id]).toMatchObject({ zone: "attached", host: made.frodo });
    const bare = make({ deck: ["f0"], effects: without("906309:A:2") });
    const plain = reveal(bare.state, bare.ctx, "906309");
    expect(plain.state.cards[plain.id]?.zone).not.toBe("attached");
  });

  // FAULT: the card prints "Limit 1 per hero", and the record means a copy on the Ring-bearer to keep another off; the engine attaches a second copy to him, as the copy already attached has no
  // controller and the record's count reads only cards a player controls.
  it.fails("906309:A:2 a second copy does not attach while one is on the Ring-bearer (Limit 1 per hero)", () => {
    const made = make({ deck: ["f0", "f0"] });
    const once = reveal(made.state, made.ctx, "906309");
    const twice = reveal(once.state, made.ctx, "906309");
    expect(twice.state.cards[made.frodo]?.attachments.filter((id) => twice.state.cards[id]?.code === "906309")).toHaveLength(1);
    expect(twice.state.cards[twice.id]?.zone).toBe("encounterDiscard");
  });

  it("906309:A:2 attached, it counts as a Condition attachment", () => {
    const made = make({ deck: ["f0"] });
    const { state, id } = reveal(made.state, made.ctx, "906309");
    expect(countsAsAttachment(state, id, made.ctx)).toBe(true);
    expect(hasTrait(state, id, "Condition", made.ctx)).toBe(true);
    expect(countsAsAttachment(state, id, { ...made.ctx, effects: without("906309:A:2") })).toBe(false);
  });

  it("906309:A:2 at the beginning of the planning phase the first player exhausts The One Ring or reduces the life by 1", () => {
    const made = make({ deck: ["f0"], phase: "Planning" });
    const { state } = reveal({ ...made.state, phase: "Quest" }, made.ctx, "906309");
    const planning = { ...state, phase: "Planning" as const };
    const ring = first(planning, "141085");
    const exhausted = announce(planning, PLANNING, made.ctx, () => "exhaust").state;
    expect(exhausted.cards[ring]?.exhausted).toBe(true);
    expect(exhausted.life).toBe(15);
    const hurt = announce(planning, PLANNING, made.ctx, () => "life").state;
    expect(hurt.cards[ring]?.exhausted).toBe(false);
    expect(hurt.life).toBe(14);
    // With The One Ring already exhausted only the life can be paid.
    const spent = { ...planning, cards: { ...planning.cards, [ring]: { ...planning.cards[ring]!, exhausted: true } } };
    expect(announce(spent, PLANNING, made.ctx).state.life).toBe(14);
    expect(announce(planning, PLANNING, { ...made.ctx, effects: without("906309:A:2") }).state.life).toBe(15);
  });
});

describe("Flight to the Ford's Resolution (141056:B:1)", () => {
  // "Add each burden card in play, in the encounter deck, and in the discard pile to the Campaign Pool. The added cards have been earned by the players."
  it("141056:B:1 earns the burdens in play, in the encounter deck and in the discard pile, and not those in the burden deck or the victory display", () => {
    const [weight, fear, eaten, panicked, terror] = BURDENS;
    const earned = (effects = ALL) => {
      const made = make({ weight: true, deck: [fear], discard: [eaten], victory: [panicked], burden: [terror], effects });
      const won = { ...made.state, scenarioId: "flight-to-the-ford", window: null, stageCleared: true, resolution: sideInstructions(effects, "141056", "B", "resolution") };
      return (resolutionResult(openResolution(won, made.ctx))?.earned ?? []).map((item) => item.code).sort();
    };
    expect(earned()).toEqual([weight, fear, eaten].sort());
    expect(earned(without("141056:B:1"))).toEqual([]);
  });
});
