import { EFFECTS } from "../../../src/effects/index.ts";
import type { ScenarioDefinition } from "../../../src/catalog/boundary.ts";
import { scenarioCards, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { legalIntents } from "../../../src/rules/engine/legal.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { addStandIns, allyCard, enemyCard, HERO, HERO2, HERO3, opening, sceneEffects, send, start, type Run } from "../../harness/scene-kit.ts";

// Shared scene for the Escape from Dol Guldur effect tests. Test-only. The heroes are plain numbers (no player card text), so what a test
// shows comes from the scenario's records and the engine.
export const dolGuldur: ScenarioData = loadScenario("escape-from-dol-guldur");
export const campaign: CampaignData = loadCampaign("mirkwood-paths");

export const STAGES = ["01123", "01124", "01125"] as const;
export const CAMPAIGN_CARD = "01131";
export const MENDOR = "01135";
export const APPOINTED = "01134";
export const NAZGUL = "01102";
export const OBJECTIVES = ["01108", "01109", "01110"] as const;
export { HERO, HERO2, HERO3 };

const SCENE_EFFECTS = sceneEffects();

export type DolGuldurWorld = { definition: ScenarioDefinition; cards: Map<string, PrintedCard> };

export async function loadDolGuldurWorld(): Promise<DolGuldurWorld> {
  const definition = scenarioDefinition(dolGuldur, campaign, EFFECTS);
  const codes = [...new Set([...scenarioCards(dolGuldur).map((card) => card.code), ...dolGuldur.campaignPlaced, dolGuldur.campaignCard, "01132", "01133", "01138"])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "place", "heroes", "filler"]);
  cards.set("brute", enemyCard("brute", { threat: 1, engagementCost: 10, attack: 9, defense: 1, health: 20 }));
  cards.set("grunt", enemyCard("grunt", { threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 20 }));
  cards.set("ally", allyCard("ally", 0));
  cards.set("blade", definePrinted({ code: "blade", name: "blade", type: "attachment", sphere: "neutral", cost: 0 }));
  return { definition, cards };
}

export type DolGuldurLayout = {
  seats?: 1 | 2;
  seed?: number;
  stage?: (typeof STAGES)[number];
  progress?: number;
  // The encounter deck, the encounter discard pile, the staging area, the cards set aside: top first.
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly string[];
  setAside?: readonly string[];
  engaged?: readonly { code: string; seat: number }[];
  active?: string;
  // Campaign Mode: the campaign card is in the game and Mendor is in play under the first player.
  campaign?: boolean;
  // Cards in each seat's hand, and in each seat's deck (top first).
  hand?: readonly string[];
  deckOf?: readonly string[];
  allies?: readonly string[];
  phase?: "Quest" | "Encounter" | "Combat" | "Travel" | "Refresh" | "Planning";
  threat?: readonly [number, number];
  // Damage on the first card of each code: [code, damage].
  damage?: readonly (readonly [string, number])[];
  // Objectives claimed by the first hero (attached to it, controlled by seat 0).
  claimed?: readonly string[];
  // The objectives are in the staging area, each guarded by the card named at the same index ("" for no guard).
  guarded?: readonly (readonly [string, string])[];
  // Player attachments (cards of type attachment) on the first hero, in its controller's play area.
  attachments?: readonly string[];
};

export function dolGuldurTable(world: DolGuldurWorld, layout: DolGuldurLayout = {}): { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null } {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "01123";
  let state = blankScenario({ seatCount: seats, seed: layout.seed ?? 3, definition: world.definition });
  const at = STAGES.indexOf(stage);
  for (const code of STAGES) {
    const index = STAGES.indexOf(code);
    const placed = index === at ? { zone: "questStage" as const } : index > at ? { zone: "questDeck" as const } : { zone: "setAside" as const };
    const spawned = spawn(state, code, placed, placed.zone === "questStage" ? "B" : "A");
    state = code === stage ? updateCard(spawned.state, spawned.id, { progress: layout.progress ?? 0 }) : spawned.state;
  }
  const first = spawn(state, HERO, { zone: "heroes", seat: 0 });
  const secondHero = spawn(first.state, HERO2, { zone: "heroes", seat: 0 });
  state = secondHero.state;
  let seat1Hero: string | null = null;
  if (seats === 2) {
    const other = spawn(state, HERO3, { zone: "heroes", seat: 1 });
    state = other.state;
    seat1Hero = other.id;
  }
  state = withThreat(state, 0, layout.threat?.[0] ?? 28);
  if (seats === 2) state = withThreat(state, 1, layout.threat?.[1] ?? 26);
  for (let seat = 0; seat < seats; seat += 1) {
    for (const code of layout.hand ?? []) state = spawn(state, code, { zone: "hand", seat }).state;
    for (const code of layout.deckOf ?? []) state = spawn(state, code, { zone: "deck", seat }, "down").state;
  }
  for (const code of layout.allies ?? []) state = spawn(state, code, { zone: "play", seat: 0 }).state;
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  for (const code of layout.staging ?? []) state = spawn(state, code, { zone: "staging" }).state;
  for (const [objective, guard] of layout.guarded ?? []) {
    const spawned = spawn(state, objective, { zone: "staging" });
    state = spawned.state;
    if (guard !== "") {
      const card = spawn(state, guard, { zone: "staging" });
      state = updateCard(attachTo(card.state, card.id, spawned.id), card.id, { guard: true });
    }
  }
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }).state;
  for (const row of layout.engaged ?? []) state = spawn(state, row.code, { zone: "engaged", seat: row.seat }).state;
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  for (const code of layout.claimed ?? []) {
    const objective = spawn(state, code, { zone: "attached" });
    state = attachTo(objective.state, objective.id, first.id);
    state = updateCard(state, objective.id, { controller: 0, claimed: true });
  }
  for (const code of layout.attachments ?? []) {
    const card = spawn(state, code, { zone: "play", seat: 0 });
    state = attachTo(card.state, card.id, first.id);
  }
  if (layout.campaign) {
    state = spawn(state, CAMPAIGN_CARD, { zone: "campaign" }).state;
    state = spawn(state, MENDOR, { zone: "play", seat: 0 }).state;
  }
  for (const [code, damage] of layout.damage ?? []) {
    const id = Object.values(state.cards).find((card) => card.code === code)?.id;
    if (id) state = updateCard(state, id, { damage });
  }
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state, ctx: { effects: SCENE_EFFECTS, cards: world.cards }, hero: first.id, hero2: secondHero.id, seat1Hero };
}

// An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it. The first hero defends, or nobody does (the
// attack is undefended and the damage goes to the first hero). A choice the shadow effect asks takes `answer` (the first option by default).
// The state at the end of the attack and every state from the defender's declaration on.
export function fight(
  world: DolGuldurWorld,
  shadow: string,
  enemy: string,
  layout: DolGuldurLayout = {},
  options: { undefended?: boolean; answer?: (state: ScenarioState) => PlayerIntent } = {},
): { run: Run; ctx: ReduceContext; hero: string; hero2: string; seen: ScenarioState[]; start: ScenarioState } {
  const made = dolGuldurTable(world, { phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], hand: ["filler", "filler", "filler"], ...layout });
  const state = syncConstants(made.state, made.ctx);
  let run: Run = send(start(state), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    // Several enemies engaged: the first player chooses which attacks first (the one dealt the shadow card the test is about).
    if (run.state.window?.kind === "chooseEnemy") {
      const cards = run.state.cards;
      const wanted = run.state.window.options.find((id) => cards[cards[id]?.shadowId ?? ""]?.code === shadow) ?? run.state.window.options[0] ?? "";
      run = send(run, { type: "ChooseEnemy", enemyId: wanted }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  if (run.state.window?.kind !== "defense") throw new Error(`no defense window: ${JSON.stringify(run.state.window)}`);
  run = send(run, options.undefended ? { type: "Undefended", heroId: made.hero } : { type: "DeclareDefender", defenderId: made.hero }, made.ctx);
  const seen: ScenarioState[] = [run.state];
  for (let guard = 0; guard < 30 && (run.state.pendingAttack != null || run.state.stack.length > 0); guard += 1) {
    const window = run.state.window;
    if (window?.kind === "choose") {
      run = send(run, options.answer?.(run.state) ?? { type: "Choose", optionId: window.options[0] ?? "" }, made.ctx);
      seen.push(run.state);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
    seen.push(run.state);
  }
  return { run, ctx: made.ctx, hero: made.hero, hero2: made.hero2, seen, start: state };
}
