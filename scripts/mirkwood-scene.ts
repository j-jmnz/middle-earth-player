import { EFFECTS } from "../src/effects/index.ts";
import type { Effect, ScenarioDefinition } from "../src/catalog/boundary.ts";
import { scenarioCards, scenarioDefinition, type CampaignData, type ScenarioData } from "../src/catalog/scenario-data.ts";
import { syncConstants } from "../src/rules/interpret/constants.ts";
import { legalIntents } from "../src/rules/engine/legal.ts";
import { definePrinted, type PrintedCard } from "../src/rules/core/printed.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../src/rules/core/state.ts";
import { attachTo, spawn } from "../src/rules/core/zones.ts";

import { loadCampaign, loadScenario } from "./data/load-scenarios.ts";
import { send, start, type Run } from "./past-scene.ts";
import { loadPrinted } from "./test-catalog.ts";

// Shared scene for the Passage Through Mirkwood effect tests. Test-only. The heroes are plain numbers (no player card text), so what a
// test shows comes from the scenario's records and the engine.
export const passage: ScenarioData = loadScenario("passage-through-mirkwood");
export const campaign: CampaignData = loadCampaign("mirkwood-paths");

export const STAGES = ["01119", "01120", "01121", "01122"] as const;
export const CAMPAIGN_CARD = "01129";
export const MENDOR = "01135";
export const SUPPORT = "01132";
export const SWARM = "01136";
export const VENOM = "01137";
export const SPAWN = "01076";
export const CAUGHT = "01080";
export const HERO = "mh1";
export const HERO2 = "mh2";
export const HERO3 = "mh3";
export const HERO4 = "mh4";

// The filler event has an Action that does nothing, so it can be played: an event with no record at all cannot (rr.triggered-ability).
const SCENE_EFFECTS: readonly Effect[] = [...EFFECTS, { id: "filler:action:1", cardCode: "filler", lines: ["filler:A:1"], timing: "action", instructions: [] }];

export type MirkwoodWorld = { definition: ScenarioDefinition; cards: Map<string, PrintedCard> };

export async function loadMirkwoodWorld(): Promise<MirkwoodWorld> {
  const definition = scenarioDefinition(passage, campaign, EFFECTS);
  const codes = [...new Set([...scenarioCards(passage).map((card) => card.code), ...passage.campaignPlaced, passage.campaignCard])];
  const cards = new Map(await loadPrinted(codes));
  for (const [code, threat] of [["f0", 0], ["f3", 3]] as const) {
    cards.set(code, definePrinted({ code, name: code, type: "enemy", threat, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  }
  cards.set("brute", definePrinted({ code: "brute", name: "brute", type: "enemy", threat: 1, engagementCost: 10, attack: 9, defense: 1, health: 20 }));
  cards.set("grunt", definePrinted({ code: "grunt", name: "grunt", type: "enemy", threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 20 }));
  for (const code of [HERO, HERO2, HERO3, HERO4]) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: 2, attack: 2, defense: 2, health: 6 }));
  cards.set("strong", definePrinted({ code: "strong", name: "strong", type: "hero", sphere: "tactics", threat: 8, willpower: 6, attack: 4, defense: 3, health: 20 }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  cards.set("mevent", definePrinted({ code: "mevent", name: "mevent", type: "event", sphere: "neutral", cost: 0 }));
  cards.set("ally", definePrinted({ code: "ally", name: "ally", type: "ally", sphere: "neutral", cost: 0, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set("gear", definePrinted({ code: "gear", name: "gear", type: "attachment", sphere: "neutral", cost: 0 }));
  return { definition, cards };
}

export type MirkwoodLayout = {
  seats?: 1 | 2;
  seed?: number;
  stage?: (typeof STAGES)[number];
  progress?: number;
  // The encounter deck, the encounter discard pile, the staging area, the cards set aside, the victory display: top first.
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly string[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly { code: string; seat: number }[];
  active?: string;
  // Campaign Mode: the campaign card is in the game and Mendor is in play under the first player.
  campaign?: boolean;
  // Cards in each seat's hand, its deck (top first), and extra allies in its play area.
  hand?: readonly string[];
  hand2?: readonly string[];
  playerDeck?: readonly string[];
  allies?: readonly string[];
  // Attachments on the first seat's first hero.
  gear?: number;
  phase?: "Quest" | "Encounter" | "Combat" | "Travel";
  threat?: readonly [number, number];
  // The first seat's first hero is this card instead of the plain one ("strong": Defense 3 and 20 hit points).
  firstHero?: string;
  // Damage on the first card of each code: [code, damage].
  damage?: readonly (readonly [string, number])[];
  // Resources on the first seat's heroes, by code.
  resources?: readonly (readonly [string, number])[];
};

export function mirkwoodTable(world: MirkwoodWorld, layout: MirkwoodLayout = {}): { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null } {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "01119";
  let state = blankScenario({ seatCount: seats, seed: layout.seed ?? 3, definition: world.definition });
  const at = STAGES.indexOf(stage);
  for (const code of STAGES) {
    const index = STAGES.indexOf(code);
    // Stages 3 and 4 are the two branches of stage 2: past stage 2 the other one is out of the game.
    const behind = stage === "01121" || stage === "01122" ? (index < 2 ? "setAside" : code === stage ? "questStage" : "removed") : null;
    const placed = behind != null ? { zone: behind as "setAside" | "questStage" | "removed" } : index === at ? { zone: "questStage" as const } : index > at ? { zone: "questDeck" as const } : { zone: "setAside" as const };
    const spawned = spawn(state, code, placed, placed.zone === "questStage" ? "B" : "A");
    state = code === stage ? updateCard(spawned.state, spawned.id, { progress: layout.progress ?? 0 }) : spawned.state;
  }
  const first = spawn(state, layout.firstHero ?? HERO, { zone: "heroes", seat: 0 });
  state = spawn(first.state, HERO2, { zone: "heroes", seat: 0 }).state;
  let seat1Hero: string | null = null;
  if (seats === 2) {
    const other = spawn(state, HERO3, { zone: "heroes", seat: 1 });
    state = other.state;
    seat1Hero = other.id;
  }
  const second = Object.values(state.cards).find((card) => card.code === HERO2)?.id ?? "";
  state = withThreat(state, 0, layout.threat?.[0] ?? 28);
  if (seats === 2) state = withThreat(state, 1, layout.threat?.[1] ?? 26);
  for (const code of layout.hand ?? []) state = spawn(state, code, { zone: "hand", seat: 0 }).state;
  for (const code of layout.hand2 ?? []) state = spawn(state, code, { zone: "hand", seat: 1 }).state;
  for (const code of layout.playerDeck ?? []) state = spawn(state, code, { zone: "deck", seat: 0 }, "down").state;
  for (const code of layout.allies ?? []) state = spawn(state, code, { zone: "play", seat: 0 }).state;
  for (let count = 0; count < (layout.gear ?? 0); count += 1) {
    const gear = spawn(state, "gear", { zone: "play", seat: 0 });
    state = attachTo(gear.state, gear.id, first.id);
  }
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  for (const code of layout.staging ?? []) state = spawn(state, code, { zone: "staging" }).state;
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }).state;
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  for (const row of layout.engaged ?? []) state = spawn(state, row.code, { zone: "engaged", seat: row.seat }).state;
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  if (layout.campaign) {
    state = spawn(state, CAMPAIGN_CARD, { zone: "campaign" }).state;
    state = spawn(state, MENDOR, { zone: "play", seat: 0 }).state;
  }
  for (const [code, damage] of layout.damage ?? []) {
    const id = Object.values(state.cards).find((card) => card.code === code)?.id;
    if (id) state = updateCard(state, id, { damage });
  }
  for (const [code, resources] of layout.resources ?? []) {
    const id = Object.values(state.cards).find((card) => card.code === code)?.id;
    if (id) state = updateCard(state, id, { resources });
  }
  const phase = layout.phase ?? "Quest";
  const mode = phase === "Quest" ? "questCommit" : phase === "Encounter" ? "optionalEngage" : phase === "Travel" ? "travel" : "combatActions";
  const window = phase === "Encounter" ? { kind: "optionalEngage" as const } : phase === "Travel" ? { kind: "travel" as const } : { kind: "pass" as const };
  state = { ...state, phase, boundaryPhase: phase, mode, window, activeSeat: 0 };
  return { state, ctx: { effects: SCENE_EFFECTS, cards: world.cards }, hero: first.id, hero2: second, seat1Hero };
}

// An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it. The first hero defends, or nobody does (the
// attack is undefended and the damage goes to the first hero). A choice the shadow effect asks takes `answer` (the first option by default).
// The state at the end of the attack and every state from the defender's declaration on.
export function fight(
  world: MirkwoodWorld,
  shadow: string,
  enemy: "brute" | "grunt",
  layout: MirkwoodLayout = {},
  options: { undefended?: boolean; answer?: (state: ScenarioState) => PlayerIntent } = {},
): { run: Run; ctx: ReduceContext; hero: string; hero2: string; seen: ScenarioState[]; start: ScenarioState } {
  const made = mirkwoodTable(world, { phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], hand: ["filler", "filler", "filler"], ...layout });
  const state = syncConstants(made.state, made.ctx);
  let run: Run = send(start(state), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
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
