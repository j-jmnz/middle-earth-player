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

// Shared scene for the Lost in Mirkwood effect tests (ered-mithrin part 2, campaign card 12168). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// TODO: describe the cards that need their own layout fields (a second active location, a grotto deck, an island map) and add them to the layout and the table below.
export const lostmirk: ScenarioData = loadScenario("lost-in-mirkwood");
export const campaign: CampaignData = loadCampaign("ered-mithrin");
export const dealt: ScenarioData = campaignScenario(lostmirk);

export const STAGES = ["18071", "18072", "18073", "18074", "18075", "18076", "18077"] as const;
// Read from data/scenarios/lost-in-mirkwood.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
  campaignCard: "12168", // Lost in Mirkwood
  stage1: "18071", // Ambushed at Night
  stage2: "18072", // Spiders of Mirkwood
  stage3: "18073", // Dol Guldur Orcs
  stage4: "18074", // Carried Away
  stage5: "18075", // Truly Lost
  stage6: "18076", // The Forest of Great Fear
  stage7: "18077", // Escape from Taur-nu-fuin
  overgrownPath: "18029", // Overgrown Path
  abandonedVillage: "18030", // Abandoned Village
  bareHilltop: "18031", // Bare Hilltop
  forestClearing: "18032", // Forest Clearing
  twilightHall: "18033", // Twilight Hall
  mirkwoodPatrol: "18034", // Mirkwood Patrol
  ravenousSpider: "18035", // Ravenous Spider
  unseenDanger: "18036", // Unseen Danger
  vastnessOfMirkwood: "18037", // Vastness of Mirkwood
  accursedForest: "18038", // Accursed Forest
  darkBlackWoods: "18039", // Dark Black Woods
  gatheringGloom: "18040", // Gathering Gloom
  swarmOfBats: "18041", // Swarm of Bats
  eastBightPatrol: "01097", // East Bight Patrol
  blackForestBats: "01098", // Black Forest Bats
  oldForestRoad: "01099", // Old Forest Road
  forestGate: "01100", // Forest Gate
  searchingForAWayOut: "18028", // Searching for a Way Out
  forestSpider: "01096", // Forest Spider
  haldan: "18070", // Haldan
  kingSpider: "01074", // King Spider
  hummerhorns: "01075", // Hummerhorns
  ungoliantSSpawn: "01076", // Ungoliant's Spawn
  greatForestWeb: "01077", // Great Forest Web
  mountainsOfMirkwood: "01078", // Mountains of Mirkwood
  eyesOfTheForest: "01079", // Eyes of the Forest
  caughtInAWeb: "01080", // Caught in a Web
  dolGuldurOrcs: "01089", // Dol Guldur Orcs
  chieftanUfthak: "01090", // Chieftan Ufthak
  dolGuldurBeastmaster: "01091", // Dol Guldur Beastmaster
  drivenByShadow: "01092", // Driven by Shadow
  theNecromancerSReach: "01093", // The Necromancer's Reach
  necromancerSPass: "01094", // Necromancer's Pass
  enchantedStream: "01095", // Enchanted Stream
  melanwar: "12169", // Melanwar
} as const;
// The nine treasures of the Ered Mithrin box (emce.treasure): the pool a random draw is made from.
export const TREASURES = ["12196", "12197", "12198", "12199", "12200", "12201", "12202", "12203", "12204"] as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type LostmirkWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadLostmirkWorld(): Promise<LostmirkWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...TREASURES, ...gameCodes(campaign, lostmirk)])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type LostmirkLayout = {
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
  // The two encounter sets the quest swaps in (emce.setup-lost-in-mirkwood), top first.
  spiders?: readonly string[];
  orcs?: readonly string[];
  engaged?: readonly (Entry | { code: string; seat: number; damage?: number; resources?: number })[];
  hand?: readonly string[];
  deckOf?: readonly string[];
  play?: readonly string[];
  active?: string;
  phase?: ScenePhase;
  threat?: readonly [number, number];
  // The campaign card is on the table (a campaign game), as the Campaign Setup leaves it.
  campaign?: boolean;
};

export type LostmirkTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function lostmirkTable(world: LostmirkWorld, layout: LostmirkLayout = {}): LostmirkTable {
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
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
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
  if (layout.spiders || layout.orcs) {
    state = { ...state, piles: { ...state.piles, spidersDeck: [], orcsDeck: [] } };
    for (const code of layout.spiders ?? []) state = spawn(state, code, { zone: "spidersDeck" }, "down").state;
    for (const code of layout.orcs ?? []) state = spawn(state, code, { zone: "orcsDeck" }, "down").state;
  }
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero };
}

export { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../harness/scene-kit.ts";
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function lostmirkFight(world: LostmirkWorld, shadow: string, enemy: string, layout: LostmirkLayout = {}, options: FightOptions<LostmirkTable> = {}): Fight<LostmirkTable> {
  return fightEnemy((made: LostmirkLayout) => lostmirkTable(world, made), shadow, enemy, layout, options);
}
