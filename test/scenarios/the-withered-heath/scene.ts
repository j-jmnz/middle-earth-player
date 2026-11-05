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

// Shared scene for the The Withered Heath effect tests (ered-mithrin part 4, campaign card 12175). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// The layout adds the active location and the Caves deck (`caves`, top first) to the staging area, the encounter deck, the victory display and the cards set aside.
export const heath: ScenarioData = loadScenario("the-withered-heath");
export const campaign: CampaignData = loadCampaign("ered-mithrin");
export const dealt: ScenarioData = campaignScenario(heath);

export const STAGES = ["19022", "19023", "19024", "19025"] as const;
// Read from data/scenarios/the-withered-heath.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
  campaignCard: "12175", // The Withered Heath
  stage1: "19022", // Searching for Dragon Sign
  stage2: "19023", // The Cold-Drake Attacks!
  stage3: "19024", // Hunting the Beast
  stage4: "19025", // A Cornered Dragon
  snowTroll: "19013", // Snow-troll
  dragonHatchling: "19014", // Dragon Hatchling
  mountainPass: "19015", // Mountain Pass
  dwarvenDoor: "19016", // Dwarven Door
  caveEntrance: "19017", // Cave Entrance
  creatureDen: "19018", // Creature Den
  highFalls: "19019", // High Falls
  heavySnow: "19020", // Heavy Snow
  deadlyCold: "19021", // Deadly Cold
  werewolf: "18051", // Werewolf
  giantSpider: "18052", // Giant Spider
  blackBats: "18053", // Black Bats
  ruinedSupplies: "18025", // Ruined Supplies
  lostInTheWild: "18026", // Lost in the Wild
  weighedDown: "18027", // Weighed Down
  coldDrake: "19011", // Cold-Drake
  dragonSign: "19012", // Dragon Sign
  lostArmory: "18060", // Lost Armory
  ancientTreasury: "18061", // Ancient Treasury
  frightfulDen: "18062", // Frightful Den
  lightlessGrotto: "18063", // Lightless Grotto
  crumblingCavern: "18064", // Crumbling Cavern
  undergroundLake: "18065", // Underground Lake
  masterOfTheHunt: "12176", // Master of the Hunt
  unbroken: "12177", // Unbroken
  theSteadfast: "12178", // The Steadfast
  dragonSlayer: "12179", // Dragon-slayer
  theCannyHuntsman: "12180", // The Canny Huntsman
  aTaleOfVictories: "12181", // A Tale of Victories
  layOfCourage: "12182", // Lay of Courage
  rhymeOfTheSlayer: "12183", // Rhyme of the Slayer
  hornOfGondor: "01042", // an Artifact attachment
  eowyn: "01051", // an ally with cost 1 for the deck-search tests
  turayn: "12166", // Turayn, a unique boon ally
  melanwar: "12169", // Melanwar, a unique boon ally
  isolde: "12171", // Isolde, a unique boon ally
  growingThreat: "12167", // A Growing Threat
  theThreatToWilderland: "12172", // The Threat to Wilderland
  dagnirSSpawn: "12173", // Dagnir's Spawn
  abandonedRuin: "12174", // Abandoned Ruin
} as const;
// The nine treasures of the Ered Mithrin box (emce.treasure): the pool a random draw is made from.
export const TREASURES = ["12196", "12197", "12198", "12199", "12200", "12201", "12202", "12203", "12204"] as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type HeathWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadHeathWorld(): Promise<HeathWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...TREASURES, ...Object.values(CODES), ...gameCodes(campaign, heath)])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "mild", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type HeathLayout = {
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
  // The campaign card is on the table (a campaign game), as the Campaign Setup leaves it.
  campaign?: boolean;
  // The active location, and the Caves deck (top first; emce.caves-deck).
  active?: string;
  caves?: readonly string[];
};

export type HeathTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function heathTable(world: HeathWorld, layout: HeathLayout = {}): HeathTable {
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
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  if (layout.caves) {
    state = { ...state, piles: { ...state.piles, cavesDeck: [] } };
    for (const code of layout.caves) state = spawn(state, code, { zone: "cavesDeck" }, "down").state;
  }
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero };
}

export { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../harness/scene-kit.ts";
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function heathFight(world: HeathWorld, shadow: string, enemy: string, layout: HeathLayout = {}, options: FightOptions<HeathTable> = {}): Fight<HeathTable> {
  return fightEnemy((made: HeathLayout) => heathTable(world, made), shadow, enemy, layout, options);
}
