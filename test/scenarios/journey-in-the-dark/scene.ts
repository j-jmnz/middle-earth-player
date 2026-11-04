import { EFFECTS } from "../../../src/effects/index.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { pushCardEffects } from "../../../src/rules/interpret/effect-frames.ts";
import { expectOk } from "../../../src/rules/core/test-fixture.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { runInstruction } from "../../../src/rules/interpret/interpret.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import { reduce } from "../../../src/rules/engine/reduce.ts";
import type { Effect, Instruction, ScenarioDefinition } from "../../../src/catalog/boundary.ts";
import { scenarioCards, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { FRODO, MERRY, RING, SAM } from "../a-shadow-of-the-past/scene.ts";
import { loadPrinted } from "../../harness/catalog.ts";

// Shared scene for Journey in the Dark effect tests. Test-only.
export const moria: ScenarioData = loadScenario("journey-in-the-dark");
export const campaign: CampaignData = loadCampaign();

export const DOOM = "142043";
export const BALROG = "142044";
export const BRIDGE = "142050";
export const CHAMBER = "142051";
export const CHIEFTAIN = "142045";
export const STAGES = ["142040", "142041", "142042"] as const;
export const WOUND = "142088";
export const GRIEF = "142087";

export type MoriaWorld = { definition: ScenarioDefinition; cards: Map<string, PrintedCard> };

export async function loadMoriaWorld(): Promise<MoriaWorld> {
  const definition = scenarioDefinition(moria, campaign, EFFECTS);
  const codes = [...new Set([...scenarioCards(moria).map((card) => card.code), ...moria.campaignPlaced, moria.campaignCard, FRODO, SAM, MERRY, RING, "141057"])];
  const cards = new Map(await loadPrinted(codes));
  for (const [code, threat] of [["f0", 0], ["f3", 3]] as const) {
    cards.set(code, definePrinted({ code, name: code, type: "enemy", threat, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  }
  cards.set("grunt", definePrinted({ code: "grunt", name: "grunt", type: "enemy", threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 20 }));
  cards.set("warg", definePrinted({ code: "warg", name: "warg", type: "enemy", traits: ["Creature", "Warg"], threat: 2, engagementCost: 33, attack: 3, defense: 1, health: 4 }));
  cards.set("orc", definePrinted({ code: "orc", name: "orc", type: "enemy", traits: ["Creature", "Orc"], threat: 1, engagementCost: 20, attack: 2, defense: 1, health: 3 }));
  cards.set("warg2", definePrinted({ code: "warg2", name: "warg2", type: "enemy", traits: ["Creature", "Warg"], threat: 2, engagementCost: 20, attack: 3, defense: 1, health: 4 }));
  cards.set("strong", definePrinted({ code: "strong", name: "strong", type: "hero", sphere: "tactics", threat: 8, willpower: 6, attack: 4, defense: 3, health: 20 }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  cards.set("ally", definePrinted({ code: "ally", name: "ally", type: "ally", sphere: "neutral", cost: 0, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set("gear", definePrinted({ code: "gear", name: "gear", type: "attachment", sphere: "tactics", cost: 0 }));
  cards.set("gear2", definePrinted({ code: "gear2", name: "gear2", type: "attachment", sphere: "tactics", cost: 0 }));
  cards.set("big", definePrinted({ code: "big", name: "big", type: "enemy", threat: 9, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  cards.set("place", definePrinted({ code: "place", name: "place", type: "location", threat: 1, questPoints: 4 }));
  cards.set("place2", definePrinted({ code: "place2", name: "place2", type: "location", threat: 1, questPoints: 4 }));
  return { definition, cards };
}

export type MoriaLayout = {
  seats?: 1 | 2;
  stage?: (typeof STAGES)[number];
  progress?: number;
  // The encounter deck, the discard pile, the staging area, the cards set aside, the victory display: top first.
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly string[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly { code: string; seat: number }[];
  active?: string;
  // Damage tokens on Doom, Doom, Doom, which then is in the staging area; resource tokens on the quest stage.
  doom?: number;
  tokens?: number;
  // The first seat's threat (8 by default).
  threat?: number;
  ring?: boolean;
  // Attachments the first seat controls, on Sam.
  onSam?: readonly string[];
  // More heroes for the first seat.
  heroes?: readonly string[];
  hand?: readonly string[];
  allies?: readonly string[];
  // Cards on the top of the first seat's deck, and of the second seat's.
  deckTop?: readonly string[];
  deckTopTwo?: readonly string[];
  phase?: "Quest" | "Encounter" | "Combat" | "Travel" | "Planning";
};

// A table at the stage with Frodo (the Ring-bearer, with The One Ring) and Sam in seat 0, and Merry in seat 1 when two play.
export function moriaTable(world: MoriaWorld, layout: MoriaLayout = {}): { state: ScenarioState; ctx: ReduceContext; frodo: string; sam: string; merry: string | null } {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "142040";
  let state = blankScenario({ seatCount: seats, seed: 3, definition: world.definition });
  for (const code of STAGES) {
    const placed =
      code === stage ? { zone: "questStage" as const } : STAGES.indexOf(code) > STAGES.indexOf(stage) ? { zone: "questDeck" as const } : { zone: "setAside" as const };
    const spawned = spawn(state, code, placed, placed.zone === "questStage" ? "B" : "A");
    state = code === stage ? updateCard(spawned.state, spawned.id, { progress: layout.progress ?? 0 }) : spawned.state;
  }
  const frodo = spawn(state, FRODO, { zone: "heroes", seat: 0 });
  const sam = spawn(frodo.state, SAM, { zone: "heroes", seat: 0 });
  state = sam.state;
  for (const code of layout.heroes ?? []) state = spawn(state, code, { zone: "heroes", seat: 0 }).state;
  let merry: string | null = null;
  if (seats === 2) {
    const placed = spawn(state, MERRY, { zone: "heroes", seat: 1 });
    state = placed.state;
    merry = placed.id;
  }
  if (layout.ring !== false) {
    const ring = spawn(state, RING, { zone: "play", seat: 0 });
    state = attachTo(ring.state, ring.id, frodo.id);
  }
  for (const code of layout.onSam ?? []) {
    const placed = spawn(state, code, { zone: "play", seat: 0 });
    state = attachTo(placed.state, placed.id, sam.id);
  }
  const wound = spawn(state, "141057", { zone: "attached" });
  state = attachTo(wound.state, wound.id, frodo.id);
  state = withThreat(state, 0, layout.threat ?? 8);
  if (seats === 2) state = withThreat(state, 1, 6);
  for (const code of layout.hand ?? []) state = spawn(state, code, { zone: "hand", seat: 0 }).state;
  for (const code of layout.allies ?? []) state = spawn(state, code, { zone: "play", seat: 0 }).state;
  for (const code of layout.deckTop ?? []) state = spawn(state, code, { zone: "deck", seat: 0 }).state;
  for (const code of layout.deckTopTwo ?? []) state = spawn(state, code, { zone: "deck", seat: 1 }).state;
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  for (const code of layout.staging ?? []) state = spawn(state, code, { zone: "staging" }).state;
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }).state;
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  for (const row of layout.engaged ?? []) state = spawn(state, row.code, { zone: "engaged", seat: row.seat }).state;
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  if (layout.doom != null) {
    const placed = spawn(state, DOOM, { zone: "staging" });
    state = updateCard(placed.state, placed.id, { damage: layout.doom });
  }
  if (layout.tokens != null) state = updateCard(state, state.questStage ?? "", { resources: layout.tokens });
  const phase = layout.phase ?? "Quest";
  const mode = phase === "Quest" ? "questCommit" : phase === "Encounter" ? "optionalEngage" : phase === "Travel" ? "travel" : phase === "Planning" ? "planning" : "combatActions";
  state = { ...state, phase, boundaryPhase: phase, mode, window: phase === "Encounter" ? { kind: "optionalEngage" } : phase === "Travel" ? { kind: "travel" } : { kind: "pass" }, activeSeat: 0 };
  return { state, ctx: { effects: EFFECTS, cards: world.cards }, frodo: frodo.id, sam: sam.id, merry };
}

// What the Journey in the Dark tests share. Test-only.
export type MoriaTable = ReturnType<typeof moriaTable>;

export function makeTable(world: MoriaWorld, layout: MoriaLayout = {}): MoriaTable {
  const made = moriaTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

export function recordOf(id: string): Effect {
  const found = EFFECTS.find((effect) => effect.id === id);
  if (!found) throw new Error(`No record ${id}`);
  return found;
}

export function settled(table: MoriaTable, state: ScenarioState, steps: EngineStep[] = []): ScenarioState {
  return settle(syncConstants(state, table.ctx), table.ctx, steps);
}

export function runOne(table: MoriaTable, state: ScenarioState, instruction: Instruction, sourceId: string | null, steps: EngineStep[] = []): ScenarioState {
  return settled(table, runInstruction({ ...state, window: null }, instruction, { seat: 0, sourceId }, table.ctx, steps), steps);
}

// Resolves the record as the card's effect; a choice it opens is answered with `answers` (the first option once they run out).
export function fire(table: MoriaTable, state: ScenarioState, cardId: string, effectId: string, answers: readonly string[] = [], frame: "whenRevealed" | "forced" | "shadow" = "whenRevealed", seat = 0): ScenarioState {
  const steps: EngineStep[] = [];
  let current = settled(table, pushCardEffects({ ...state, window: null }, frame, cardId, seat, false, [recordOf(effectId)], table.ctx, steps), steps);
  for (let at = 0; current.window?.kind === "choose" && at < 30; at += 1) {
    const option = answers[at] ?? current.window.options[0] ?? "";
    current = settled(table, expectOk(reduce(current, { type: "Choose", optionId: option }, table.ctx)).state);
  }
  return current;
}

export function ids(state: ScenarioState, code: string): string[] {
  return Object.values(state.cards).filter((card) => card.code === code).map((card) => card.id);
}
