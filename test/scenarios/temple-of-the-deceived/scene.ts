import { EFFECTS } from "../../../src/effects/index.ts";
import type { Effect } from "../../../src/catalog/boundary.ts";
import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";
import { setActive, syncIsland } from "../../../src/rules/families/island/map.ts";

import { loadCampaign, loadScenario, gameCodes } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { send, start, type Run } from "../a-shadow-of-the-past/scene.ts";
import { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords } from "../the-thing-in-the-depths/scene.ts";

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
export const HERO = "dh1";
export const HERO2 = "dh2";
export const HERO3 = "dh3";

// The filler event has an Action that does nothing, so it can be played: an event with no record at all cannot (rr.triggered-ability).
const SCENE_EFFECTS: readonly Effect[] = [...EFFECTS, { id: "filler:action:1", cardCode: "filler", lines: ["filler:A:1"], timing: "action", instructions: [] }];

export type TempleWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadTempleWorld(): Promise<TempleWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, temple), CODES.ominousFate, CODES.hardMode, CODES.sahirAlly, CODES.naasiyahAlly, CODES.guardianOriginal, CODES.gateKeyOriginal, CODES.northernTracker])];
  const cards = new Map(await loadPrinted(codes));
  const enemy = (code: string, stats: Partial<Parameters<typeof definePrinted>[0]>): PrintedCard => definePrinted({ code, name: code, type: "enemy", engagementCost: 50, ...stats });
  cards.set("f0", enemy("f0", { threat: 0, attack: 1, defense: 1, health: 3 }));
  cards.set("f3", enemy("f3", { threat: 3, attack: 1, defense: 1, health: 3 }));
  cards.set("mild", enemy("mild", { threat: 1, engagementCost: 10, attack: 3, defense: 1, health: 20 }));
  cards.set("undead", enemy("undead", { traits: ["Undead"], threat: 1, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  cards.set("place", definePrinted({ code: "place", name: "place", type: "location", threat: 2, questPoints: 2 }));
  cards.set("treachery", definePrinted({ code: "treachery", name: "treachery", type: "treachery" }));
  for (const code of [HERO, HERO2, HERO3]) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: 2, attack: 2, defense: 2, health: 6 }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  cards.set("event", definePrinted({ code: "event", name: "event", type: "event", sphere: "neutral", cost: 1 }));
  for (const cost of [0, 1, 2, 3]) cards.set(`c${cost}`, definePrinted({ code: `c${cost}`, name: `c${cost}`, type: "event", sphere: "neutral", cost }));
  cards.set("ally", definePrinted({ code: "ally", name: "ally", type: "ally", sphere: "neutral", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  return { definition, cards };
}

/** A card of the staging area or another zone: a code, or a code with its tokens. */
export type Entry = string | { code: string; damage?: number; resources?: number; progress?: number };
const entry = (item: Entry): { code: string; damage: number; resources: number; progress: number } => (typeof item === "string" ? { code: item, damage: 0, resources: 0, progress: 0 } : { code: item.code, damage: item.damage ?? 0, resources: item.resources ?? 0, progress: item.progress ?? 0 });

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
};

export type TempleTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null; cells: readonly string[] };

export function templeTable(world: TempleWorld, layout: TempleLayout = {}): TempleTable {
  const seats = layout.seats ?? 1;
  const ctx: ReduceContext = { effects: SCENE_EFFECTS, cards: world.cards };
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
  const asked = layout.phase ?? "Quest";
  const phase = asked === "PlayerAttacks" ? "Combat" : asked;
  const mode = asked === "PlayerAttacks" ? "playerAttacks" : phase === "Quest" ? "questCommit" : phase === "Encounter" ? "optionalEngage" : phase === "Travel" ? "travel" : phase === "Planning" ? "planning" : phase === "Refresh" ? "refresh" : "combatActions";
  const window = asked === "PlayerAttacks" ? { kind: "playerAttack" as const } : phase === "Encounter" ? { kind: "optionalEngage" as const } : phase === "Travel" ? { kind: "travel" as const } : phase === "Refresh" ? null : { kind: "pass" as const };
  state = { ...state, phase, boundaryPhase: phase, mode, window, activeSeat: 0 };
  state = syncIsland(syncConstants(state, ctx), ctx);
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero, cells };
}

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function templeFight(world: TempleWorld, shadow: string, enemy: string, layout: TempleLayout = {}, options: { undefended?: boolean; defender?: (made: TempleTable) => string; pick?: (state: ScenarioState) => string; tweak?: (state: ScenarioState, made: TempleTable) => ScenarioState } = {}): { run: Run; ctx: ReduceContext; made: TempleTable; start: ScenarioState; during: ScenarioState } {
  const made = templeTable(world, { phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], hand: ["filler", "filler"], ...layout });
  const state = syncConstants(options.tweak ? options.tweak(made.state, made) : made.state, made.ctx);
  let run: Run = send(start(state), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    if (run.state.window?.kind === "chooseEnemy") {
      run = send(run, { type: "ChooseEnemy", enemyId: run.state.window.options[0] ?? "" }, made.ctx);
      continue;
    }
    if (run.state.window?.kind === "choose") {
      run = send(run, { type: "Choose", optionId: options.pick?.(run.state) ?? run.state.window.options[0] ?? "" }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  if (run.state.window?.kind !== "defense") throw new Error(`no defense window: ${JSON.stringify(run.state.window)}`);
  const defender = options.defender ? options.defender(made) : made.hero;
  let during = run.state;
  run = send(run, options.undefended ? { type: "Undefended", heroId: defender } : { type: "DeclareDefender", defenderId: defender }, made.ctx);
  for (let guard = 0; guard < 40 && (run.state.pendingAttack != null || run.state.window?.kind === "choose" || run.state.window?.kind === "look" || run.state.window?.kind === "defense"); guard += 1) {
    const window = run.state.window;
    if (window?.kind === "defense") {
      const canDefend = legalTargets(run.state, { type: "DeclareDefender" }, made.ctx).includes(defender);
      run = send(run, options.undefended || !canDefend ? { type: "Undefended", heroId: run.state.cards[defender]?.zone === "heroes" ? defender : made.hero2 } : { type: "DeclareDefender", defenderId: defender }, made.ctx);
      continue;
    }
    if (window?.kind === "choose") {
      run = send(run, { type: "Choose", optionId: options.pick?.(run.state) ?? window.options[0] ?? "" }, made.ctx);
      continue;
    }
    if (window?.kind === "look") {
      run = send(run, { type: "Pass" }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    if (run.state.pendingAttack != null) during = run.state;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  return { run, ctx: made.ctx, made, start: state, during };
}

export { send, start, answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords };
export type { Run, PlayerIntent };
