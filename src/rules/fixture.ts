import type { ScenarioDefinition } from "../catalog/boundary.ts";

import { definePrinted, type PrintedCard } from "./printed.ts";
import type { ReduceResult } from "./reduce.ts";
import { blankScenario, type ScenarioState } from "./state.ts";

export function fixtureDefinition(stages: readonly string[]): ScenarioDefinition {
  return {
    id: "fixture",
    encounterSets: [],
    stages: stages.map((code) => ({ code })),
    widgets: {
      hide: false,
      lifeTracker: false,
      burdenDeck: false,
      secondActiveLocation: false,
      perSeatStaging: false,
    },
    setup: [],
    resolution: [],
  };
}

export function cardMap(cards: readonly PrintedCard[]): ReadonlyMap<string, PrintedCard> {
  return new Map(cards.map((card) => [card.code, card]));
}

export function hero(code: string, sphere: PrintedCard["sphere"], threat = 8, willpower = 1): PrintedCard {
  return definePrinted({
    code,
    name: code,
    type: "hero",
    sphere,
    threat,
    willpower,
    attack: 1,
    defense: 1,
    health: 5,
  });
}

export function codes(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`);
}

export function expectOk(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(result.reason);
  return result;
}

export function byCode(state: ScenarioState, code: string): string[] {
  return Object.values(state.cards)
    .filter((card) => card.code === code)
    .map((card) => card.id);
}

// A state that no mode step moves, for tests that fire an event or a boundary directly.
export function idleScenario(seatCount: 1 | 2, phase: ScenarioState["phase"] = "Quest"): ScenarioState {
  const blank = blankScenario({ seatCount, seed: 3, definition: fixtureDefinition(["stage"]) });
  return { ...blank, mode: "stopped", phase, boundaryPhase: phase };
}
