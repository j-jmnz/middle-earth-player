import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { spawn } from "../../../src/rules/core/zones.ts";

import { gameCodes, loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { addStandIns, entry, fightEnemy, finish, send, start, HERO, HERO2, HERO3, opening, sceneEffects, type Entry, type Fight, type FightOptions, type Run, type ScenePhase } from "../../harness/scene-kit.ts";

// Shared scene for the Journey Up the Anduin effect tests (ered-mithrin part 1, campaign card 120165). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// TODO: describe the cards that need their own layout fields (a second active location, a grotto deck, an island map) and add them to the layout and the table below.
export const upanduin: ScenarioData = loadScenario("journey-up-the-anduin");
export const campaign: CampaignData = loadCampaign("ered-mithrin");
export const dealt: ScenarioData = campaignScenario(upanduin);

export const STAGES = ["18066", "18067", "18068"] as const;
// Read from data/scenarios/journey-up-the-anduin.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
  campaignCard: "120165", // Journey Up the Anduin
  stage1: "18066", // Traveling North
  stage2: "18067", // Woodmen Under Attack
  stage3: "18068", // The Passage of the Ford
  woodedRiverbank: "18017", // Wooded Riverbank
  frenziedCreature: "18018", // Frenzied Creature
  dangerousCrossing: "18019", // Dangerous Crossing
  goblinTroop: "18020", // Goblin Troop
  strayGoblin: "18021", // Stray Goblin
  packOfWargs: "18022", // Pack of Wargs
  hillsOfWilderland: "18023", // Hills of Wilderland
  lonelyLands: "18024", // Lonely Lands
  ruinedSupplies: "18025", // Ruined Supplies
  lostInTheWild: "18026", // Lost in the Wild
  weighedDown: "18027", // Weighed Down
  mistyMountainGoblins: "01111", // Misty Mountain Goblins
  massingAtNight: "01112", // Massing at Night
  banksOfTheAnduin: "01113", // Banks of the Anduin
  gladdenFields: "01114", // Gladden Fields
  theOldFord: "18016", // The Old Ford
  woodmenVillage: "18069", // Woodmen Village
  wolfRider: "01081", // Wolf Rider
  hillTroll: "01082", // Hill Troll
  goblinSniper: "01083", // Goblin Sniper
  marshAdder: "01084", // Marsh Adder
  wargs: "01085", // Wargs
  turayn: "12166", // Turayn
  aGrowingThreat: "12167", // A Growing Threat
  haldan: "18070", // Haldan, the back of Woodmen Village
} as const;
// The nine treasures of the Ered Mithrin box (emce.treasure): the pool a random draw is made from.
export const TREASURES = ["12196", "12197", "12198", "12199", "12200", "12201", "12202", "12203", "12204"] as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type UpanduinWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadUpanduinWorld(): Promise<UpanduinWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, CODES.haldan, ...TREASURES, ...gameCodes(campaign, upanduin)])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type UpanduinLayout = {
  seats?: 1 | 2;
  seed?: number;
  stage?: (typeof STAGES)[number];
  progress?: number;
  // The encounter deck (top first), its discard pile, the staging area, the cards set aside, the victory display.
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly Entry[];
  // The active location.
  active?: string;
  setAside?: readonly string[];
  victory?: readonly string[];
  // The Evil Creatures deck (top first) and its discard pile (emce.evil-creatures-deck); the deck exists in the table only when a layout lists it.
  evilCreatures?: readonly string[];
  evilDiscard?: readonly string[];
  engaged?: readonly (Entry | { code: string; seat: number; damage?: number; resources?: number })[];
  hand?: readonly string[];
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: ScenePhase;
  threat?: readonly [number, number];
  // The campaign card is on the table (a campaign game), as the Campaign Setup leaves it.
  campaign?: boolean;
};

export type UpanduinTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function upanduinTable(world: UpanduinWorld, layout: UpanduinLayout = {}): UpanduinTable {
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
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }, "up").state;
  for (const row of layout.engaged ?? []) {
    const item = typeof row === "string" ? { code: row, seat: 0 } : row;
    const tokens = entry(item);
    const spawned = spawn(state, tokens.code, { zone: "engaged", seat: "seat" in item ? item.seat : 0 });
    state = updateCard(spawned.state, spawned.id, { damage: tokens.damage, resources: tokens.resources });
  }
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  if (layout.evilCreatures || layout.evilDiscard) {
    state = { ...state, piles: { ...state.piles, evilCreaturesDeck: [], evilCreaturesDiscard: [] } };
    for (const code of layout.evilCreatures ?? []) state = spawn(state, code, { zone: "evilCreaturesDeck" }, "down").state;
    for (const code of layout.evilDiscard ?? []) state = spawn(state, code, { zone: "evilCreaturesDiscard" }).state;
  }
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero };
}

export { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../harness/scene-kit.ts";
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function upanduinFight(world: UpanduinWorld, shadow: string, enemy: string, layout: UpanduinLayout = {}, options: FightOptions<UpanduinTable> = {}): Fight<UpanduinTable> {
  return fightEnemy((made: UpanduinLayout) => upanduinTable(world, made), shadow, enemy, layout, options);
}

/** The staging step: every seat passes the quest commit step, and the encounter deck reveals its top card for each player (rr.step-3-3); a Surge card reveals one more. The choices it opens are answered by `pick` (the first option by default). */
export function upanduinReveal(table: UpanduinTable, pick?: (state: ScenarioState) => string): Run {
  let run: Run = start(table.state);
  for (let seat = 0; seat < table.state.seatCount; seat += 1) run = send(run, { type: "Pass" }, table.ctx);
  return finish(run, table.ctx, pick);
}
