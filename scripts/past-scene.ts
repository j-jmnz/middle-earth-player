import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EFFECTS } from "../src/effects/index.ts";
import { scenarioDefinitionSchema, type ScenarioDefinition } from "../src/catalog/boundary.ts";
import { fixtureCards, parseScenarioFixture, type ScenarioFixture } from "../src/catalog/scenario-fixture.ts";
import { byCode, expectOk } from "../src/rules/fixture.ts";
import type { EngineStep } from "../src/rules/intents.ts";
import { definePrinted, type PrintedCard } from "../src/rules/printed.ts";
import { reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../src/rules/state.ts";
import { attachTo, spawn } from "../src/rules/zones.ts";

import { loadDefinition, loadPrinted } from "./test-catalog.ts";

// Shared scene for the A Shadow of the Past effect tests, split by timing. Test-only.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const fixture: ScenarioFixture = parseScenarioFixture(
  JSON.parse(readFileSync(path.join(root, "fixtures", "a-shadow-of-the-past.json"), "utf8")) as unknown,
);

export const FRODO = "141001";
export const SAM = "141002";
export const MERRY = "141003";
export const RING = "141085";
export const RIDER = "141039";

export type World = { definition: ScenarioDefinition; cards: Map<string, PrintedCard> };

export async function loadWorld(): Promise<World> {
  const definition = scenarioDefinitionSchema.parse(await loadDefinition("a-shadow-of-the-past"));
  const codes = [...new Set([...fixtureCards(fixture).map((card) => card.code), FRODO, SAM, MERRY, RING])];
  const cards = new Map(await loadPrinted(codes));
  for (const [code, threat] of [["f0", 0], ["f3", 3]] as const) {
    cards.set(code, definePrinted({ code, name: code, type: "enemy", threat, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  }
  return { definition, cards };
}

export type Layout = {
  seats?: 1 | 2;
  stage?: string;
  progress?: number;
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly string[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly { code: string; seat: number }[];
  active?: string;
  ring?: "ready" | "exhausted" | "none";
  resources?: number;
};

export function table(world: World, layout: Layout = {}): { state: ScenarioState; ctx: ReduceContext } {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "141022";
  let state = blankScenario({ seatCount: seats, seed: 3, definition: world.definition });
  for (const code of fixture.stages) {
    const placed =
      code === stage ? { zone: "questStage" as const } : fixture.stages.indexOf(code) > fixture.stages.indexOf(stage) ? { zone: "questDeck" as const } : { zone: "setAside" as const };
    const spawned = spawn(state, code, placed, placed.zone === "questStage" ? "B" : "A");
    state = code === stage ? updateCard(spawned.state, spawned.id, { progress: layout.progress ?? 0 }) : spawned.state;
  }
  const frodo = spawn(state, FRODO, { zone: "heroes", seat: 0 });
  state = spawn(frodo.state, SAM, { zone: "heroes", seat: 0 }).state;
  if (seats === 2) state = spawn(state, MERRY, { zone: "heroes", seat: 1 }).state;
  if ((layout.ring ?? "ready") !== "none") {
    const ring = spawn(state, RING, { zone: "play", seat: 0 });
    state = attachTo(ring.state, ring.id, frodo.id);
    state = updateCard(state, ring.id, { exhausted: layout.ring === "exhausted" });
  }
  state = updateCard(state, frodo.id, { resources: layout.resources ?? 0 });
  state = withThreat(state, 0, 8);
  if (seats === 2) state = withThreat(state, 1, 6);
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }).state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  for (const code of layout.staging ?? []) state = spawn(state, code, { zone: "staging" }).state;
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }).state;
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  for (const row of layout.engaged ?? []) state = spawn(state, row.code, { zone: "engaged", seat: row.seat }).state;
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  state = { ...state, phase: "Quest", boundaryPhase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0 };
  return { state, ctx: { effects: EFFECTS, cards: world.cards } };
}

export type Run = { state: ScenarioState; steps: EngineStep[] };

export function send(run: Run, intent: PlayerIntent, ctx: ReduceContext): Run {
  const result = expectOk(reduce(run.state, intent, ctx));
  return { state: result.state, steps: [...run.steps, ...result.steps] };
}

export function start(state: ScenarioState): Run {
  return { state, steps: [] };
}

// Passes the quest commit step, which moves to staging and reveals.
export function reveal(state: ScenarioState, ctx: ReduceContext, seats = 1): Run {
  let run = start(state);
  for (let seat = 0; seat < seats; seat += 1) run = send(run, { type: "Pass" }, ctx);
  return run;
}

export function frames(steps: readonly EngineStep[]): string[] {
  return steps.flatMap((step) => (step.kind === "push" || step.kind === "pop" ? [`${step.kind}:${step.frame}`] : []));
}

export function codeOf(state: ScenarioState, id: string | null): string {
  return (id ? state.cards[id]?.code : undefined) ?? "";
}

export function codesOf(state: ScenarioState, ids: readonly string[]): string[] {
  return ids.map((id) => codeOf(state, id));
}

export function first(state: ScenarioState, code: string): string {
  return byCode(state, code)[0] ?? "";
}
