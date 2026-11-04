import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { spawn } from "../../../src/rules/core/zones.ts";
import { dealDoubleSided, type DoubleSidedCard } from "../../../src/rules/families/uncharted/deal.ts";

import { gameCodes, loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { addStandIns, entry, fightEnemy, HERO, HERO2, HERO3, opening, sceneEffects, type Entry, type Fight, type FightOptions, type Run, type ScenePhase } from "../../harness/scene-kit.ts";

// Shared scene for the The Drowned Ruins effect tests (dream-chaser part 7, campaign card 11200). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// The Grotto deck and the double-sided locations are layout fields (`doubleSided`, `sided`): their two sides are two catalog cards, the shown one in `code` and the other in `other` (dcce.grotto-deck).
export const ruins: ScenarioData = loadScenario("the-drowned-ruins");
export const campaign: CampaignData = loadCampaign("dream-chaser");
export const dealt: ScenarioData = campaignScenario(ruins);

export const STAGES = ["12092", "12093"] as const;
// Read from data/scenarios/the-drowned-ruins.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
  campaignCard: "11200", // The Drowned Ruins
  stage1: "12092", // The Grotto
  stage2: "12093", // Sahír's Betrayal
  seaScorpion: "12096", // Sea-scorpion
  caveEel: "12097", // Cave Eel
  drownedCave: "12104", // Drowned Cave
  powerfulUndertow: "12105", // Powerful Undertow
  intoTheAbyss: "12106", // Into the Abyss
  tanglingAndGrasping: "12107", // Tangling and Grasping
  ancientDepths: "12108", // Ancient Depths
  drownedDead: "11068", // Drowned Dead
  soullessCadaver: "11069", // Soulless Cadaver
  throngsOfUnfaithful: "11070", // Throngs of Unfaithful
  curseOfTheDownfallen: "11071", // Curse of the Downfallen
  shrineToMorgoth: "12094", // Shrine to Morgoth
  captainSahir: "11077", // Captain Sahír
  naAsiyah: "11079", // Na'asiyah
  underseaGrotto: "12098", // Undersea Grotto
  cursedCaverns: "12099", // Cursed Caverns
  waterLoggedHalls: "12100", // Water-logged Halls
  revenant: "11181", // Revenant
  blackKey: "11183", // Black Key
  command: "11201", // Command
  command11202: "11202", // Command
  command11203: "11203", // Command
  command11204: "11204", // Command
  cirdanSBlessing: "11205", // Cirdan's Blessing
  cirdanSBlessing11206: "11206", // Cirdan's Blessing
  cirdanSBlessing11207: "11207", // Cirdan's Blessing
  cirdanSBlessing11208: "11208", // Cirdan's Blessing
} as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type RuinsWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadRuinsWorld(): Promise<RuinsWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.flatMap((card) => (card.back != null ? [card.code, card.back] : [card.code])), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, ruins)])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type RuinsLayout = {
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
  // A location (a code) that is the active location.
  active?: string;
  engaged?: readonly (Entry | { code: string; seat: number; damage?: number; resources?: number })[];
  // The Grotto deck (top first) and the Underwater side of a Grotto card set aside (the Shrine), as the start deals them.
  doubleSided?: readonly DoubleSidedCard[];
  // Double-sided locations already placed, `code` the side shown and `back` the other.
  sided?: readonly { code: string; back: string; zone: "staging" | "activeLocation"; progress?: number }[];
  hand?: readonly string[];
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: ScenePhase;
  threat?: readonly [number, number];
  // The campaign card is on the table (a campaign game), as the Campaign Setup leaves it.
  campaign?: boolean;
};

export type RuinsTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function ruinsTable(world: RuinsWorld, layout: RuinsLayout = {}): RuinsTable {
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
  if (layout.doubleSided) state = dealDoubleSided(state, layout.doubleSided, ctx);
  for (const row of layout.sided ?? []) {
    const spawned = spawn(state, row.code, { zone: row.zone });
    state = updateCard(spawned.state, spawned.id, { other: row.back, progress: row.progress ?? 0 });
  }
  // A Grotto location placed by hand has its code among the deck's, as it has in a game whose deck is dealt with every copy (cards of the Grotto deck are shuffled back into it when they would be discarded).
  const placed = (layout.sided ?? []).flatMap((row) => [row.code, row.back]).filter((code) => ctx.cards.get(code)?.traits.includes("Grotto"));
  if (placed.length > 0) state = { ...state, uncharted: { deck: state.uncharted?.deck ?? [], ...state.uncharted, codes: [...new Set([...(state.uncharted?.codes ?? []), ...placed])] } };
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
export function ruinsFight(world: RuinsWorld, shadow: string, enemy: string, layout: RuinsLayout = {}, options: FightOptions<RuinsTable> = {}): Fight<RuinsTable> {
  return fightEnemy((made: RuinsLayout) => ruinsTable(world, made), shadow, enemy, layout, options);
}
