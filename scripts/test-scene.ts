import type { ScenarioDefinition } from "../src/catalog/boundary.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { expectOk } from "../src/rules/fixture.ts";
import type { EngineStep } from "../src/rules/intents.ts";
import { definePrinted, type PrintedCard } from "../src/rules/printed.ts";
import { reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../src/rules/state.ts";
import { attachTo, spawn } from "../src/rules/zones.ts";

import { loadDefinition, loadPrinted } from "./test-catalog.ts";

// Test helper. Builds small tables out of real catalog cards and the authored effect records.

export const FRODO = "141001";
export const SAM = "141002";
export const MERRY = "141003";
export const RING = "141085";
export const RIDER = "141039";

type Placed = { code: string; seat: number };

export type Scene = {
  seats?: 1 | 2;
  // Which step the scene opens on. Quest: the commit pass. Travel: the travel window.
  start?: "quest" | "travel" | "planning" | "encounter";
  stage?: string;
  progress?: number;
  heroes?: readonly Placed[];
  allies?: readonly Placed[];
  deck?: readonly string[];
  hand?: readonly Placed[];
  discard?: readonly string[];
  staging?: readonly string[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly Placed[];
  active?: string;
  ring?: "ready" | "exhausted" | "none";
  // Cards attached to a hero, by code, in order of the heroes list.
  attached?: readonly { code: string; host: string }[];
  playerDeck?: readonly Placed[];
  resources?: number;
  effects?: ReduceContext["effects"];
};

export type Table = { state: ScenarioState; ctx: ReduceContext; ids: Record<string, string[]> };
export type Run = { state: ScenarioState; steps: EngineStep[] };

let loaded: { definition: ScenarioDefinition; cards: Map<string, PrintedCard> } | null = null;

const EXTRA = ["141017", "141022", "141023", "141024", "141031", "141032", "141033", "141034", "141035", "141036", "141037", "141038", "141039", "141040", "141041", "141042", "141043", "141072", "141073", "141074", "141075", "141076", "141077", "141078", "141079", FRODO, SAM, MERRY, RING];

export async function sceneCards(): Promise<{ definition: ScenarioDefinition; cards: Map<string, PrintedCard> }> {
  if (loaded) return loaded;
  const definition = await loadDefinition("a-shadow-of-the-past");
  const cards = new Map(await loadPrinted(EXTRA));
  for (const [code, threat] of [["f0", 0], ["f3", 3]] as const) {
    cards.set(code, definePrinted({ code, name: code, type: "enemy", threat, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  }
  cards.set("ally", definePrinted({ code: "ally", name: "Ally", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set("pal", definePrinted({ code: "pal", name: "Pal", type: "hero", sphere: "leadership", threat: 6, willpower: 1, attack: 1, defense: 1, health: 3, traits: ["Hobbit"] }));
  cards.set("plain", definePrinted({ code: "plain", name: "Plain", type: "attachment", cost: 0 }));
  cards.set("card", definePrinted({ code: "card", name: "Card", type: "event", cost: 0 }));
  loaded = { definition, cards };
  return loaded;
}

export function buildTable(base: { definition: ScenarioDefinition; cards: Map<string, PrintedCard> }, scene: Scene = {}): Table {
  const seats = scene.seats ?? 1;
  const stageCodes = base.definition.stages.map((stage) => stage.code);
  const stage = scene.stage ?? stageCodes[0] ?? "";
  const ids: Record<string, string[]> = {};
  let state = blankScenario({ seatCount: seats, seed: 3, definition: base.definition });
  const put = (code: string, dest: Parameters<typeof spawn>[2], face?: Parameters<typeof spawn>[3]): string => {
    const spawned = spawn(state, code, dest, face);
    state = spawned.state;
    (ids[code] ??= []).push(spawned.id);
    return spawned.id;
  };
  for (const code of stageCodes) {
    const index = stageCodes.indexOf(code);
    const at = stageCodes.indexOf(stage);
    const id = put(code, code === stage ? { zone: "questStage" } : index > at ? { zone: "questDeck" } : { zone: "setAside" }, code === stage ? "B" : "A");
    if (code === stage) state = updateCard(state, id, { progress: scene.progress ?? 0 });
  }
  const heroes = scene.heroes ?? [{ code: FRODO, seat: 0 }, { code: SAM, seat: 0 }, ...(seats === 2 ? [{ code: MERRY, seat: 1 }] : [])];
  for (const hero of heroes) put(hero.code, { zone: "heroes", seat: hero.seat });
  if ((scene.ring ?? "ready") !== "none") {
    const frodo = ids[FRODO]?.[0];
    const ring = put(RING, { zone: "play", seat: 0 });
    if (frodo) state = attachTo(state, ring, frodo);
    state = updateCard(state, ring, { exhausted: scene.ring === "exhausted" });
  }
  for (const attached of scene.attached ?? []) {
    const host = ids[attached.host]?.[0];
    const id = put(attached.code, { zone: "play", seat: 0 });
    if (host) state = attachTo(state, id, host);
  }
  for (const ally of scene.allies ?? []) put(ally.code, { zone: "play", seat: ally.seat });
  for (const card of scene.hand ?? []) put(card.code, { zone: "hand", seat: card.seat });
  for (const card of scene.playerDeck ?? []) put(card.code, { zone: "deck", seat: card.seat });
  for (const code of scene.deck ?? []) put(code, { zone: "encounterDeck" });
  for (const code of scene.discard ?? []) put(code, { zone: "encounterDiscard" });
  for (const code of scene.staging ?? []) put(code, { zone: "staging" });
  for (const code of scene.setAside ?? []) put(code, { zone: "setAside" });
  for (const code of scene.victory ?? []) put(code, { zone: "victory" });
  for (const row of scene.engaged ?? []) put(row.code, { zone: "engaged", seat: row.seat });
  if (scene.active) put(scene.active, { zone: "activeLocation" });
  const first = ids[heroes[0]?.code ?? FRODO]?.[0];
  if (first) state = updateCard(state, first, { resources: scene.resources ?? 0 });
  state = withThreat(state, 0, 8);
  if (seats === 2) state = withThreat(state, 1, 6);
  const open = {
    quest: { phase: "Quest", mode: "questCommit", window: { kind: "pass" } },
    planning: { phase: "Planning", mode: "planning", window: { kind: "pass" } },
    travel: { phase: "Travel", mode: "travel", window: { kind: "travel" } },
    encounter: { phase: "Encounter", mode: "optionalEngage", window: { kind: "optionalEngage" } },
  } as const;
  const at = open[scene.start ?? "quest"];
  state = { ...state, phase: at.phase, boundaryPhase: at.phase, mode: at.mode, window: at.window, activeSeat: 0 };
  return { state, ctx: { effects: scene.effects ?? EFFECTS, cards: base.cards }, ids };
}

export function begin(state: ScenarioState): Run {
  return { state, steps: [] };
}

export function send(run: Run, intent: PlayerIntent, ctx: ReduceContext): Run {
  const result = expectOk(reduce(run.state, intent, ctx));
  return { state: result.state, steps: [...run.steps, ...result.steps] };
}

export function idsOf(table: Table, code: string): string {
  return table.ids[code]?.[0] ?? "";
}

export function frameNames(steps: readonly EngineStep[]): string[] {
  return steps.flatMap((step) => (step.kind === "push" || step.kind === "pop" ? [`${step.kind}:${step.frame}`] : []));
}
