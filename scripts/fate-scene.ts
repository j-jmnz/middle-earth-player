import { EFFECTS } from "../src/effects/index.ts";
import type { Effect } from "../src/catalog/boundary.ts";
import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../src/catalog/scenario-data.ts";
import { syncConstants } from "../src/rules/constants.ts";
import { definePrinted, type PrintedCard } from "../src/rules/printed.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../src/rules/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../src/rules/state.ts";
import { dealUnchartedDeck } from "../src/rules/families/uncharted/deal.ts";
import { attachTo, spawn } from "../src/rules/zones.ts";

import { loadCampaign, loadScenario, gameCodes } from "./data/load-scenarios.ts";
import { loadPrinted } from "./test-catalog.ts";
import { send, start, type Run } from "./past-scene.ts";
import { legalIntents, legalTargets } from "../src/rules/legal.ts";
import { pushCardEffects } from "../src/rules/effect-frames.ts";
import type { EngineStep } from "../src/rules/intents.ts";
import { settle } from "../src/rules/machine.ts";
import { causeProblems } from "./cause-check.ts";

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
export const HERO = "dh1";
export const HERO2 = "dh2";
export const HERO3 = "dh3";

// The filler event has an Action that does nothing, so it can be played: an event with no record at all cannot (rr.triggered-ability).
const SCENE_EFFECTS: readonly Effect[] = [...EFFECTS, { id: "filler:action:1", cardCode: "filler", lines: ["filler:A:1"], timing: "action", instructions: [] }];

export type FateWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadFateWorld(): Promise<FateWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, fate), CODES.calphonOriginal, CODES.ominousFate, CODES.hardMode])];
  const cards = new Map(await loadPrinted(codes));
  const enemy = (code: string, stats: Partial<Parameters<typeof definePrinted>[0]>): PrintedCard => definePrinted({ code, name: code, type: "enemy", engagementCost: 50, ...stats });
  cards.set("f0", enemy("f0", { threat: 0, attack: 1, defense: 1, health: 3 }));
  cards.set("f3", enemy("f3", { threat: 3, attack: 1, defense: 1, health: 3 }));
  cards.set("brute", enemy("brute", { threat: 1, engagementCost: 10, attack: 9, defense: 1, health: 20 }));
  // 8 Attack against a hero's 2 Defense is 6 damage: exactly the hit points of a hero with none lost.
  cards.set("mild", enemy("mild", { threat: 1, engagementCost: 10, attack: 3, defense: 1, health: 20 }));
  cards.set("bruiser", enemy("bruiser", { threat: 1, engagementCost: 10, attack: 8, defense: 1, health: 20 }));
  cards.set("undead", enemy("undead", { traits: ["Undead"], threat: 1, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  cards.set("undead2", enemy("undead2", { traits: ["Undead"], threat: 2, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  for (const code of [HERO, HERO2, HERO3]) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: 2, attack: 2, defense: 2, health: 6 }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  cards.set("archer", definePrinted({ code: "archer", name: "archer", type: "ally", sphere: "neutral", cost: 3, willpower: 1, attack: 2, defense: 1, health: 3, keywords: { ranged: true } }));
  // Player cards of printed costs 0 to 5, for the cards that read the printed cost of a card from a deck or a hand.
  for (const cost of [0, 1, 2, 3, 5]) cards.set(`c${cost}`, definePrinted({ code: `c${cost}`, name: `c${cost}`, type: "event", sphere: "neutral", cost }));
  for (const cost of [1, 2, 3]) cards.set(`ally${cost}`, definePrinted({ code: `ally${cost}`, name: `ally${cost}`, type: "ally", sphere: "neutral", cost, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set("blade", definePrinted({ code: "blade", name: "blade", type: "attachment", sphere: "neutral", cost: 3 }));
  cards.set("place", definePrinted({ code: "place", name: "place", type: "location", threat: 2, questPoints: 2 }));
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
};

export type FateTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null; calphon: string | null };

export function fateTable(world: FateWorld, layout: FateLayout = {}): FateTable {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "11025";
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
  const phase = layout.phase ?? "Quest";
  const mode = phase === "Quest" ? "questCommit" : phase === "Encounter" ? "optionalEngage" : phase === "Travel" ? "travel" : phase === "Planning" ? "planning" : phase === "Refresh" ? "refresh" : "combatActions";
  const window = phase === "Encounter" ? { kind: "optionalEngage" as const } : phase === "Travel" ? { kind: "travel" as const } : phase === "Refresh" ? null : { kind: "pass" as const };
  state = { ...state, phase, boundaryPhase: phase, mode, window, activeSeat: 0 };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero, calphon };
}

export { send, start };
export type { Run, PlayerIntent };

/** The first card of a code. */
export function idOf(state: ScenarioState, code: string): string {
  const found = Object.values(state.cards).find((card) => card.code === code);
  if (!found) throw new Error(`no card ${code}`);
  return found.id;
}

/** The ids of the cards of a code, in id order. */
export function idsOf(state: ScenarioState, code: string): string[] {
  return Object.values(state.cards).filter((card) => card.code === code).map((card) => card.id);
}

/** The codes of the cards in a zone, sorted. */
export function codesIn(state: ScenarioState, zone: string): string[] {
  return Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code).sort();
}

/** An answer to the choices a resolving effect opens (the first option by default). */
export function answer(run: Run, ctx: ReduceContext, pick: (state: ScenarioState) => string = (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")): Run {
  let current = run;
  for (let guard = 0; guard < 30 && current.state.window?.kind === "choose"; guard += 1) current = send(current, { type: "Choose", optionId: pick(current.state) }, ctx);
  return current;
}

/** Closes the look windows and answers the choices an effect opens, until it is done. */
export function finish(run: Run, ctx: ReduceContext, pick?: (state: ScenarioState) => string): Run {
  let current = run;
  for (let guard = 0; guard < 40; guard += 1) {
    if (current.state.window?.kind === "look") current = send(current, { type: "Pass" }, ctx);
    else if (current.state.window?.kind === "choose") current = answer(current, ctx, pick);
    else break;
  }
  return current;
}

export { legalIntents, legalTargets };

/** The card's When Revealed records resolve now, in the quest phase (the way a reveal resolves them), and the look windows and choices they open are answered. */
export function resolveReveal(state: ScenarioState, ctx: ReduceContext, code: string, pick?: (state: ScenarioState) => string): Run & { id: string } {
  const spawned = spawn(state, code, { zone: "staging" });
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
  const steps: EngineStep[] = [];
  const pushed = pushCardEffects(spawned.state, "whenRevealed", spawned.id, spawned.state.firstPlayer, false, effects, ctx, steps);
  const run = finish({ state: settle({ ...pushed, window: null }, ctx, steps), steps }, ctx, pick);
  if (causeProblems(run.steps).length > 0) throw new Error(`Steps without a cause: ${causeProblems(run.steps).join("; ")}`);
  return { ...run, id: spawned.id };
}

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function fateFight(world: FateWorld, shadow: string, enemy: string, layout: FateLayout = {}, options: { undefended?: boolean; defender?: (made: FateTable) => string; pick?: (state: ScenarioState) => string; tweak?: (state: ScenarioState, made: FateTable) => ScenarioState } = {}): { run: Run; ctx: ReduceContext; made: FateTable; start: ScenarioState; during: ScenarioState } {
  const made = fateTable(world, { phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], hand: ["filler", "filler"], ...layout });
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
  // The last state of the attack, while it is still in progress: the closing pass of the combat phase goes on to the refresh phase, which readies every card.
  let during = run.state;
  run = send(run, options.undefended ? { type: "Undefended", heroId: defender } : { type: "DeclareDefender", defenderId: defender }, made.ctx);
  for (let guard = 0; guard < 40 && (run.state.pendingAttack != null || run.state.window?.kind === "choose" || run.state.window?.kind === "look" || run.state.window?.kind === "defense"); guard += 1) {
    const window = run.state.window;
    // A second attack (the attacking enemy attacks again): defended as the first was, unless the defender is exhausted by then.
    if (window?.kind === "defense") {
      const canDefend = legalTargets(run.state, { type: "DeclareDefender" }, made.ctx).includes(defender);
      run = send(run, options.undefended || !canDefend ? { type: "Undefended", heroId: defender } : { type: "DeclareDefender", defenderId: defender }, made.ctx);
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
