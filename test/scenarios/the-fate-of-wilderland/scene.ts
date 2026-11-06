import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { spawn } from "../../../src/rules/core/zones.ts";

import { gameCodes, loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { fireForced } from "../../../src/rules/windows/triggers.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { addStandIns, entry, fightEnemy, finish, HERO, HERO2, HERO3, idOf, legalIntents, opening, sceneEffects, send, start, type Entry, type Fight, type FightOptions, type Run, type ScenePhase } from "../../harness/scene-kit.ts";

// Shared scene for the The Fate of Wilderland effect tests (ered-mithrin part 9, campaign card 12195). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// The layout adds the active location (`active`); the objectives and Urdug lie in the staging area like any card.
export const wilderland: ScenarioData = loadScenario("the-fate-of-wilderland");
export const campaign: CampaignData = loadCampaign("ered-mithrin");
export const dealt: ScenarioData = campaignScenario(wilderland);

export const STAGES = ["19168", "19169", "19170"] as const;
// Read from data/scenarios/the-fate-of-wilderland.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
  campaignCard: "12195", // The Fate of Wilderland
  stage1: "19168", // Urdug's Assault
  stage2: "19169", // Outflanked
  stage3: "19170", // The Final Push
  urdugSElite: "19158", // Urdug's Elite
  fierceVanguard: "19159", // Fierce Vanguard
  wargRider: "19160", // Warg-rider
  gateOfGundabad: "19161", // Gate of Gundabad
  hilltopBattlements: "19162", // Hilltop Battlements
  dwarvenWatchtower: "19163", // Dwarven Watchtower
  slopesOfGundabad: "19164", // Slopes of Gundabad
  fierceAttack: "19165", // Fierce Attack
  urdugSCommand: "19166", // Urdug's Command
  darkClouds: "19167", // Dark Clouds
  goblinTroop: "18020", // Goblin Troop
  strayGoblin: "18021", // Stray Goblin
  gatheringGloom: "18040", // Gathering Gloom
  swarmOfBats: "18041", // Swarm of Bats
  packOfWargs: "18022", // Pack of Wargs
  hillsOfWilderland: "18023", // Hills of Wilderland
  lonelyLands: "18024", // Lonely Lands
  theGoblinsAssault: "19155", // The Goblins' Assault
  theHeroesDefense: "19156", // The Heroes' Defense
  urdug: "19157", // Urdug
} as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type WilderlandWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadWilderlandWorld(): Promise<WilderlandWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, wilderland)])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type WilderlandLayout = {
  seats?: 1 | 2;
  seed?: number;
  stage?: (typeof STAGES)[number];
  progress?: number;
  // The active location.
  active?: string;
  // The encounter deck (top first), its discard pile, the staging area, the cards set aside, the victory display.
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly Entry[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly (Entry | { code: string; seat: number; damage?: number; resources?: number })[];
  hand?: readonly string[];
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: ScenePhase;
  threat?: readonly [number, number];
  // The campaign card is on the table (a campaign game), as the Campaign Setup leaves it.
  campaign?: boolean;
};

export type WilderlandTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function wilderlandTable(world: WilderlandWorld, layout: WilderlandLayout = {}): WilderlandTable {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? STAGES[0];
  const ctx: ReduceContext = { effects: SCENE_EFFECTS, cards: world.cards };
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
  for (let seat = 0; seat < seats; seat += 1) state = withThreat(state, seat, layout.threat?.[seat] ?? 28);
  for (let seat = 0; seat < seats; seat += 1) {
    for (const code of layout.hand ?? []) state = spawn(state, code, { zone: "hand", seat }).state;
    for (const code of layout.deckOf ?? []) state = spawn(state, code, { zone: "deck", seat }, "down").state;
  }
  for (const code of layout.play ?? []) state = spawn(state, code, { zone: "play", seat: 0 }).state;
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  for (const item of layout.staging ?? []) {
    const row = entry(item);
    const spawned = spawn(state, row.code, { zone: "staging" });
    state = updateCard(spawned.state, spawned.id, { progress: row.progress, damage: row.damage, resources: row.resources });
  }
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }, "up").state;
  for (const row of layout.engaged ?? []) {
    const item = typeof row === "string" ? { code: row, seat: 0 } : row;
    const tokens = entry(item);
    const spawned = spawn(state, tokens.code, { zone: "engaged", seat: "seat" in item ? item.seat : 0 });
    state = updateCard(spawned.state, spawned.id, { damage: tokens.damage, resources: tokens.resources });
  }
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero };
}

export { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../harness/scene-kit.ts";
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function wilderlandFight(world: WilderlandWorld, shadow: string, enemy: string, layout: WilderlandLayout = {}, options: FightOptions<WilderlandTable> = {}): Fight<WilderlandTable> {
  return fightEnemy((made: WilderlandLayout) => wilderlandTable(world, made), shadow, enemy, layout, options);
}

/** The option a Choose window takes: this one when it is offered, else the first. */
export const takes = (id: string) => (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? state.window.options[0] ?? "") : "");

/** The players commit both of the first seat's heroes and quest: the window is passed until the quest is resolved and its Forced effects have answered. */
export function quest(table: WilderlandTable, state: ScenarioState): Run {
  let run = send(start(state), { type: "Commit", cardIds: [table.hero, table.hero2] }, table.ctx);
  run = send(run, { type: "Pass" }, table.ctx);
  for (let guard = 0; guard < 16; guard += 1) {
    if (run.state.window?.kind === "choose") run = finish(run, table.ctx);
    else if (run.state.phase !== "Quest" || run.state.lost || run.state.stageCleared) break;
    else {
      const pass = legalIntents(run.state, table.ctx).find((intent) => intent.type === "Pass");
      if (!pass || run.state.mode === "travel") break;
      run = send(run, pass as PlayerIntent, table.ctx);
    }
  }
  return run;
}

/** An event the way the engine announces it, and what the Forced effects it starts do, with the choices answered by `pick`. */
export function announce(table: WilderlandTable, state: ScenarioState, event: Parameters<typeof fireForced>[1], pick?: (state: ScenarioState) => string): Run {
  const steps: EngineStep[] = [];
  return finish({ state: settle(fireForced({ ...state, window: null }, event, table.ctx, steps), table.ctx, steps), steps }, table.ctx, pick);
}

/** The objectives and Urdug, which the piles place in the staging area. */
export const FIGHT: readonly string[] = [CODES.theGoblinsAssault, CODES.theHeroesDefense, CODES.urdug];

/** The table with the objectives and Urdug in the staging area, and the cards a test adds. */
export const fightTable = (world: WilderlandWorld, staging: NonNullable<WilderlandLayout["staging"]> = [], extra: WilderlandLayout = {}): WilderlandTable => wilderlandTable(world, { ...extra, staging: [...FIGHT, ...staging] });

/** The progress and the resource tokens on the card with this code. */
export const progressOn = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.progress ?? 0;
export const resourcesOn = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.resources ?? 0;
