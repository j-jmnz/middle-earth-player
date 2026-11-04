import { EFFECTS } from "../../../src/effects/index.ts";
import type { Effect, ScenarioDefinition } from "../../../src/catalog/boundary.ts";
import { scenarioCards, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { legalIntents, legalTargets } from "../../../src/rules/engine/legal.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { addStandIns, allyCard, answer, codesIn, enemyCard, eventCard, first, HERO, HERO2, HERO3, opening, resolveRecords, sceneEffects, send, start, type Run } from "../../harness/scene-kit.ts";

// Shared scene for The Caves of Nibin-Dûm effect tests. Test-only. The heroes are plain numbers (no player card text), so what a test
// shows comes from the scenario's records and the engine.
export const caves: ScenarioData = loadScenario("the-caves-of-nibin-dum");
export const campaign: CampaignData = loadCampaign("mirkwood-paths");

export const STAGES = ["41004", "41005", "41006", "41007"] as const;
export const CAMPAIGN_CARD = "41051";
export const CHIEFTAIN = "41027";
export const PILLAR = "41028";
export const TORCH = "41029";
export const SHINY_DISTRACTION = "41042";
export const NO_TIME = "41048";
export const RANGER_SENSE = "41049";
export { HERO, HERO2, HERO3 };

// The "cancel" event answers the window in which a When Revealed or Shadow effect is about to resolve, as A Test of Will does.
const SCENE_EFFECTS: readonly Effect[] = [
  ...sceneEffects(),
  { id: "cancel:response:1", cardCode: "cancel", lines: ["cancel:A:1"], timing: "response", trigger: "whenRevealedPending", cost: { kind: "playEvent" }, instructions: [{ verb: "CancelEffect" }] },
];

export type CavesWorld = { definition: ScenarioDefinition; cards: Map<string, PrintedCard> };

export async function loadCavesWorld(): Promise<CavesWorld> {
  const definition = scenarioDefinition(caves, campaign, EFFECTS);
  const codes = [...new Set([...scenarioCards(caves).map((card) => card.code), ...caves.campaignPlaced, caves.campaignCard])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "place", "heroes", "filler"]);
  cards.set("brute", enemyCard("brute", { threat: 1, engagementCost: 10, attack: 9, defense: 1, health: 20 }));
  cards.set("grunt", enemyCard("grunt", { threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 20 }));
  cards.set("gob", enemyCard("gob", { traits: ["Goblin"], threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 20 }));
  cards.set("spider", enemyCard("spider", { traits: ["Spider"], threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 20 }));
  cards.set("cancel", eventCard("cancel", 0));
  cards.set("ally", allyCard("ally", 0));
  cards.set("costly", eventCard("costly", 6));
  cards.set("blade", definePrinted({ code: "blade", name: "blade", type: "attachment", sphere: "neutral", cost: 0 }));
  return { definition, cards };
}

export type CavesLayout = {
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
  // Campaign Mode: the campaign card is in the game.
  campaign?: boolean;
  // Cards in each seat's hand, and in each seat's deck (top first).
  hand?: readonly string[];
  deckOf?: readonly string[];
  allies?: readonly string[];
  phase?: "Quest" | "Encounter" | "Combat" | "Travel" | "Refresh" | "Planning";
  threat?: readonly [number, number];
  // Damage on the first card of each code: [code, damage].
  damage?: readonly (readonly [string, number])[];
  // Cards in the victory display, and cards attached to the first hero (in its controller's play area, controlled by nobody: encounter attachments).
  victory?: readonly string[];
  attachedEncounter?: readonly string[];
  // Resource tokens on the first hero, and the Campaign Log facts the game starts from (used once, tokens).
  resources?: number;
  facts?: { usedOnce?: readonly string[]; counters?: Readonly<Record<string, number>> };
  // Player attachments (cards of type attachment) on the first hero, in its controller's play area.
  attachments?: readonly string[];
};

export function cavesTable(world: CavesWorld, layout: CavesLayout = {}): { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null } {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "41004";
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
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }).state;
  for (const row of layout.engaged ?? []) state = spawn(state, row.code, { zone: "engaged", seat: row.seat }).state;
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  for (const code of layout.attachedEncounter ?? []) {
    const card = spawn(state, code, { zone: "attached" });
    state = attachTo(card.state, card.id, first.id);
  }
  if (layout.resources != null) state = updateCard(state, first.id, { resources: layout.resources });
  if (layout.facts) state = { ...state, campaignFacts: { prisoner: null, usedOnce: layout.facts.usedOnce ?? [], counters: layout.facts.counters ?? {} } };
  for (const code of layout.attachments ?? []) {
    const card = spawn(state, code, { zone: "play", seat: 0 });
    state = attachTo(card.state, card.id, first.id);
  }
  if (layout.campaign) {
    state = spawn(state, CAMPAIGN_CARD, { zone: "campaign" }).state;
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
  world: CavesWorld,
  shadow: string,
  enemy: string,
  layout: CavesLayout = {},
  options: { undefended?: boolean; answer?: (state: ScenarioState) => PlayerIntent } = {},
): { run: Run; ctx: ReduceContext; hero: string; hero2: string; seen: ScenarioState[]; start: ScenarioState } {
  const made = cavesTable(world, { phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], hand: ["filler", "filler", "filler"], ...layout });
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

// The choices an effect opens are answered (the first option by default).
export const settleChoices = answer;

// The card's When Revealed records resolve now, in the quest phase (the way a reveal resolves them), and the look windows and choices they open are answered.
export function resolveReveal(state: ScenarioState, ctx: ReduceContext, code: string, pick?: (state: ScenarioState) => string): Run & { id: string } {
  return resolveRecords(state, ctx, code, "whenRevealed", undefined, pick, false);
}

// The first enemy of this code in the staging area is engaged by the first seat: the optional engagement step lets a player engage it.
export function engageStaged(state: ScenarioState, ctx: ReduceContext, code: string): Run {
  const enemy = first(state, code);
  if (!legalTargets(state, { type: "Engage" }, ctx).includes(enemy)) throw new Error(`${code} cannot be engaged`);
  return settleChoices(send(start(state), { type: "Engage", enemyId: enemy }, ctx), ctx);
}

export function travelTo(state: ScenarioState, ctx: ReduceContext, code: string): Run {
  return settleChoices(send(start(state), { type: "Travel", locationId: first(state, code) }, ctx), ctx);
}

export { codesIn };
