import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { spawn } from "../../../src/rules/core/zones.ts";

import { gameCodes, loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { TREASURES } from "../the-withered-heath/scene.ts";
import { addStandIns, entry, fightEnemy, HERO, HERO2, HERO3, opening, sceneEffects, send, type Entry, type Fight, type FightOptions, type Run, type ScenePhase } from "../../harness/scene-kit.ts";

// Shared scene for the The Ghost of Framsburg effect tests (ered-mithrin part 7, campaign card 12189). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// The Loot objectives the players control are claimed the way the engine claims them (`withLoot`): spawned free in the staging area, the first player attaches each to a hero. The Discover keyword and Loot (emce.discover, emce.loot) need no layout field of their own: a location
// with the keyword is staged and traveled to, and the cards it looks at are the top of the `deck`.
export const framsburg: ScenarioData = loadScenario("the-ghost-of-framsburg");
export const campaign: CampaignData = loadCampaign("ered-mithrin");
export const dealt: ScenarioData = campaignScenario(framsburg);

// What the first six parts leave in the pool (the boon allies, the burdens, the Accolade boons, Misplaced Trust and Urdug's Cunning) and the cards of their sets a pool tally may add.
export const EARLIER_POOL = ["12166", "12167", "12169", "12171", "12172", "12173", "12174", "12176", "12177", "12178", "12179", "12180", "12181", "12182", "12183", "12184", "12185", "12186", "12188", "18046"] as const;

export const STAGES = ["19109", "19110", "19111"] as const;
// Read from data/scenarios/the-ghost-of-framsburg.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
  campaignCard: "12189", // The Ghost of Framsburg
  stage1: "19109", // The Haunted Keep
  stage2: "19110", // Searching the Ruins
  stage3: "19111", // The Cursed Shade
  cryptKey: "19094", // Crypt Key
  oldLantern: "19095", // Old Lantern
  scathaSTeeth: "19096", // Scatha's Teeth
  framSShade: "19098", // Fram's Shade
  cryptStalker: "19099", // Crypt Stalker
  evilSpectre: "19100", // Evil Spectre
  forgottenCrypt: "19101", // Forgotten Crypt
  hauntedHall: "19102", // Haunted Hall
  hiddenStaircase: "19103", // Hidden Staircase
  moonlitPassage: "19104", // Moonlit Passage
  cursedTower: "19105", // Cursed Tower
  abandonedRuins: "19106", // Abandoned Ruins
  terribleShadows: "19107", // Terrible Shadows
  slammedShut: "19108", // Slammed Shut
  werewolf: "18051", // Werewolf
  giantSpider: "18052", // Giant Spider
  blackBats: "18053", // Black Bats
  afraidOfTheDark: "18048", // Afraid of the Dark
  eyesInTheDark: "18057", // Eyes in the Dark
  theCursedTomb: "19097", // The Cursed Tomb
  ashenBrazier: "12190", // Ashen Brazier
  gundabadHunter: "12191", // Gundabad Hunter
  gundabadStalker: "12192", // Gundabad Stalker
} as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type FramsburgWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadFramsburgWorld(): Promise<FramsburgWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  // The treasures a record that draws a random one (AttachRandomTreasure, 12189:B:2) draws from.
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...TREASURES, ...EARLIER_POOL, ...gameCodes(campaign, framsburg)])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type FramsburgLayout = {
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

export type FramsburgTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function framsburgTable(world: FramsburgWorld, layout: FramsburgLayout = {}): FramsburgTable {
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

/** The Loot objectives with these codes are claimed by the first player and attached to `hero` (the first hero by default): the table as it is when the players control them. */
export function withLoot(made: FramsburgTable, codes: readonly string[], hero: string = made.hero): FramsburgTable {
  let state = made.state;
  for (const code of codes) {
    const spawned = spawn(state, code, { zone: "staging" });
    const freed = settle({ ...spawned.state, window: null, mode: "stopped" }, made.ctx, []);
    if (freed.window?.kind !== "choose") throw new Error(`${code} was not offered to a hero: ${JSON.stringify(freed.window)}`);
    const claimed = send({ state: freed, steps: [] }, { type: "Choose", optionId: hero }, made.ctx);
    state = { ...claimed.state, window: made.state.window, mode: made.state.mode, stack: [] };
  }
  return { ...made, state: syncConstants(state, made.ctx) };
}

export { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../harness/scene-kit.ts";
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function framsburgFight(world: FramsburgWorld, shadow: string, enemy: string, layout: FramsburgLayout = {}, options: FightOptions<FramsburgTable> = {}): Fight<FramsburgTable> {
  return fightEnemy((made: FramsburgLayout) => framsburgTable(world, made), shadow, enemy, layout, options);
}
