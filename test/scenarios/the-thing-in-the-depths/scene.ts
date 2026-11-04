import { EFFECTS } from "../../../src/effects/index.ts";
import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";

import { loadCampaign, loadScenario, gameCodes } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { addStandIns, answer, codesIn, enemyCard, entry, fightEnemy, finish, HERO, HERO2, HERO3, idOf, idsOf, legalIntents, legalTargets, opening, resolveRecords, sceneEffects, send, start, type Entry, type Fight, type FightOptions, type Run } from "../../harness/scene-kit.ts";

// Shared scene for The Thing in the Depths effect tests (Dream-chaser part 5, campaign card 11194). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The cards are the campaign's (the Campaign Expansion's reprint of The Thing in the Depths), as a campaign game deals them.
export const depths: ScenarioData = loadScenario("the-thing-in-the-depths");
export const campaign: CampaignData = loadCampaign("dream-chaser");
export const dealt: ScenarioData = campaignScenario(depths);

export const STAGES = ["12039", "12040", "12041"] as const;
export const CODES = {
  campaignCard: "11194",
  takeTheShip: "12039",
  changeOfPlans: "12040",
  defendTheShip: "12041",
  helm: "12042",
  
  forecastle: "12043",
  weatherDeck: "12044",
  cargoHold: "12045",
  crewQuarters: "12046",
  quarterDeck: "12047",
  holdSteady: "12048",
  thing: "110063",
  thingOriginal: "12049",
  eye: "12050",
  thrashing: "12051",
  crushing: "12052",
  grasping: "12053",
  giant: "12054",
  fromTheDepths: "12055",
  lashing: "12056",
  umbar: "11064",
  infiltrator: "11065",
  raidLeader: "11066",
  hardened: "11067",
  sahir: "11076",
  sahirAlly: "11077",
  naasiyah: "11078",
  naasiyahAlly: "11079",
  blackKey: "11183",
  blackKeyBurden: "11192",
  comeTogether: "11195",
  seaSerpent: "11196",
  ominousFate: "11176",
  hardMode: "11217",
  // Core Set ally (Response: after it commits to a quest, 1 progress on each location in the staging area): explores Helm of the Stormcaller from the staging area.
  northernTracker: "01045",
} as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type DepthsWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadDepthsWorld(): Promise<DepthsWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, depths), CODES.ominousFate, CODES.hardMode, CODES.sahirAlly, CODES.naasiyahAlly, CODES.thingOriginal, CODES.blackKeyBurden, CODES.comeTogether, CODES.seaSerpent, CODES.northernTracker])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "mild", "corsair", "corsair2", "ship", "raider"]);
  cards.set("creature", enemyCard("creature", { traits: ["Creature"], threat: 2, engagementCost: 10, attack: 2, defense: 1, health: 3 }));
  cards.set("ship-place", definePrinted({ code: "ship-place", name: "ship-place", type: "location", traits: ["Ship"], threat: 4, questPoints: 3 }));
  addStandIns(cards, ["place", "treachery", "heroes"]);
  // Heroes of the other spheres, for a card that reads the spheres a player controls (Come Together, 11195:A:2 to A:5).
  for (const [code, sphere] of [["hl", "leadership"], ["hs", "spirit"], ["hr", "lore"]] as const) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere, threat: 8, willpower: 2, attack: 2, defense: 2, health: 6 }));
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type DepthsLayout = {
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
  // The enemies grappled with a location: [enemy code, the code of the staging-area location it is grappled with].
  grappled?: readonly (readonly [string, string])[];
  engaged?: readonly (Entry | { code: string; seat: number; damage?: number; resources?: number })[];
  active?: Entry;
  hand?: readonly string[];
  // The Galdor's Counsel the players chose at the campaign Setup, by seat (ScenarioState.chosenAtSetup), wherever the copies are now.
  chosen?: readonly (readonly [string, number])[];
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: "Quest" | "Encounter" | "Combat" | "Travel" | "Refresh" | "Planning" | "PlayerAttacks";
  threat?: readonly [number, number];
  // Captain Sahír (objective ally side) is in play under the first player with Black Key (boon) attached, and Na'asiyah under the last.
  allies?: boolean;
  campaign?: boolean;
  mode?: "A" | "B";
  // Damage on the first card of each code: [code, damage].
  damage?: readonly (readonly [string, number])[];
};

export type DepthsTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null; sahir: string | null };

export function depthsTable(world: DepthsWorld, layout: DepthsLayout = {}): DepthsTable {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "12039";
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
  if (layout.active) {
    const row = entry(layout.active);
    const spawned = spawn(state, row.code, { zone: "activeLocation" });
    state = updateCard(spawned.state, spawned.id, { progress: row.progress, damage: row.damage });
  }
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  for (const [enemy, location] of layout.grappled ?? []) {
    const host = Object.values(state.cards).find((card) => card.code === location && card.zone === "staging")?.id;
    if (host) state = spawn(state, enemy, { zone: "grappled", locationId: host }, "down").state;
  }
  let sahir: string | null = null;
  if (layout.allies) {
    const spawned = spawn(state, CODES.sahirAlly, { zone: "play", seat: 0 }, "up");
    state = spawned.state;
    sahir = spawned.id;
    const attached = spawn(state, CODES.blackKey, { zone: "play", seat: 0 }, "up");
    state = attachTo(attached.state, attached.id, spawned.id);
    state = spawn(state, CODES.naasiyahAlly, { zone: "play", seat: seats - 1 }, "up").state;
  }
  for (const [code, damage] of layout.damage ?? []) {
    const id = Object.values(state.cards).find((card) => card.code === code)?.id;
    if (id) state = updateCard(state, id, { damage });
  }
  if (layout.chosen) state = { ...state, chosenAtSetup: layout.chosen.map(([code, seat]) => ({ code, seat })) };
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  if (layout.mode) state = spawn(state, CODES.hardMode, { zone: "modeCard" }, layout.mode).state;
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero, sahir };
}

export { send, start, answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords };
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function depthsFight(world: DepthsWorld, shadow: string, enemy: string, layout: DepthsLayout = {}, options: FightOptions<DepthsTable> = {}): Fight<DepthsTable> {
  return fightEnemy((made: DepthsLayout) => depthsTable(world, made), shadow, enemy, layout, options);
}
