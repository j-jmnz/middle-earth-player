import { EFFECTS } from "../src/effects/index.ts";
import type { ScenarioDefinition } from "../src/catalog/boundary.ts";
import { scenarioCards, scenarioDefinition, type CampaignData, type ScenarioData } from "../src/catalog/scenario-data.ts";
import { definePrinted, type PrintedCard } from "../src/rules/printed.ts";
import type { ReduceContext, ScenarioState } from "../src/rules/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../src/rules/state.ts";
import { captureRingBearer } from "../src/rules/families/south-captive.ts";
import { attachTo, spawn } from "../src/rules/zones.ts";

import { loadCampaign, loadScenario } from "./data/load-scenarios.ts";
import { FRODO, MERRY, RING, SAM } from "./past-scene.ts";
import { loadPrinted } from "./test-catalog.ts";

// Shared scene for The Ring Goes South effect tests. Test-only.
export const south: ScenarioData = loadScenario("the-ring-goes-south");
export const campaign: CampaignData = loadCampaign();

export const LUST = "142084";
export const REDHORN_PASS = "142029";
export const DOORS = "142030";
export const WATCHER = "142024";
export const GREAT_WARG_CHIEF = "142025";
export const STAGES = ["142020", "142021", "142022", "142023"] as const;
export const STING = "142011";

export type SouthWorld = { definition: ScenarioDefinition; cards: Map<string, PrintedCard> };

export async function loadSouthWorld(): Promise<SouthWorld> {
  const definition = scenarioDefinition(south, campaign, EFFECTS);
  const codes = [...new Set([...scenarioCards(south).map((card) => card.code), ...south.campaignPlaced, south.campaignCard, FRODO, SAM, MERRY, RING, "141057"])];
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
  cards.set("place", definePrinted({ code: "place", name: "place", type: "location", threat: 1, questPoints: 4 }));
  cards.set("place2", definePrinted({ code: "place2", name: "place2", type: "location", threat: 1, questPoints: 4 }));
  return { definition, cards };
}

export type SouthLayout = {
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
  second?: string;
  // The Ring-bearer is facedown under the Watcher in the Water (which is in the staging area).
  captive?: boolean;
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
export function southTable(world: SouthWorld, layout: SouthLayout = {}): { state: ScenarioState; ctx: ReduceContext; frodo: string; sam: string; merry: string | null; watcher: string | null } {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "142020";
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
  state = withThreat(state, 0, 8);
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
  if (layout.second) state = spawn(state, layout.second, { zone: "secondActiveLocation" }).state;
  let watcher: string | null = null;
  if (layout.captive) {
    const placed = spawn(state, WATCHER, { zone: "staging" });
    watcher = placed.id;
    state = placed.state;
    state = captureRingBearer(state, { verb: "CaptureRingBearer", under: WATCHER }, { effects: EFFECTS, cards: world.cards });
  }
  const phase = layout.phase ?? "Quest";
  const mode = phase === "Quest" ? "questCommit" : phase === "Encounter" ? "optionalEngage" : phase === "Travel" ? "travel" : phase === "Planning" ? "planning" : "combatActions";
  state = { ...state, phase, boundaryPhase: phase, mode, window: phase === "Encounter" ? { kind: "optionalEngage" } : phase === "Travel" ? { kind: "travel" } : { kind: "pass" }, activeSeat: 0 };
  return { state, ctx: { effects: EFFECTS, cards: world.cards }, frodo: frodo.id, sam: sam.id, merry, watcher };
}
