import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { spawn } from "../../../src/rules/core/zones.ts";

import { gameCodes, loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { addStandIns, entry, fightEnemy, HERO, HERO2, HERO3, opening, sceneEffects, type Entry, type Fight, type FightOptions, type Run, type ScenePhase } from "../../harness/scene-kit.ts";

// Shared scene for the Fire in the Night effect tests (ered-mithrin part 6, campaign card 12187). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// The side quest deck (`sideQuests`, emce.side-quests) is a pile of its own, dealt as the scenario's pile is; the campaign card, when it is on the table, shows its side A.
export const night: ScenarioData = loadScenario("fire-in-the-night");
export const campaign: CampaignData = loadCampaign("ered-mithrin");
export const dealt: ScenarioData = campaignScenario(night);

export const STAGES = ["19083"] as const;
// Read from data/scenarios/fire-in-the-night.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
  campaignCard: "12187", // Fire in the Night
  stage1: "19083", // Hrogar's Hill
  theDragonSThrall: "19075", // The Dragon's Thrall
  orcOfTheFlame: "19076", // Orc of the Flame
  townGate: "19077", // Town Gate
  woodenPalisade: "19078", // Wooden Palisade
  burningWatchtower: "19079", // Burning Watchtower
  powerfulInWrath: "19080", // Powerful in Wrath
  theDragonSFury: "19081", // The Dragon's Fury
  brightFlames: "19082", // Bright Flames
  goblinTroop: "18020", // Goblin Troop
  strayGoblin: "18021", // Stray Goblin
  accursedForest: "18038", // Accursed Forest
  darkBlackWoods: "18039", // Dark Black Woods
  gatheringGloom: "18040", // Gathering Gloom
  swarmOfBats: "18041", // Swarm of Bats
  dagnir: "19074", // Dagnir
  drawHerFire: "19066", // Draw Her Fire
  fortifyTheDefense: "19067", // Fortify the Defense
  rallyTheWoodmen: "19068", // Rally the Woodmen
  douseTheFlames: "19069", // Douse the Flames
  holdTheDoor: "19070", // Hold the Door
  defendTheTown: "19071", // Defend the Town
  routTheGoblins: "19072", // Rout the Goblins
  faceTheDragon: "19073", // Face the Dragon
  beldis: "12188", // Beldis
} as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type NightWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

// The cards the first five parts leave in the pool (the boon allies, the burdens, the Accolade and Song boons, Misplaced Trust and Urdug's Cunning) and two cards of the encounter pool (a Caves location and a Spiders of Mirkwood enemy).
const POOL_CODES: readonly string[] = ["12166", "12167", "12169", "12171", "12172", "12173", "12174", "12176", "12177", "12178", "12179", "12180", "12181", "12182", "12183", "12185", "12186", "18046", "18052"];

export async function loadNightWorld(): Promise<NightWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, night), ...POOL_CODES])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type NightLayout = {
  seats?: 1 | 2;
  seed?: number;
  stage?: (typeof STAGES)[number];
  progress?: number;
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
  // The side quest deck, top first (empty by default: the scenario always deals one, and a game without it reads none of the side quest rules).
  sideQuests?: readonly string[];
  // The active location.
  active?: string;
  // The side quests in the staging area that are the current quest (emce.side-quests-in-play), by code.
  current?: string;
  // The campaign card is on the table (a campaign game), as the Campaign Setup leaves it.
  campaign?: boolean;
};

export type NightTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function nightTable(world: NightWorld, layout: NightLayout = {}): NightTable {
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
  // The scenario always deals the side quest deck, empty or not.
  state = { ...state, piles: { ...state.piles, sideQuestDeck: [] } };
  for (const code of layout.sideQuests ?? []) state = spawn(state, code, { zone: "sideQuestDeck" }, "down").state;
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  state = { ...state, ...opening(layout.phase ?? "Quest"), ...(layout.phase === "Planning" ? { planningSeat: 0 } : {}) };
  if (layout.current) {
    const id = state.staging.find((other) => state.cards[other]?.code === layout.current);
    if (id) state = { ...state, sideAsked: state.round, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat: "currentQuest", amount: 1, until: "endOfPhase" }] };
  }
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero };
}

export { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../harness/scene-kit.ts";
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function nightFight(world: NightWorld, shadow: string, enemy: string, layout: NightLayout = {}, options: FightOptions<NightTable> = {}): Fight<NightTable> {
  return fightEnemy((made: NightLayout) => nightTable(world, made), shadow, enemy, layout, options);
}
