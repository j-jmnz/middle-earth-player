import { EFFECTS } from "../src/effects/index.ts";
import { syncConstants } from "../src/rules/constants.ts";
import { pushCardEffects } from "../src/rules/effect-frames.ts";
import { expectOk } from "../src/rules/fixture.ts";
import type { EngineStep } from "../src/rules/intents.ts";
import { settle } from "../src/rules/machine.ts";
import { reduce } from "../src/rules/reduce.ts";
import type { Effect, ScenarioDefinition } from "../src/catalog/boundary.ts";
import { scenarioCards, scenarioDefinition, type CampaignData, type ScenarioData } from "../src/catalog/scenario-data.ts";
import { definePrinted, type PrintedCard } from "../src/rules/printed.ts";
import type { ReduceContext, ScenarioState } from "../src/rules/reduce.ts";
import { blankScenario, updateCard, withSeat, withThreat } from "../src/rules/state.ts";
import { attachTo, spawn } from "../src/rules/zones.ts";

import { loadCampaign, loadScenario } from "./data/load-scenarios.ts";
import { FRODO, MERRY, RING, SAM } from "./past-scene.ts";
import { loadPrinted } from "./test-catalog.ts";

// Shared scene for the Breaking of the Fellowship tests (separate staging, stages 1 and 2). Test-only.
export const breaking: ScenarioData = loadScenario("breaking-of-the-fellowship");
export const campaign: CampaignData = loadCampaign();

export const GREAT_RIVER = "142061";
export const DIVIDED = "142062";
export const STAGES_3A = ["142063", "142064", "142065", "142066"] as const;
export const ARGONATH = "142075";
export const SARN_GEBIR = "142076";
export const SEAT_OF_SEEING = "142074";
export const PARTH_GALEN = "142073";
export const FRODOS_CHOICE = "142068";

export type BreakingWorld = { definition: ScenarioDefinition; cards: Map<string, PrintedCard> };

export async function loadBreakingWorld(): Promise<BreakingWorld> {
  const definition = scenarioDefinition(breaking, campaign, EFFECTS);
  const codes = [...new Set([...scenarioCards(breaking).map((card) => card.code), ...breaking.campaignPlaced, breaking.campaignCard, FRODO, SAM, MERRY, RING, "141057"])];
  const cards = new Map(await loadPrinted(codes));
  cards.set("grunt", definePrinted({ code: "grunt", name: "grunt", type: "enemy", threat: 2, engagementCost: 10, attack: 1, defense: 1, health: 20 }));
  cards.set("brute", definePrinted({ code: "brute", name: "brute", type: "enemy", threat: 3, engagementCost: 40, attack: 1, defense: 1, health: 20 }));
  cards.set("scout", definePrinted({ code: "scout", name: "scout", type: "enemy", threat: 1, engagementCost: 20, attack: 1, defense: 1, health: 20 }));
  cards.set("archer", definePrinted({ code: "archer", name: "archer", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 1, health: 5, keywords: { archery: 2 } }));
  cards.set("strong", definePrinted({ code: "strong", name: "strong", type: "hero", sphere: "tactics", threat: 8, willpower: 6, attack: 4, defense: 3, health: 20 }));
  cards.set("weak", definePrinted({ code: "weak", name: "weak", type: "hero", sphere: "tactics", threat: 8, willpower: 1, attack: 1, defense: 1, health: 20 }));
  cards.set("place", definePrinted({ code: "place", name: "place", type: "location", threat: 1, questPoints: 4 }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  cards.set("mist", definePrinted({ code: "mist", name: "mist", type: "treachery" }));
  return { definition, cards };
}

export type BreakingLayout = {
  seats?: 1 | 2;
  // 1: stage 1 (The Great River) is current. 2: stage 2 is current (side B). "separate": each seat is on its own stage 3, `stages` names them.
  stage?: 1 | 2 | "separate";
  stages?: readonly string[];
  progress?: number;
  // The shared staging area, the encounter deck and its discard pile (top first), and the cards set aside.
  staging?: readonly string[];
  deck?: readonly string[];
  discard?: readonly string[];
  setAside?: readonly string[];
  // The cards in each seat's own staging area (separate stages).
  areas?: readonly (readonly string[])[];
  // Each seat's own active location (separate stages), a location code, the stage's progress goes on it first.
  active?: readonly (string | null)[];
  // Enemies engaged with a seat.
  engaged?: readonly { code: string; seat: number }[];
  // The Ring (on Frodo), and Frodo himself: `frodo: false` leaves him out, as stage 2A did (separate stages).
  ring?: boolean;
  frodo?: boolean;
  // Heroes of each seat besides the Ring-bearer (Sam in seat 0, Merry in seat 1 by default).
  heroes?: readonly (readonly string[])[];
  threats?: readonly number[];
  phase?: "Quest" | "Encounter" | "Combat" | "Travel" | "Refresh" | "Planning";
};

export type BreakingTable = { state: ScenarioState; ctx: ReduceContext; frodo: string; ring: string | null; sam: string; heroes: readonly (readonly string[])[] };

// A table at the stage with Frodo (the Ring-bearer, with The One Ring) and Sam in seat 0, and Merry in seat 1 when two play.
export function breakingTable(world: BreakingWorld, layout: BreakingLayout = {}): BreakingTable {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? 1;
  let state = blankScenario({ seatCount: seats, seed: 3, definition: world.definition });
  const quest = [GREAT_RIVER, DIVIDED, ...STAGES_3A, "142067"];
  for (const code of quest) {
    const index = quest.indexOf(code);
    const where = stage === "separate" ? (index < 2 ? "setAside" : "questDeck") : index + 1 < stage ? "setAside" : index + 1 === stage ? "questStage" : "questDeck";
    const spawned = spawn(state, code, { zone: where }, where === "questStage" ? "B" : "A");
    state = where === "questStage" ? updateCard(spawned.state, spawned.id, { progress: layout.progress ?? 0 }) : spawned.state;
  }
  const frodo = layout.frodo === false ? { state, id: "" } : spawn(state, FRODO, { zone: "heroes", seat: 0 });
  state = frodo.state;
  const heroes: string[][] = [[], []];
  const names = layout.heroes ?? [[SAM], seats === 2 ? [MERRY] : []];
  for (let seat = 0; seat < seats; seat += 1) {
    for (const code of names[seat] ?? []) {
      const made = spawn(state, code, { zone: "heroes", seat });
      state = made.state;
      heroes[seat]?.push(made.id);
    }
  }
  let ring: string | null = null;
  if (layout.ring !== false && layout.frodo !== false) {
    const placed = spawn(state, RING, { zone: "play", seat: 0 });
    ring = placed.id;
    state = attachTo(placed.state, placed.id, frodo.id);
  }
  for (let seat = 0; seat < seats; seat += 1) for (let at = 0; at < 6; at += 1) state = spawn(state, "filler", { zone: "deck", seat }).state;
  const threats = layout.threats ?? [8, 6];
  for (let seat = 0; seat < seats; seat += 1) state = withThreat(state, seat, threats[seat] ?? 8);
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  for (const code of layout.staging ?? []) state = spawn(state, code, { zone: "staging" }).state;
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }).state;
  for (const row of layout.engaged ?? []) state = spawn(state, row.code, { zone: "engaged", seat: row.seat }).state;
  if (stage === "separate") {
    state = { ...state, separate: true };
    const codes = layout.stages ?? [STAGES_3A[0], STAGES_3A[1]];
    for (let seat = 0; seat < seats; seat += 1) {
      const id = state.questDeck.find((candidate) => state.cards[candidate]?.code === codes[seat]);
      if (!id) continue;
      state = updateCard({ ...state, questDeck: state.questDeck.filter((other) => other !== id) }, id, { zone: "questStage", face: "B", controller: seat, progress: seat === 0 ? (layout.progress ?? 0) : 0 });
      const owner = state.seats[seat];
      if (owner) state = withSeat(state, seat, { ...owner, stage: id });
    }
    for (let seat = 0; seat < seats; seat += 1) {
      for (const code of layout.areas?.[seat] ?? []) state = spawn(state, code, { zone: "staging", area: seat }, "up").state;
      const active = layout.active?.[seat];
      if (active) {
        // The seat's own active location, mirrored into the shared slots (families/breaking/areas.ts).
        const made = spawn(state, active, { zone: "activeLocation" }, "up");
        const owner = made.state.seats[seat];
        state = owner ? withSeat({ ...made.state, activeLocation: seat === 0 ? made.id : state.activeLocation, secondActiveLocation: seat === 1 ? made.id : state.secondActiveLocation }, seat, { ...owner, active: made.id }) : made.state;
      }
    }
  }
  const phase = layout.phase ?? "Quest";
  const mode = phase === "Quest" ? "questCommit" : phase === "Encounter" ? "optionalEngage" : phase === "Travel" ? "travel" : phase === "Planning" ? "planning" : phase === "Refresh" ? "refresh" : "combatStart";
  state = { ...state, phase, boundaryPhase: phase, mode, window: phase === "Encounter" ? { kind: "optionalEngage" } : phase === "Travel" ? { kind: "travel" } : phase === "Quest" || phase === "Planning" ? { kind: "pass" } : null, activeSeat: 0 };
  return { state, ctx: { effects: EFFECTS, cards: world.cards }, frodo: frodo.id, ring, sam: heroes[0]?.[0] ?? "", heroes };
}

export function makeBreaking(world: BreakingWorld, layout: BreakingLayout = {}): BreakingTable {
  const made = breakingTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

export function recordOf(id: string): Effect {
  const found = EFFECTS.find((effect) => effect.id === id);
  if (!found) throw new Error(`No record ${id}`);
  return found;
}

export function settled(table: BreakingTable, state: ScenarioState, steps: EngineStep[] = []): ScenarioState {
  return settle(syncConstants(state, table.ctx), table.ctx, steps);
}

// Resolves the record as the card's effect; a choice it opens is answered with `answers` (the first option once they run out).
export function fire(table: BreakingTable, state: ScenarioState, cardId: string, effectId: string, answers: readonly string[] = [], frame: "whenRevealed" | "forced" = "whenRevealed", seat = 0, steps: EngineStep[] = []): ScenarioState {
  let current = settled(table, pushCardEffects({ ...state, window: null }, frame, cardId, seat, false, [recordOf(effectId)], table.ctx, steps), steps);
  for (let at = 0; current.window?.kind === "choose" && at < 30; at += 1) {
    const option = answers[at] ?? current.window.options[0] ?? "";
    current = settled(table, expectOk(reduce(current, { type: "Choose", optionId: option }, table.ctx)).state, steps);
  }
  return current;
}

export function ids(state: ScenarioState, code: string): string[] {
  return Object.values(state.cards).filter((card) => card.code === code).map((card) => card.id);
}

export function codes(state: ScenarioState, list: readonly string[]): string[] {
  return list.map((id) => state.cards[id]?.code ?? "");
}
