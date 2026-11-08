import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { spawn } from "../../../src/rules/core/zones.ts";
import { holdCaptive } from "../../../src/rules/families/uruk/captive.ts";

import { gameCodes, loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { addStandIns, entry, fightEnemy, HERO, HERO2, HERO3, opening, sceneEffects, type Entry, type Fight, type FightOptions, type Run, type ScenePhase } from "../../harness/scene-kit.ts";

// Shared scene for the The Uruk-hai effect tests (the-two-towers part 1, campaign card 143071). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// The pursuit value, the Captives and Grishnákh's hold are state, not layout fields: a table sets `pursuit` and the `captives` the layout names (heroes of the table held under To Isengard!, which joins the staging area when the layout does not name it).
export const hai: ScenarioData = loadScenario("the-uruk-hai");
export const campaign: CampaignData = loadCampaign("the-two-towers");
export const dealt: ScenarioData = campaignScenario(hai);

export const STAGES = ["143069", "143070"] as const;
// Read from data/scenarios/the-uruk-hai.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
  campaignCard: "143071", // The Uruk-hai
  stage1: "143069", // Follow the Orcs
  stage2: "143070", // Rescue the Captives
  grishnakh: "143024", // Grishnákh
  uglukSUrukHai: "143025", // Uglúk's Uruk-hai
  theWold: "143026", // The Wold
  eastemnet: "143027", // Eastemnet
  plainsOfRohan: "143028", // Plains of Rohan
  banksOfEntwash: "143029", // Banks of Entwash
  restByNight: "143030", // Rest by Night?
  strangeWeariness: "143031", // Strange Weariness
  unseenBarrier: "143032", // Unseen Barrier
  isengardUruk: "143063", // Isengard Uruk
  urukHaiFighter: "143064", // Uruk-hai Fighter
  fightingUrukHai: "143065", // Fighting Uruk-hai
  snaga: "143066", // Snaga
  sarumanSOrders: "143067", // Saruman's Orders
  toIsengard: "143022", // To Isengard!
  ugluk: "143023", // Uglúk
  intimidation: "143015", // Intimidation
  handsOfAHealer: "143016", // Hands of a Healer
  forewarned: "143017", // Forewarned
  leaderOfMen: "143018", // Leader of Men
  beyondAllHope: "143019", // Beyond All Hope
} as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type HaiWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadHaiWorld(): Promise<HaiWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, hai)])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type HaiLayout = {
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
  // The heroes held as Captives under To Isengard!: the first seat's second hero, the second seat's hero. The pursuit value the table starts with (10 when To Isengard! or a stage 1 is on the table).
  captives?: readonly ("hero2" | "seat1")[];
  pursuit?: number;
};

export type HaiTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function haiTable(world: HaiWorld, layout: HaiLayout = {}): HaiTable {
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
  if (layout.captives && layout.captives.length > 0) {
    let host = Object.values(state.cards).find((card) => card.code === CODES.toIsengard)?.id;
    if (!host) {
      const placed = spawn(state, CODES.toIsengard, { zone: "staging" });
      state = placed.state;
      host = placed.id;
    }
    for (const which of layout.captives) {
      const heroId = which === "hero2" ? secondHero.id : seat1Hero;
      if (heroId) state = holdCaptive(state, heroId, host);
    }
  }
  state = { ...state, ...(layout.pursuit != null ? { pursuit: layout.pursuit } : {}), ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero };
}

export { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../harness/scene-kit.ts";
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function haiFight(world: HaiWorld, shadow: string, enemy: string, layout: HaiLayout = {}, options: FightOptions<HaiTable> = {}): Fight<HaiTable> {
  return fightEnemy((made: HaiLayout) => haiTable(world, made), shadow, enemy, layout, options);
}
