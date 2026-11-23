import { EFFECTS } from "../../../src/effects/index.ts";
import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";
import { setActive, syncIsland } from "../../../src/rules/families/island/map.ts";

import { loadCampaign, loadScenario, gameCodes } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { addStandIns, answer, codesIn, entry, fightEnemy, finish, HERO, HERO2, HERO3, idOf, idsOf, legalIntents, legalTargets, opening, resolveRecords, sceneEffects, send, start, type Entry, type Fight, type FightOptions, type Run } from "../../harness/scene-kit.ts";

// Shared scene for the Temple of the Deceived tests (Dream-chaser part 6, campaign card 11197). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from the scenario's
// records and the engine. The cards are the campaign's (the Campaign Expansion's reprints of Temple Guardian and Gate Key), as a campaign game deals them; the Island Map is laid out cell by cell.
export const temple: ScenarioData = loadScenario("temple-of-the-deceived");
export const campaign: CampaignData = loadCampaign("dream-chaser");
export const dealt: ScenarioData = campaignScenario(temple);

export const CODES = {
  campaignCard: "11197",
  searching: "12067",
  grotto: "12068",
  halls: "12069",
  guardian: "110077",
  guardianOriginal: "12070",
  gateKey: "110078",
  gateKeyOriginal: "12071",
  jaggedCliffs: "12072",
  windingCaverns: "12073",
  junglePath: "12074",
  desecrator: "12075",
  watcher: "12076",
  profane: "12077",
  deeper: "12078",
  rainstorm: "12079",
  dwindling: "12080",
  sunken: "12081",
  floodedRuins: "11072",
  drownedGraves: "11073",
  cursedTemple: "11074",
  aimless: "11075",
  drownedDead: "11068",
  spyglass: "11180",
  revenant: "11181",
  blackKey: "11183",
  starla: "11198",
  nightmare: "11199",
  sahirAlly: "11077",
  naasiyahAlly: "11079",
  ominousFate: "11176",
  hardMode: "11217",
  // Core Set ally (Response: after it commits to a quest, 1 progress on each location in the staging area).
  northernTracker: "01045",
} as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type TempleWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadTempleWorld(): Promise<TempleWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, temple), CODES.ominousFate, CODES.hardMode, CODES.sahirAlly, CODES.naasiyahAlly, CODES.guardianOriginal, CODES.gateKeyOriginal, CODES.northernTracker])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "mild", "undead", "place", "treachery", "heroes", "filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

/** The default Island Map of a table: fifteen cells in rows of five, the first four columns Lost Islands and the last the Temple column. A code with a leading "?" lies Uncharted side up (Lost Island, or Temple of the Deceived), its real side facedown. */
export const MAP: readonly string[] = [
  "?12072", "?12073", "?12074", "?11072", "?12068",
  "?11073", "?11074", "?12072", "?12073", "?12069",
  "?12074", "?11072", "?11073", "?11074", "?12069",
];

export type TempleLayout = {
  seats?: 1 | 2;
  seed?: number;
  progress?: number;
  // The encounter deck (top first), its discard pile, the staging area, the cards set aside, the victory display.
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly Entry[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly (Entry | { code: string; seat: number; damage?: number; resources?: number })[];
  // The fifteen cells of the Island Map, row by row ("?" for Uncharted side up), and the index of the active one (0 to 14). With no `map` there is none.
  map?: readonly string[] | true;
  at?: number;
  // The cells at these indexes have been traveled from (explored).
  explored?: readonly number[];
  // Progress on the cell at this index.
  cellProgress?: readonly (readonly [number, number])[];
  // The codes of the secrets under the Temple column's cells, top to bottom ("" for none).
  secrets?: readonly string[];
  hand?: readonly string[];
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: "Quest" | "Encounter" | "Combat" | "Travel" | "Refresh" | "Planning" | "PlayerAttacks";
  threat?: readonly [number, number];
  // Captain Sahír (objective ally side) is in play under the first player with Black Key (boon) attached, and Na'asiyah under the last.
  allies?: boolean;
  // Gate Key is attached to Temple Guardian (in staging), or claimed by the first hero ("hero"), or lies in the staging area ("free").
  key?: "guard" | "hero" | "free";
  campaign?: boolean;
  mode?: "A" | "B";
  // Damage on the first card of each code: [code, damage].
  damage?: readonly (readonly [string, number])[];
  // The records that name these ledger lines are left out of the table's effects (a test run again without the records of its line).
  without?: readonly string[];
};

export type TempleTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null; cells: readonly string[] };

export function templeTable(world: TempleWorld, layout: TempleLayout = {}): TempleTable {
  const seats = layout.seats ?? 1;
  const without = layout.without ?? [];
  const ctx: ReduceContext = { effects: without.length === 0 ? SCENE_EFFECTS : SCENE_EFFECTS.filter((effect) => !effect.lines.some((line) => without.includes(line))), cards: world.cards };
  let state = blankScenario({ seatCount: seats, seed: layout.seed ?? 3, definition: world.definition });
  const quest = spawn(state, CODES.searching, { zone: "questStage" }, "B");
  state = updateCard(quest.state, quest.id, { progress: layout.progress ?? 0 });
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
  // The Island Map: every cell in the map, then the active one, and the staging area follows it.
  let cells: string[] = [];
  if (layout.map) {
    const codes = layout.map === true ? MAP : layout.map;
    const double = [...world.cards.values()].filter((printed) => printed.keywords.uncharted).map((printed) => printed.code);
    state = { ...state, uncharted: { deck: [], codes: double } };
    for (const text of codes) {
      const down = text.startsWith("?");
      const spawned = spawn(state, down ? text.slice(1) : text, { zone: "islandMap" }, down ? "B" : "A");
      state = spawned.state;
      cells.push(spawned.id);
    }
    const uncharted = state.uncharted;
    if (uncharted) state = { ...state, uncharted: { ...uncharted, island: { cells, ...(layout.explored ? { explored: layout.explored.flatMap((at) => (cells[at] ? [cells[at]] : [])) } : {}) } } };
    for (const [at, progress] of layout.cellProgress ?? []) {
      const id = cells[at];
      if (id) state = updateCard(state, id, { progress });
    }
    state = setActive(state, cells[layout.at ?? 0]);
    const under = layout.secrets ?? [];
    [4, 9, 14].forEach((index, row) => {
      const code = under[row];
      const host = cells[index];
      if (code && host) state = spawn(state, code, { zone: "under", locationId: host }, "down").state;
    });
  }
  if (layout.allies) {
    const spawned = spawn(state, CODES.sahirAlly, { zone: "play", seat: 0 }, "up");
    state = spawned.state;
    const attached = spawn(state, CODES.blackKey, { zone: "play", seat: 0 }, "up");
    state = attachTo(attached.state, attached.id, spawned.id);
    state = spawn(state, CODES.naasiyahAlly, { zone: "play", seat: seats - 1 }, "up").state;
  }
  if (layout.key) {
    const guard = Object.values(state.cards).find((card) => card.code === CODES.guardian);
    const spawned = spawn(state, CODES.gateKey, layout.key === "free" ? { zone: "staging" } : { zone: "attached" }, "up");
    state = spawned.state;
    if (layout.key === "guard" && guard) state = updateCard(attachTo(state, spawned.id, guard.id), spawned.id, { claimed: true });
    if (layout.key === "hero") state = updateCard(attachTo(state, spawned.id, first.id), spawned.id, { claimed: true, controller: 0 });
  }
  for (const [code, damage] of layout.damage ?? []) {
    const id = Object.values(state.cards).find((card) => card.code === code)?.id;
    if (id) state = updateCard(state, id, { damage });
  }
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  if (layout.mode) state = spawn(state, CODES.hardMode, { zone: "modeCard" }, layout.mode).state;
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  state = syncIsland(syncConstants(state, ctx), ctx);
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero, cells };
}

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function templeFight(world: TempleWorld, shadow: string, enemy: string, layout: TempleLayout = {}, options: FightOptions<TempleTable> = {}): Fight<TempleTable> {
  return fightEnemy((made: TempleLayout) => templeTable(world, made), shadow, enemy, layout, options);
}

export { send, start, answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords };
export type { Run, PlayerIntent };
