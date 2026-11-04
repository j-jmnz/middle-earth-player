import { EFFECTS } from "../../../src/effects/index.ts";
import type { Effect, ScenarioDefinition } from "../../../src/catalog/boundary.ts";
import { scenarioCards, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { FRODO, MERRY, RING, SAM } from "../a-shadow-of-the-past/scene.ts";
import { loadPrinted } from "../../harness/catalog.ts";

// Shared scene for the Flight to the Ford effect tests. Test-only.
export const ford: ScenarioData = loadScenario("flight-to-the-ford");
export const campaign: CampaignData = loadCampaign();

export const WOUND = "141057";
export const LAST_BRIDGE = "141058";
export const FORD_OF_BRUINEN = "141059";
export const WITCH_KING = "141068";
export const FELL_RIDER = "141063";
export const CAMPAIGN_CARD = "141056";
export const BURDENS = ["141080", "141081", "141082", "141083", "141084"] as const;

// The filler event has an Action that does nothing, so it can be played: an event with no record at all cannot (rr.triggered-ability).
const FORD_EFFECTS: readonly Effect[] = [...EFFECTS, { id: "filler:action:1", cardCode: "filler", lines: ["filler:A:1"], timing: "action", instructions: [] }];

export type FordWorld = { definition: ScenarioDefinition; cards: Map<string, PrintedCard> };

export async function loadFordWorld(): Promise<FordWorld> {
  const definition = scenarioDefinition(ford, campaign, EFFECTS);
  const codes = [...new Set([...scenarioCards(ford).map((card) => card.code), CAMPAIGN_CARD, FRODO, SAM, MERRY, RING])];
  const cards = new Map(await loadPrinted(codes));
  // Plain enemies and a hero that do nothing, to make a table with.
  for (const [code, threat] of [["f0", 0], ["f3", 3]] as const) {
    cards.set(code, definePrinted({ code, name: code, type: "enemy", threat, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  }
  cards.set("brute", definePrinted({ code: "brute", name: "brute", type: "enemy", threat: 1, engagementCost: 10, attack: 9, defense: 1, health: 20 }));
  cards.set("grunt", definePrinted({ code: "grunt", name: "grunt", type: "enemy", threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 20 }));
  cards.set("strong", definePrinted({ code: "strong", name: "strong", type: "hero", sphere: "tactics", threat: 8, willpower: 6, attack: 4, defense: 3, health: 20 }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  cards.set("ally", definePrinted({ code: "ally", name: "ally", type: "ally", sphere: "neutral", cost: 0, willpower: 1, attack: 1, defense: 1, health: 2, keywords: { sentinel: true } }));
  return { definition, cards };
}

export type FordLayout = {
  seats?: 1 | 2;
  stage?: "141028" | "141029";
  progress?: number;
  // The encounter deck, the encounter discard pile, the staging area, the cards set aside, the victory display: top first.
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly string[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly { code: string; seat: number }[];
  active?: string;
  // The burden deck, top first. The five burdens when absent; pass [] for an empty one.
  burden?: readonly string[];
  life?: number;
  // The Ring and the wound: attached to Frodo unless "none".
  ring?: "ready" | "exhausted" | "none";
  wound?: boolean;
  // Weight of the Ring (141080) attached to Frodo.
  weight?: boolean;
  // The campaign card is in the game (Campaign Mode).
  campaign?: boolean;
  resources?: number;
  // Cards in the first seat's hand, and extra allies in its play area.
  hand?: readonly string[];
  allies?: readonly string[];
  phase?: "Quest" | "Encounter" | "Combat";
};

export function fordTable(world: FordWorld, layout: FordLayout = {}): { state: ScenarioState; ctx: ReduceContext; frodo: string } {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "141028";
  let state = blankScenario({ seatCount: seats, seed: 3, definition: world.definition });
  for (const code of ford.stages) {
    const placed =
      code === stage ? { zone: "questStage" as const } : ford.stages.indexOf(code) > ford.stages.indexOf(stage) ? { zone: "questDeck" as const } : { zone: "setAside" as const };
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
  if (layout.wound !== false) {
    const wound = spawn(state, WOUND, { zone: "attached" });
    state = attachTo(wound.state, wound.id, frodo.id);
  }
  if (layout.weight) {
    const weight = spawn(state, "141080", { zone: "attached" });
    state = attachTo(weight.state, weight.id, frodo.id);
  }
  state = updateCard(state, frodo.id, { resources: layout.resources ?? 0 });
  state = withThreat(state, 0, 8);
  if (seats === 2) state = withThreat(state, 1, 6);
  for (const code of layout.hand ?? []) state = spawn(state, code, { zone: "hand", seat: 0 }).state;
  for (const code of layout.allies ?? []) state = spawn(state, code, { zone: "play", seat: 0 }).state;
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  for (const code of layout.staging ?? []) state = spawn(state, code, { zone: "staging" }).state;
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }).state;
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  for (const row of layout.engaged ?? []) state = spawn(state, row.code, { zone: "engaged", seat: row.seat }).state;
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  for (const code of layout.burden ?? BURDENS) state = spawn(state, code, { zone: "burdenDeck" }, "down").state;
  if (layout.campaign) state = spawn(state, CAMPAIGN_CARD, { zone: "campaign" }).state;
  state = { ...state, life: layout.life ?? 15 };
  const phase = layout.phase ?? "Quest";
  const mode = phase === "Quest" ? "questCommit" : phase === "Encounter" ? "optionalEngage" : "combatActions";
  state = { ...state, phase, boundaryPhase: phase, mode, window: phase === "Encounter" ? { kind: "optionalEngage" } : { kind: "pass" }, activeSeat: 0 };
  return { state, ctx: { effects: FORD_EFFECTS, cards: world.cards }, frodo: frodo.id };
}
