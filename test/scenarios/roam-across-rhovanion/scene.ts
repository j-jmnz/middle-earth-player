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

// Shared scene for the Roam Across Rhovanion effect tests (ered-mithrin part 5, campaign card 12184). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// TODO: describe the cards that need their own layout fields (a second active location, a grotto deck, an island map) and add them to the layout and the table below.
export const rhovanion: ScenarioData = loadScenario("roam-across-rhovanion");
export const campaign: CampaignData = loadCampaign("ered-mithrin");
export const dealt: ScenarioData = campaignScenario(rhovanion);

export const STAGES = ["19047", "19048", "19049", "19050", "19051"] as const;
// Read from data/scenarios/roam-across-rhovanion.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
  campaignCard: "12184", // Roam Across Rhovanion
  stage1: "19047", // The Goblin's Task
  stage2: "19048", // Rescue Tiny
  stage3: "19049", // Retrieve Urdug's Horn
  stage4: "19050", // Find Durin's Key
  stage5: "19051", // Urdug's Gambit
  greyMountainGiant: "19038", // Grey Mountain Giant
  huntingEagle: "19039", // Hunting Eagle
  wilderlandBear: "19040", // Wilderland Bear
  greyMoorland: "19041", // Grey Moorland
  deepRavine: "19042", // Deep Ravine
  slopesOfEredMithrin: "19043", // Slopes of Ered Mithrin
  sneakingOff: "19044", // Sneaking Off
  harshWeather: "19045", // Harsh Weather
  wildCreatures: "19046", // Wild Creatures
  stoneTroll: "18049", // Stone-troll
  hobgoblin: "18050", // Hobgoblin
  ruinedSupplies: "18025", // Ruined Supplies
  lostInTheWild: "18026", // Lost in the Wild
  weighedDown: "18027", // Weighed Down
  packOfWargs: "18022", // Pack of Wargs
  hillsOfWilderland: "18023", // Hills of Wilderland
  lonelyLands: "18024", // Lonely Lands
  durinSKey: "19036", // Durin's Key
  urdugSHorn: "19037", // Urdug's Horn
  urdug: "19052", // Urdug (objective ally)
  urdugEnemy: "19053", // Urdug (enemy)
  tiny: "19054", // Tiny (objective ally)
  tinyEnemy: "19055", // Tiny (enemy)
  urdugSCunning: "12185", // Urdug's Cunning
  misplacedTrust: "12186", // Misplaced Trust
  // What the earlier parts leave in the pool.
  turayn: "12166", // Turayn (boon ally, part 1)
  aGrowingThreat: "12167", // A Growing Threat (burden, part 1)
  melanwar: "12169", // Melanwar (boon ally, part 2)
  isolde: "12171", // Isolde (boon ally, part 3)
  threatToWilderland: "12172", // The Threat to Wilderland (burden, part 3)
  dagnirSSpawn: "12173", // Dagnir's Spawn (burden, part 3)
  abandonedRuin: "12174", // Abandoned Ruin (burden, part 3)
} as const;
// The cards the first four parts leave in the pool: the boon allies, the burdens and the Accolade and Song boons.
const POOL_CODES: readonly string[] = ["12166", "12167", "12169", "12171", "12172", "12173", "12174", "12176", "12177", "12178", "12179", "12180", "12181", "12182", "12183", "18046", "18052"];
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type RhovanionWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadRhovanionWorld(): Promise<RhovanionWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.cards.flatMap((card) => (card.back != null ? [card.back] : [])), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, rhovanion), ...POOL_CODES])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "mild", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type RhovanionLayout = {
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
  // The active location.
  active?: string;
  // The campaign card is on the table (a campaign game), as the Campaign Setup leaves it, side B up.
  campaign?: boolean;
};

export type RhovanionTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function rhovanionTable(world: RhovanionWorld, layout: RhovanionLayout = {}): RhovanionTable {
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
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }, "B").state;
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero };
}

export { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../harness/scene-kit.ts";
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function rhovanionFight(world: RhovanionWorld, shadow: string, enemy: string, layout: RhovanionLayout = {}, options: FightOptions<RhovanionTable> = {}): Fight<RhovanionTable> {
  return fightEnemy((made: RhovanionLayout) => rhovanionTable(world, made), shadow, enemy, layout, options);
}
