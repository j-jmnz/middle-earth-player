import type { Effect } from "../../../src/catalog/boundary.ts";
import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";

import { gameCodes, loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { EARLIER_POOL } from "../the-ghost-of-framsburg/scene.ts";
import { TREASURES } from "../the-withered-heath/scene.ts";
import { addStandIns, entry, fightEnemy, HERO, HERO2, HERO3, opening, sceneEffects, type Entry, type Fight, type FightOptions, type Run, type ScenePhase } from "../../harness/scene-kit.ts";

// Shared scene for the Mount Gundabad effect tests (ered-mithrin part 8, campaign card 12193). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// The layout holds what Mount Gundabad adds to a table: the quest deck (the stage 2s, top first, side A up until the quest phase flips the current one), the Caves deck, the card set aside and Wormsbane attached to a hero.
export const gundabad: ScenarioData = loadScenario("mount-gundabad");
export const campaign: CampaignData = loadCampaign("ered-mithrin");
export const dealt: ScenarioData = campaignScenario(gundabad);

export const STAGES = ["19134", "19135", "19137", "19138", "19139", "19140", "19141", "19142"] as const;
// The stage 2s: the quest deck's cards (Exploring Gundabad 2A), in the order the scenario lists them.
export const STAGE_TWOS = STAGES.slice(1) as readonly Exclude<(typeof STAGES)[number], "19134">[];
// Read from data/scenarios/mount-gundabad.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
  campaignCard: "12193", // Mount Gundabad
  stage1: "19134", // The Side Door
  stage2: "19135", // Exploring Gundabad
  stage3: "19137", // Exploring Gundabad
  stage4: "19138", // Exploring Gundabad
  stage5: "19139", // Exploring Gundabad
  stage6: "19140", // Exploring Gundabad
  stage7: "19141", // Exploring Gundabad
  stage8: "19142", // Exploring Gundabad
  guardianOfGundabad: "19126", // Guardian of Gundabad
  dagnirSSlave: "19127", // Dagnir's Slave
  deepDweller: "19128", // Deep-dweller
  minesOfGundabad: "19129", // Mines of Gundabad
  narrowStair: "19130", // Narrow Stair
  desecratedRuins: "19131", // Desecrated Ruins
  wilderlandSBane: "19132", // Wilderland's Bane
  suffocatingShadows: "19133", // Suffocating Shadows
  stoneTroll: "18049", // Stone-troll
  hobgoblin: "18050", // Hobgoblin
  darkTunnel: "18054", // Dark Tunnel
  forkedPassage: "18055", // Forked Passage
  darkPlaces: "18056", // Dark Places
  afraidOfTheDark: "18048", // Afraid of the Dark
  eyesInTheDark: "18057", // Eyes in the Dark
  dragonBreath: "18058", // Dragon Breath
  dragonScales: "18059", // Dragon Scales
  dagnir: "19125", // Dagnir
  theFirstForge: "19122", // The First Forge
  wormsbane: "19143", // Wormsbane
  dagnirSHoard: "19123", // Dagnir's Hoard
  throatOfTheMountain: "19124", // Throat of the Mountain
  lostArmory: "18060", // Lost Armory
  ancientTreasury: "18061", // Ancient Treasury
  frightfulDen: "18062", // Frightful Den
  lightlessGrotto: "18063", // Lightless Grotto
  crumblingCavern: "18064", // Crumbling Cavern
  undergroundLake: "18065", // Underground Lake
  aGrowingThreat: "12167", // A Growing Threat
  dragonSickness: "12194", // Dragon-sickness
} as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

// The records every table runs on: the authored and generated ones and the stand-ins' do-nothing Actions.
export const SCENE_EFFECTS = sceneEffects("c0");

export type GundabadWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadGundabadWorld(): Promise<GundabadWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, gundabad), "19144", "12188", "12190", "12191", "12192", ...EARLIER_POOL, ...TREASURES])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  // An Item attachment for Dagnir's Hoard to find.
  cards.set("item", definePrinted({ code: "item", name: "item", type: "attachment", sphere: "neutral", cost: 0, traits: ["Item"] }));
  return { definition, cards };
}

export type GundabadLayout = {
  seats?: 1 | 2;
  seed?: number;
  // The current quest card (stage 1 by default) and the side it shows: stage 1 and a stage 2 show side B unless `faceA` (a stage 2 just revealed, before the beginning of the quest phase flips it).
  stage?: (typeof STAGES)[number];
  faceA?: boolean;
  // The quest deck, top first: the stage 2s other than the current one by default. A stage that is neither current nor in the deck lies in the victory display (defeated), The Side Door included once the quest has left it.
  questDeck?: readonly (typeof STAGES)[number][];
  progress?: number;
  // The encounter deck (top first), its discard pile, the staging area, the cards set aside, the victory display.
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly Entry[];
  // The active location.
  active?: string;
  setAside?: readonly string[];
  // The Caves deck, top first.
  caves?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly (Entry | { code: string; seat: number; damage?: number; resources?: number })[];
  hand?: readonly string[];
  // Cards attached to a hero of the first seat (Wormsbane on the first hero, Broken or Reforged side up).
  attached?: readonly { code: string; to?: "hero" | "hero2" }[];
  // Characters of the first seat committed to the quest: the first hero (and the second).
  committed?: 1 | 2;
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: ScenePhase;
  threat?: readonly [number, number];
  // The campaign card is on the table (a campaign game), as the Campaign Setup leaves it.
  campaign?: boolean;
  // The records the table runs on: the scene's by default; a test passes them less a line to show that the line's records make the difference.
  effects?: readonly Effect[];
};

export type GundabadTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function gundabadTable(world: GundabadWorld, layout: GundabadLayout = {}): GundabadTable {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? STAGES[0];
  const ctx: ReduceContext = { effects: layout.effects ?? SCENE_EFFECTS, cards: world.cards };
  let state = blankScenario({ seatCount: seats, seed: layout.seed ?? 3, definition: world.definition });
  const deckOrder = layout.questDeck ?? STAGE_TWOS.filter((code) => code !== stage);
  for (const code of STAGES) {
    const placed = code === stage ? { zone: "questStage" as const } : deckOrder.includes(code) ? { zone: "questDeck" as const } : { zone: "victory" as const };
    state = spawn(state, code, placed, code === stage && !layout.faceA ? "B" : "A").state;
  }
  // The deck's order is the order the layout names (the cards were spawned in the scenario's order).
  state = { ...state, questDeck: deckOrder.map((code) => Object.values(state.cards).find((card) => card.code === code && card.zone === "questDeck")?.id ?? "") };
  const current = Object.values(state.cards).find((card) => card.code === stage && card.zone === "questStage");
  if (current) state = updateCard(state, current.id, { progress: layout.progress ?? 0 });
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
  for (const item of layout.attached ?? []) {
    const spawned = spawn(state, item.code, { zone: "play", seat: 0 });
    state = attachTo(spawned.state, spawned.id, item.to === "hero2" ? secondHero.id : first.id);
  }
  for (const id of [first.id, secondHero.id].slice(0, layout.committed ?? 0)) state = updateCard(state, id, { committed: true });
  for (const code of layout.play ?? []) state = spawn(state, code, { zone: "play", seat: 0 }).state;
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  for (const item of layout.staging ?? []) {
    const row = entry(item);
    const spawned = spawn(state, row.code, { zone: "staging" });
    state = updateCard(spawned.state, spawned.id, { progress: row.progress, damage: row.damage, resources: row.resources });
  }
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }, "up").state;
  for (const code of layout.caves ?? []) state = spawn(state, code, { zone: "cavesDeck" }, "down").state;
  for (const row of layout.engaged ?? []) {
    const item = typeof row === "string" ? { code: row, seat: 0 } : row;
    const tokens = entry(item);
    const spawned = spawn(state, tokens.code, { zone: "engaged", seat: "seat" in item ? item.seat : 0 });
    state = updateCard(spawned.state, spawned.id, { damage: tokens.damage, resources: tokens.resources });
  }
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero };
}

export { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../harness/scene-kit.ts";
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function gundabadFight(world: GundabadWorld, shadow: string, enemy: string, layout: GundabadLayout = {}, options: FightOptions<GundabadTable> = {}): Fight<GundabadTable> {
  return fightEnemy((made: GundabadLayout) => gundabadTable(world, made), shadow, enemy, layout, options);
}
