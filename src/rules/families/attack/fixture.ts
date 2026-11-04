// A compact table for the attack family's tests: heroes and enemies with plain numbers, effect records made inline.
import type { Effect } from "../../../catalog/boundary.ts";
import { cardMap, fixtureDefinition } from "../../core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../../core/printed.ts";
import { blankScenario, withThreat, type ScenarioState } from "../../core/state.ts";
import { spawn, type Destination } from "../../core/zones.ts";

export function fighter(code: string, patch: Partial<Parameters<typeof definePrinted>[0]> = {}): PrintedCard {
  return definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 10, willpower: 1, attack: 2, defense: 1, health: 5, ...patch });
}

export function foe(code: string, patch: Partial<Parameters<typeof definePrinted>[0]> = {}): PrintedCard {
  return definePrinted({ code, name: code, type: "enemy", attack: 1, defense: 1, health: 9, engagementCost: 30, threat: 1, ...patch });
}

export function record(id: string, code: string, timing: Effect["timing"], instructions: Effect["instructions"], extra: Partial<Effect> = {}): Effect {
  return { id, cardCode: code, lines: [`${code}:A:1`], timing, instructions, ...extra };
}

const BASE = [
  fighter("aragorn"),
  fighter("archer", { keywords: { ranged: true } }),
  fighter("gimli", { attack: 3 }),
  foe("orc", { traits: ["Orc"] }),
  foe("troll", { traits: ["Troll"], health: 4, defense: 0 }),
  foe("goblin", { traits: ["Orc", "Goblin"], health: 2, defense: 0 }),
  definePrinted({ code: "event", name: "event", type: "event", sphere: "tactics", cost: 0 }),
  definePrinted({ code: "gear", name: "gear", type: "attachment", sphere: "tactics", cost: 0, traits: ["Weapon"] }),
];

export type Table = { state: ScenarioState; ids: Record<string, string>; ctx: { effects: readonly Effect[]; cards: ReadonlyMap<string, PrintedCard> } };

// Cards spawned in order, named by `as` (or their code). The state is in the combat phase's player attack window for seat 0.
export function table(rows: readonly { code: string; at: Destination; as?: string }[], effects: readonly Effect[] = [], extra: readonly PrintedCard[] = [], seatCount: 1 | 2 = 1): Table {
  let state = blankScenario({ seatCount, seed: 4, definition: fixtureDefinition(["stage"]) });
  const ids: Record<string, string> = {};
  for (const row of rows) {
    const spawned = spawn(state, row.code, row.at);
    state = spawned.state;
    ids[row.as ?? row.code] = spawned.id;
  }
  state = withThreat(state, 0, 20);
  if (seatCount === 2) state = withThreat(state, 1, 20);
  state = { ...state, phase: "Combat", boundaryPhase: "Combat", mode: "playerAttacks", window: { kind: "playerAttack" }, activeSeat: 0, passed: [] };
  return { state, ids, ctx: { effects, cards: cardMap([...BASE, ...extra]) } };
}

// The same table in an action window of the combat phase (a pass window nobody has passed yet).
export function actionWindow(state: ScenarioState): ScenarioState {
  return { ...state, mode: "combatActions", window: { kind: "pass" }, passed: [] };
}
