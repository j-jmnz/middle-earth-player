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

// Shared scene for the The King's Quest effect tests (ered-mithrin part 3, campaign card 12170). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// The layout adds the Caves deck (`caves`, top first) and the cards set aside (Fire-drake, Dragon Hoard and the Dragon Might set) to the staging area, the encounter deck and the victory display.
export const kingsquest: ScenarioData = loadScenario("the-kings-quest");
export const campaign: CampaignData = loadCampaign("ered-mithrin");
export const dealt: ScenarioData = campaignScenario(kingsquest);

export const STAGES = ["18078", "18079", "18080"] as const;
// Read from data/scenarios/the-kings-quest.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
  campaignCard: "12170", // The King's Quest
  stage1: "18078", // The Iron Hills
  stage2: "18079", // The Lower Depths
  stage3: "18080", // The Fire Worm
  ironHillsMine: "18044", // Iron Hills Mine
  contestedDepths: "18045", // Contested Depths
  deepChasm: "18046", // Deep Chasm
  denizenOfTheDeep: "18047", // Denizen of the Deep
  stoneTroll: "18049", // Stone-troll
  hobgoblin: "18050", // Hobgoblin
  werewolf: "18051", // Werewolf
  giantSpider: "18052", // Giant Spider
  blackBats: "18053", // Black Bats
  darkTunnel: "18054", // Dark Tunnel
  forkedPassage: "18055", // Forked Passage
  darkPlaces: "18056", // Dark Places
  afraidOfTheDark: "18048", // Afraid of the Dark
  eyesInTheDark: "18057", // Eyes in the Dark
  fireDrake: "18042", // Fire-drake
  dragonHoard: "18043", // Dragon Hoard
  dragonBreath: "18058", // Dragon Breath
  dragonScales: "18059", // Dragon Scales
  lostArmory: "18060", // Lost Armory
  ancientTreasury: "18061", // Ancient Treasury
  frightfulDen: "18062", // Frightful Den
  lightlessGrotto: "18063", // Lightless Grotto
  crumblingCavern: "18064", // Crumbling Cavern
  undergroundLake: "18065", // Underground Lake
  isolde: "12171", // Isolde
  bladeOfGondolin: "01039", // a Weapon attachment
  citadelPlate: "01040", // an Armor attachment
  hornOfGondor: "01042", // an Artifact attachment
  guardOfTheCitadel: "01013", // an ally with cost 2
  forestSpider: "01096", // an enemy with Attack 2, Dol Guldur Orcs-free filler
  eastBightPatrol: "01097", // an enemy
  theThreatToWilderland: "12172", // The Threat to Wilderland
  dagnirSSpawn: "12173", // Dagnir's Spawn
  abandonedRuin: "12174", // Abandoned Ruin
} as const;
// The nine treasures of the Ered Mithrin box (emce.treasure): the pool a random draw is made from.
export const TREASURES = ["12196", "12197", "12198", "12199", "12200", "12201", "12202", "12203", "12204"] as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type KingsquestWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadKingsquestWorld(): Promise<KingsquestWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...TREASURES, ...Object.values(CODES), ...gameCodes(campaign, kingsquest)])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "mild", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type KingsquestLayout = {
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
  // The active location, and the Caves deck (top first; emce.caves-deck).
  active?: string;
  caves?: readonly string[];
  hand?: readonly string[];
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: ScenePhase;
  threat?: readonly [number, number];
  // The campaign card is on the table (a campaign game), as the Campaign Setup leaves it.
  campaign?: boolean;
};

export type KingsquestTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function kingsquestTable(world: KingsquestWorld, layout: KingsquestLayout = {}): KingsquestTable {
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
  if (layout.caves) {
    state = { ...state, piles: { ...state.piles, cavesDeck: [] } };
    for (const code of layout.caves) state = spawn(state, code, { zone: "cavesDeck" }, "down").state;
  }
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero };
}

export { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../harness/scene-kit.ts";
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function kingsquestFight(world: KingsquestWorld, shadow: string, enemy: string, layout: KingsquestLayout = {}, options: FightOptions<KingsquestTable> = {}): Fight<KingsquestTable> {
  return fightEnemy((made: KingsquestLayout) => kingsquestTable(world, made), shadow, enemy, layout, options);
}
