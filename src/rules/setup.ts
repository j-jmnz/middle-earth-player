// Rules: mec109.setting-up-the-game, rr.setup, rr.mulligan (data/rules/entries.json).
import type { ScenarioDefinition } from "../catalog/boundary.ts";

import type { EngineStep } from "./intents.ts";
import { drawOpeningHand, runInstruction, type ReduceContext } from "./interpret.ts";
import { printedOf } from "./printed.ts";
import { shuffleIds } from "./seed.ts";
import { handSetup, searchSetup } from "./setup-search.ts";
import { blankScenario, livingSeats, updateCard, withMode, withSeat, withThreat, type ScenarioState } from "./state.ts";
import { cloneGame } from "./undo.ts";
import { moveCard, spawn } from "./zones.ts";

export type StartSeat = {
  heroes: readonly string[];
  deck: readonly string[];
};

export type StartScenario = {
  seatCount: 1 | 2;
  seed: number;
  threatModifier: number;
  definition: ScenarioDefinition;
  seats: readonly StartSeat[];
  encounterDeck: readonly string[];
  questDeck: readonly string[];
};

export function startScenario(input: StartScenario, ctx: ReduceContext): ScenarioState {
  let state = blankScenario({
    seatCount: input.seatCount,
    seed: input.seed,
    definition: input.definition,
  });
  input.questDeck.forEach((code, index) => {
    const spawned = spawn(state, code, index === 0 ? { zone: "questStage" } : { zone: "questDeck" }, "A");
    state = spawned.state;
  });
  for (const code of input.encounterDeck) {
    state = spawn(state, code, { zone: "encounterDeck" }).state;
  }
  state = shuffleZone(state, "encounter");
  for (let index = 0; index < input.seatCount; index += 1) {
    const seat = input.seats[index];
    if (!seat) throw new Error(`Missing seat ${index}`);
    let threat = input.threatModifier;
    for (const code of seat.heroes) {
      state = spawn(state, code, { zone: "heroes", seat: index }).state;
      threat += printedOf(ctx.cards, code).threat ?? 0;
    }
    for (const code of seat.deck) state = spawn(state, code, { zone: "deck", seat: index }).state;
    state = withThreat(state, index, threat);
    state = shuffleZone(state, index);
  }
  const quiet: EngineStep[] = [];
  state = searchSetup(state, "player", ctx, quiet);
  state = handSetup(state, ctx, quiet);
  for (const seat of livingSeats(state)) state = drawOpeningHand(state, seat, quiet);
  state = {
    ...withMode(state, "mulligan"),
    window: { kind: "mulligan" },
    activeSeat: state.firstPlayer,
  };
  return {
    ...state,
    undo: {
      phase: state.phase,
      snapshot: cloneGame(state),
      cards: structuredClone(state.cards),
      intents: [],
      steps: [],
    },
  };
}

export function finishSetup(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = searchSetup(state, "encounter", ctx, steps);
  for (const instruction of next.setup) {
    next = runInstruction(
      next,
      instruction,
      { seat: next.firstPlayer, sourceId: next.questStage },
      ctx,
      steps,
    );
    if (next.failure || next.lost) return next;
  }
  if (next.questStage) next = updateCard(next, next.questStage, { face: "B" });
  return withMode(next, "beginRound");
}

export function mulliganSeat(state: ScenarioState, seat: number, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of [...(next.seats[seat]?.hand ?? [])]) next = moveCard(next, id, { zone: "deck", seat });
  const seatState = next.seats[seat];
  if (!seatState) return next;
  const shuffled = shuffleIds(seatState.deck, next.seed, next.seedCursor);
  next = { ...withSeat(next, seat, { ...seatState, deck: shuffled.ids }), seedCursor: shuffled.cursor };
  return drawOpeningHand(next, seat, steps);
}

export function finishMulliganChoice(state: ScenarioState, took: boolean): ScenarioState {
  const seat = state.activeSeat;
  const mulliganSeats = took && !state.mulliganSeats.includes(seat)
    ? [...state.mulliganSeats, seat]
    : state.mulliganSeats;
  const passed = state.passed.includes(seat) ? state.passed : [...state.passed, seat];
  const nextSeat = livingSeats(state).find((index) => !passed.includes(index));
  if (nextSeat == null) {
    return {
      ...withMode(state, "afterOpening"),
      window: null,
      passed: [],
      mulliganSeats,
      mulliganTaken: mulliganSeats.length > 0,
    };
  }
  return {
    ...state,
    passed,
    activeSeat: nextSeat,
    mulliganSeats,
    mulliganTaken: mulliganSeats.includes(nextSeat),
  };
}

function shuffleZone(state: ScenarioState, zone: "encounter" | number): ScenarioState {
  if (zone === "encounter") {
    const shuffled = shuffleIds(state.encounterDeck, state.seed, state.seedCursor);
    return { ...state, encounterDeck: shuffled.ids, seedCursor: shuffled.cursor };
  }
  const seat = state.seats[zone];
  if (!seat) return state;
  const shuffled = shuffleIds(seat.deck, state.seed, state.seedCursor);
  return {
    ...withSeat(state, zone, { ...seat, deck: shuffled.ids }),
    seedCursor: shuffled.cursor,
  };
}
