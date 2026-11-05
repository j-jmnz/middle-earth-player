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

// Shared scene for the The City of Corsairs effect tests (dream-chaser part 9, campaign card 11215). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// The layout needs no field of its own: the Corsair deck, the second encounter deck and the set aside Black Sword and Captain Sahír are dealt with `deck`, `setAside` and `staging`, and the tests that read them put the cards there.
export const corsairs: ScenarioData = loadScenario("the-city-of-corsairs");
export const campaign: CampaignData = loadCampaign("dream-chaser");
export const dealt: ScenarioData = campaignScenario(corsairs);

export const STAGES = ["12147", "12148", "12149", "12150"] as const;
// Read from data/scenarios/the-city-of-corsairs.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
  campaignCard: "11215", // The City of Corsairs
  stage1: "12147", // The Coast of Umbar
  stage2: "12148", // Fate of the Dream-chaser
  stage3: "12149", // The Haven of Umbar
  stage4: "12150", // Final Confrontation
  slaveShip: "12152", // Slave Ship
  corsairWaters: "12155", // Corsair Waters
  watchTower: "12156", // Watch Tower
  serpentSTail: "12157", // Serpent's Tail
  roughWaters: "11053", // Rough Waters
  waterspout: "11054", // Waterspout
  suddenStorms: "11055", // Sudden Storms
  windsOfWrath: "11056", // Winds of Wrath
  lightCruiser: "11057", // Light Cruiser
  corsairWarship: "11058", // Corsair Warship
  boardingParty: "11059", // Boarding Party
  scoutingShip: "11022", // Scouting Ship
  starlitSea: "11023", // Starlit Sea
  fogBank: "11024", // Fog Bank
  battleHardened: "11067", // Battle-Hardened
  stormcaller: "12151", // Stormcaller
  southernBelfalas: "12154", // Southern Belfalas
  duskbringer: "110138", // Duskbringer
  glorinaith: "110139", // Glórinaith
  dreamChaser: "11080", // Dream-chaser
  dawnStar: "11081", // Dawn Star
  narelenya: "11082", // Nárelenya
  silverWing: "11083", // Silver Wing
  navigation: "11084", // Navigation
  umbarSlaver: "12153", // Umbar Slaver
  umbarRaider: "11064", // Umbar Raider
  corsairInfiltrator: "11065", // Corsair Infiltrator
  raidLeader: "11066", // Raid Leader
  captainSahir: "12158", // Captain Sahír
  theShatteredMonument: "12159", // The Shattered Monument
  streetsOfUmbar: "12160", // Streets of Umbar
  cityOfCorsairs: "12161", // City of Corsairs
  umbarHarbor: "12162", // Umbar Harbor
  foesOfEcthelion: "12163", // Foes of Ecthelion
  umbarPatrol: "12164", // Umbar Patrol
  furyAndMalice: "12165", // Fury and Malice
  armorPlating: "11172", // Armor Plating
  ballista: "11173", // Ballista
  enlargedQuarters: "11174", // Enlarged Quarters
  extraSails: "11175", // Extra Sails
  thunderstruck: "11177", // Thunderstruck
  crowley: "11178", // Crowley
  blackKey: "11192", // Black Key
  calaerion: "11193", // Calaerion
  cirdanSBlessing: "11205", // Cirdan's Blessing
  cirdanSBlessing11206: "11206", // Cirdan's Blessing
  cirdanSBlessing11207: "11207", // Cirdan's Blessing
  cirdanSBlessing11208: "11208", // Cirdan's Blessing
  gavin: "11210", // Gavin
  sendForHelp: "11211", // Send for Help
  sendForHelp11212: "11212", // Send for Help
  sendForHelp11213: "11213", // Send for Help
  sendForHelp11214: "11214", // Send for Help
  theBlackSword: "11216", // The Black Sword
} as const;
export const SHIP_CODES: readonly string[] = ["110136", "110137", "110138", "110139", "110140", "110141"];
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type CorsairsWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadCorsairsWorld(): Promise<CorsairsWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, corsairs)])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type CorsairsLayout = {
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
};

export type CorsairsTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function corsairsTable(world: CorsairsWorld, layout: CorsairsLayout = {}): CorsairsTable {
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
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero };
}

export { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../harness/scene-kit.ts";
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function corsairsFight(world: CorsairsWorld, shadow: string, enemy: string, layout: CorsairsLayout = {}, options: FightOptions<CorsairsTable> = {}): Fight<CorsairsTable> {
  return fightEnemy((made: CorsairsLayout) => corsairsTable(world, made), shadow, enemy, layout, options);
}
