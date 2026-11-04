import { EFFECTS } from "../../../src/effects/index.ts";
import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";

import { loadCampaign, loadScenario, gameCodes } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { addStandIns, answer, codesIn, entry, fightEnemy, finish, HERO, HERO2, HERO3, idOf, idsOf, legalIntents, legalTargets, opening, resolveRecords, sceneEffects, send, start, type Entry, type Fight, type FightOptions, type Run } from "../../harness/scene-kit.ts";

// Shared scene for the Raid on the Grey Havens effect tests (Dream-chaser part 3, campaign card 11182). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The cards are the campaign's (the Campaign Expansion's Calphon), as a campaign game deals them.
export const raid: ScenarioData = loadScenario("raid-on-the-grey-havens");
export const campaign: CampaignData = loadCampaign("dream-chaser");
export const dealt: ScenarioData = campaignScenario(raid);

export const STAGES = ["11036", "11037"] as const;
export const CODES = {
  campaignCard: "11182",
  assault: "11036",
  advance: "11037",
  burn: "11038",
  dreamChaser: "11039",
  arsonist: "11040",
  harbor: "11042",
  piers: "11043",
  pillaged: "11044",
  whiteShip: "11045",
  waveRunner: "11046",
  caravel: "11047",
  torch: "11048",
  fires: "11049",
  umbar: "11064",
  infiltrator: "11065",
  raidLeader: "11066",
  hardened: "11067",
  sahir: "11076",
  sahirAlly: "11077",
  naasiyah: "11078",
  naasiyahAlly: "11079",
  spyglass: "11180",
  blackKey: "11183",
  counselLeadership: "11184",
  counselTactics: "11185",
  counselSpirit: "11186",
  counselLore: "11187",
  graxar: "11188",
  ravager: "11041",
  cutlass: "11189",
  axe: "11190",
  calphon: "110013",
  calphonOriginal: "11028",
  ominousFate: "11176",
  hardMode: "11217",
} as const;
export const AFLAME = [CODES.dreamChaser, CODES.piers, CODES.pillaged, CODES.whiteShip, CODES.waveRunner, CODES.caravel] as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type RaidWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadRaidWorld(): Promise<RaidWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, raid), CODES.ominousFate, CODES.hardMode, CODES.sahirAlly, CODES.naasiyahAlly])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "mild", "corsair", "corsair2", "ship", "raider", "place", "treachery", "heroes", "filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type RaidLayout = {
  seats?: 1 | 2;
  seed?: number;
  stage?: (typeof STAGES)[number];
  progress?: number;
  // The encounter deck (top first), its discard pile, the staging area (the Burn and the Dream-chaser first, unless `bare`), the cards set aside, the victory display.
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly Entry[];
  bare?: boolean;
  setAside?: readonly string[];
  victory?: readonly string[];
  // The cards facedown underneath The Havens Burn.
  under?: readonly string[];
  engaged?: readonly (Entry | { code: string; seat: number; damage?: number; resources?: number })[];
  active?: Entry;
  hand?: readonly string[];
  // The Galdor's Counsel the players chose at the campaign Setup, by seat (ScenarioState.chosenAtSetup), wherever the copies are now.
  chosen?: readonly (readonly [string, number])[];
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: "Quest" | "Encounter" | "Combat" | "Travel" | "Refresh" | "Planning" | "PlayerAttacks";
  threat?: readonly [number, number];
  // Calphon is in play under the first player, with Spyglass and Black Key attached.
  calphon?: boolean;
  campaign?: boolean;
  mode?: "A" | "B";
  // Damage on the first card of each code: [code, damage].
  damage?: readonly (readonly [string, number])[];
};

export type RaidTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null; calphon: string | null; burn: string | null };

export function raidTable(world: RaidWorld, layout: RaidLayout = {}): RaidTable {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "11036";
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
  let burn: string | null = null;
  if (!layout.bare) {
    const placed = spawn(state, CODES.burn, { zone: "staging" });
    burn = placed.id;
    state = spawn(placed.state, CODES.dreamChaser, { zone: "staging" }).state;
  }
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
  if (layout.active) {
    const row = entry(layout.active);
    const spawned = spawn(state, row.code, { zone: "activeLocation" });
    state = updateCard(spawned.state, spawned.id, { progress: row.progress, damage: row.damage });
  }
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  const host = burn ?? Object.values(state.cards).find((card) => card.code === CODES.burn)?.id;
  for (const code of layout.under ?? []) if (host) state = spawn(state, code, { zone: "under", locationId: host }, "down").state;
  let calphon: string | null = null;
  if (layout.calphon) {
    const spawned = spawn(state, CODES.calphon, { zone: "play", seat: 0 }, "up");
    state = spawned.state;
    calphon = spawned.id;
    for (const code of [CODES.spyglass, CODES.blackKey]) {
      const attached = spawn(state, code, { zone: "play", seat: 0 }, "up");
      state = attachTo(attached.state, attached.id, spawned.id);
    }
  }
  for (const [code, damage] of layout.damage ?? []) {
    const id = Object.values(state.cards).find((card) => card.code === code)?.id;
    if (id) state = updateCard(state, id, { damage });
  }
  if (layout.chosen) state = { ...state, chosenAtSetup: layout.chosen.map(([code, seat]) => ({ code, seat })) };
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  if (layout.mode) state = spawn(state, CODES.hardMode, { zone: "modeCard" }, layout.mode).state;
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero, calphon, burn };
}

export { send, start, answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords };
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function raidFight(world: RaidWorld, shadow: string, enemy: string, layout: RaidLayout = {}, options: FightOptions<RaidTable> = {}): Fight<RaidTable> {
  return fightEnemy((made: RaidLayout) => raidTable(world, made), shadow, enemy, layout, options);
}
