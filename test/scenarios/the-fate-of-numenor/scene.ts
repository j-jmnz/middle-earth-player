import { EFFECTS } from "../../../src/effects/index.ts";
import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { dealUnchartedDeck } from "../../../src/rules/families/uncharted/deal.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";

import { loadCampaign, loadScenario, gameCodes } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { addStandIns, allyCard, answer, codesIn, enemyCard, fightEnemy, finish, HERO, HERO2, HERO3, idOf, idsOf, legalIntents, legalTargets, opening, resolveRecords, sceneEffects, send, start, type Fight, type FightOptions, type Run } from "../../harness/scene-kit.ts";

// Shared scene for the Fate of Númenor effect tests (Dream-chaser part 2, campaign card 11179). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes
// from the scenario's records and the engine. The cards are the campaign's (the Campaign Expansion's Calphon), as a campaign game deals them.
export const fate: ScenarioData = loadScenario("the-fate-of-numenor");
export const campaign: CampaignData = loadCampaign("dream-chaser");
export const dealt: ScenarioData = campaignScenario(fate);

export const STAGES = ["11025", "11026"] as const;
export const CODES = {
  campaignCard: "11179",
  explore: "11025",
  discovery: "11026",
  shrine: "11027",
  calphon: "110013",
  calphonOriginal: "11028",
  servant: "11029",
  lushJungle: "11030",
  forbiddenCoast: "11031",
  steepPlateau: "11032",
  fog: "11033",
  malevolence: "11034",
  ruins: "11035",
  drownedDead: "11068",
  cadaver: "11069",
  throngs: "11070",
  curse: "11071",
  floodedRuins: "11072",
  drownedGraves: "11073",
  cursedTemple: "11074",
  wandering: "11075",
  spyglass: "11180",
  revenant: "11181",
  ominousFate: "11176",
  hardMode: "11217",
} as const;
// The double-sided locations: the real side's code is the card's code, and the Lost Island side is its side B.
export const DOUBLE_SIDED = [CODES.shrine, CODES.lushJungle, CODES.forbiddenCoast, CODES.floodedRuins, CODES.drownedGraves, CODES.cursedTemple] as const;
export { HERO, HERO2, HERO3 };

const SCENE_EFFECTS = sceneEffects();

export type FateWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadFateWorld(): Promise<FateWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, fate), CODES.calphonOriginal, CODES.ominousFate, CODES.hardMode])];
  const cards = new Map(await loadPrinted(codes));
  // Player cards of printed costs 0 to 5, for the cards that read the printed cost of a card from a deck or a hand.
  addStandIns(cards, ["f0", "f3", "mild", "undead", "heroes", "filler", "place"], [0, 1, 2, 3, 5]);
  cards.set("brute", enemyCard("brute", { threat: 1, engagementCost: 10, attack: 9, defense: 1, health: 20 }));
  // 8 Attack against a hero's 2 Defense is 6 damage: exactly the hit points of a hero with none lost.
  cards.set("bruiser", enemyCard("bruiser", { threat: 1, engagementCost: 10, attack: 8, defense: 1, health: 20 }));
  cards.set("undead2", enemyCard("undead2", { traits: ["Undead"], threat: 2, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  cards.set("archer", allyCard("archer", 3, { attack: 2, health: 3, keywords: { ranged: true } }));
  for (const cost of [1, 2, 3]) cards.set(`ally${cost}`, allyCard(`ally${cost}`, cost));
  cards.set("blade", definePrinted({ code: "blade", name: "blade", type: "attachment", sphere: "neutral", cost: 3 }));
  return { definition, cards };
}

/** A card of the staging area or another zone: a code, or a code with the side it lies on and its tokens. */
export type Entry = string | { code: string; face?: "up" | "B"; progress?: number; exhausted?: boolean };
const entry = (item: Entry): { code: string; face: "up" | "B"; progress: number; exhausted: boolean } => (typeof item === "string" ? { code: item, face: "up", progress: 0, exhausted: false } : { code: item.code, face: item.face ?? "up", progress: item.progress ?? 0, exhausted: item.exhausted ?? false });

export type FateLayout = {
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
  // The Uncharted deck, top first, each card Lost Island side up. Absent: the game has none.
  uncharted?: readonly string[];
  engaged?: readonly { code: string; seat: number }[];
  active?: Entry;
  // The cards in the first hand of each seat and in each seat's deck (top first; the last is the bottom card).
  hand?: readonly string[];
  deckOf?: readonly string[];
  // Cards in play under the first seat (allies).
  play?: readonly string[];
  phase?: "Quest" | "Encounter" | "Combat" | "Travel" | "Refresh" | "Planning";
  threat?: readonly [number, number];
  // Calphon is in play under the first player, on this side; Spyglass is attached to him.
  calphon?: "up" | "B" | "original";
  spyglass?: "up" | "B";
  // The campaign card is in the game (Campaign Mode), holding this many resources; the Hard/Expert Mode card in play on this side.
  campaign?: boolean;
  campaignResources?: number;
  mode?: "A" | "B";
  // Damage on the first card of each code: [code, damage].
  damage?: readonly (readonly [string, number])[];
  // The records that name these ledger lines are left out of the table's effects (a test run again without the records of its line).
  without?: readonly string[];
};

export type FateTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null; calphon: string | null };

export function fateTable(world: FateWorld, layout: FateLayout = {}): FateTable {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "11025";
  const without = layout.without ?? [];
  const ctx: ReduceContext = { effects: without.length === 0 ? SCENE_EFFECTS : SCENE_EFFECTS.filter((effect) => !effect.lines.some((line) => without.includes(line))), cards: world.cards };
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
  state = withThreat(state, 0, layout.threat?.[0] ?? 28);
  if (seats === 2) state = withThreat(state, 1, layout.threat?.[1] ?? 26);
  for (let seat = 0; seat < seats; seat += 1) {
    for (const code of layout.hand ?? []) state = spawn(state, code, { zone: "hand", seat }).state;
    for (const code of layout.deckOf ?? []) state = spawn(state, code, { zone: "deck", seat }, "down").state;
  }
  for (const code of layout.play ?? []) state = spawn(state, code, { zone: "play", seat: 0 }).state;
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  if (layout.uncharted) state = dealUnchartedDeck(state, layout.uncharted, ctx);
  for (const item of layout.staging ?? []) {
    const row = entry(item);
    const spawned = spawn(state, row.code, { zone: "staging" }, row.face);
    state = updateCard(spawned.state, spawned.id, { progress: row.progress, exhausted: row.exhausted });
  }
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }, code === CODES.shrine ? "B" : "up").state;
  for (const row of layout.engaged ?? []) state = spawn(state, row.code, { zone: "engaged", seat: row.seat }).state;
  if (layout.active) {
    const row = entry(layout.active);
    const spawned = spawn(state, row.code, { zone: "activeLocation" }, row.face);
    state = updateCard(spawned.state, spawned.id, { progress: row.progress });
  }
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  let calphon: string | null = null;
  if (layout.calphon) {
    const code = layout.calphon === "original" ? CODES.calphonOriginal : CODES.calphon;
    const spawned = spawn(state, code, { zone: "play", seat: 0 }, layout.calphon === "B" ? "B" : "up");
    state = spawned.state;
    calphon = spawned.id;
    if (layout.spyglass) {
      const glass = spawn(state, CODES.spyglass, { zone: "play", seat: 0 }, layout.spyglass === "B" ? "B" : "up");
      state = attachTo(glass.state, glass.id, spawned.id);
    }
  }
  for (const [code, damage] of layout.damage ?? []) {
    const id = Object.values(state.cards).find((card) => card.code === code)?.id;
    if (id) state = updateCard(state, id, { damage });
  }
  if (layout.campaign) {
    const spawned = spawn(state, CODES.campaignCard, { zone: "campaign" });
    state = updateCard(spawned.state, spawned.id, { resources: layout.campaignResources ?? 0 });
  }
  if (layout.mode) state = spawn(state, CODES.hardMode, { zone: "modeCard" }, layout.mode).state;
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero, calphon };
}

export { send, start, answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords };
export type { Run, PlayerIntent };

/** The card's When Revealed records resolve now, in the quest phase (the way a reveal resolves them), and the look windows and choices they open are answered. */
export function resolveReveal(state: ScenarioState, ctx: ReduceContext, code: string, pick?: (state: ScenarioState) => string): Run & { id: string } {
  return resolveRecords(state, ctx, code, "whenRevealed", undefined, pick, false);
}

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function fateFight(world: FateWorld, shadow: string, enemy: string, layout: FateLayout = {}, options: FightOptions<FateTable> = {}): Fight<FateTable> {
  return fightEnemy((made: FateLayout) => fateTable(world, made), shadow, enemy, layout, options);
}
