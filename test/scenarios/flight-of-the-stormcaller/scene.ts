import { EFFECTS } from "../../../src/effects/index.ts";
import type { Effect } from "../../../src/catalog/boundary.ts";
import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import { attachTo, spawn } from "../../../src/rules/core/zones.ts";
import { stampRoutes } from "../../../src/rules/families/sea/routes.ts";
import { pushCardEffects } from "../../../src/rules/interpret/effect-frames.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import { legalIntents, legalTargets } from "../../../src/rules/engine/legal.ts";

import { loadCampaign, loadScenario, gameCodes } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { causeProblems } from "../../harness/cause-check.ts";
import { send, start, type Run } from "../a-shadow-of-the-past/scene.ts";

// Shared scene for the Flight of the Stormcaller effect tests (Dream-chaser part 4, campaign card 11191). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from the
// scenario's records and the engine. The cards are the campaign's (the Campaign Expansion's reprints of the ships and the Stormcaller), as a campaign game deals them.
export const flight: ScenarioData = loadScenario("flight-of-the-stormcaller");
export const campaign: CampaignData = loadCampaign("dream-chaser");
// What a campaign game deals: the reprints in place of the originals.
export const dealt: ScenarioData = campaignScenario(flight);

export const STAGES = ["12012", "12013", "12014", "12015"] as const;
export const CALLER_STAGES = ["12016", "12017", "12018"] as const;
export const CODES = {
  campaignCard: "11191",
  swiftDeparture: "12012",
  fullSail: "12013",
  foul: "12014",
  capeOfAndrast: "12015",
  stormcaller: "110042",
  stormcallerOriginal: "12019",
  escort: "12020",
  raider: "12021",
  skiff: "12022",
  seafarer: "12023",
  blade: "12024",
  reef: "12025",
  cove: "12026",
  coastland: "12027",
  overboard: "12028",
  squall: "12029",
  blackKey: "11192",
  calaerion: "11193",
  rollingSeas: "11051",
  suddenStorms: "11055",
  windsOfWrath: "11056",
  thunderstruck: "11177",
  crowley: "11178",
  ominousFate: "11176",
  hardMode: "11217",
  dreamChaser: "110136",
} as const;
export const SHIPS = { dreamChaser: "110136", dawnStar: "110137", duskbringer: "110138", glorinaith: "110139", narelenya: "110140", silverWing: "110141" } as const;
export const SHIP_CODES: readonly string[] = Object.values(SHIPS);
export const ORIGINAL_SHIPS = ["11080", "11081", "11082", "11083"] as const;
export const HEADING_CARD = "11084";
export const MODIFICATIONS = ["11172", "11173", "11174", "11175"] as const;
export const HERO = "dh1";
export const HERO2 = "dh2";
export const HERO3 = "dh3";

// The filler event has an Action that does nothing, so it can be played: an event with no record at all cannot (rr.triggered-ability).
const SCENE_EFFECTS: readonly Effect[] = [...EFFECTS, { id: "filler:action:1", cardCode: "filler", lines: ["filler:A:1"], timing: "action", instructions: [] }];

export type FlightWorld = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function loadFlightWorld(): Promise<FlightWorld> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, flight), ...SHIP_CODES, ...ORIGINAL_SHIPS, HEADING_CARD, CODES.ominousFate, CODES.hardMode, CODES.stormcallerOriginal, "11076", "11077"])];
  const cards = new Map(await loadPrinted(codes));
  const enemy = (code: string, stats: Partial<Parameters<typeof definePrinted>[0]>): PrintedCard => definePrinted({ code, name: code, type: "enemy", engagementCost: 50, ...stats });
  cards.set("f0", enemy("f0", { threat: 0, attack: 1, defense: 1, health: 3 }));
  cards.set("f3", enemy("f3", { threat: 3, attack: 1, defense: 1, health: 3 }));
  cards.set("f5", definePrinted({ code: "f5", name: "f5", type: "location", threat: 5, questPoints: 3 }));
  cards.set("mild", enemy("mild", { threat: 1, engagementCost: 10, attack: 3, defense: 1, health: 20 }));
  cards.set("corsair", enemy("corsair", { traits: ["Corsair"], threat: 1, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  cards.set("ship", definePrinted({ code: "ship", name: "ship", type: "enemy", ship: "enemy", traits: ["Corsair", "Ship"], threat: 2, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  cards.set("place", definePrinted({ code: "place", name: "place", type: "location", threat: 2, questPoints: 2 }));
  cards.set("treachery", definePrinted({ code: "treachery", name: "treachery", type: "treachery" }));
  cards.set("weather", definePrinted({ code: "weather", name: "weather", type: "treachery", traits: ["Weather"] }));
  for (const code of [HERO, HERO2, HERO3]) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: 2, attack: 2, defense: 2, health: 6 }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  cards.set("ally", definePrinted({ code: "ally", name: "ally", type: "ally", sphere: "neutral", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  return { definition, cards };
}

/** A card of the staging area or another zone: a code, or a code with its tokens. */
export type Entry = string | { code: string; damage?: number; resources?: number; progress?: number };
const entry = (item: Entry): { code: string; damage: number; resources: number; progress: number } => (typeof item === "string" ? { code: item, damage: 0, resources: 0, progress: 0 } : { code: item.code, damage: item.damage ?? 0, resources: item.resources ?? 0, progress: item.progress ?? 0 });

export type FlightLayout = {
  seats?: 1 | 2;
  seed?: number;
  stage?: (typeof STAGES)[number];
  progress?: number;
  // The Stormcaller's current stage number (2 to 4, default 2) and the progress on it.
  caller?: 2 | 3 | 4;
  callerProgress?: number;
  // The encounter deck (top first), its discard pile, the staging area, the cards in the Stormcaller's area (besides the Stormcaller and its stage), the victory display.
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly Entry[];
  area?: readonly Entry[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly (Entry | { code: string; seat: number; damage?: number; resources?: number })[];
  active?: Entry;
  hand?: readonly string[];
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: "Quest" | "Encounter" | "Combat" | "Travel" | "Refresh" | "Planning" | "PlayerAttacks";
  threat?: readonly [number, number];
  heading?: "Sun" | "Cloud" | "Rain" | "Storm";
  campaign?: boolean;
  // The Stormcaller shows its Campaign Mode only side (side B) and carries Black Key.
  campaignSide?: boolean;
  // Damage on the first hero.
  heroDamage?: number;
};

export type FlightTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null; caller: string; callerStage: string; ship: string };

export function flightTable(world: FlightWorld, layout: FlightLayout = {}): FlightTable {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "12012";
  const number = layout.caller ?? 2;
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
  // The fleet: the Dream-chaser under the first player, with the Heading card (dcce.heading); the routes of the cards that go to the Corsair or Elite piles.
  const chaser = spawn(state, CODES.dreamChaser, { zone: "play", seat: 0 });
  state = chaser.state;
  const heading = spawn(state, HEADING_CARD, { zone: "play", seat: 0 });
  state = attachTo(heading.state, heading.id, chaser.id);
  state = stampRoutes(state, world.cards);
  if (state.sea) state = { ...state, sea: { ...state.sea, heading: layout.heading ?? "Sun", headingCard: heading.id } };
  // The Stormcaller's area: its stages (the current one with progress), the Stormcaller, and the cards the layout puts there.
  let ids: string[] = [];
  for (const code of CALLER_STAGES) {
    const spawned = spawn(state, code, { zone: "setAside" }, "down");
    state = spawned.state;
    ids = [...ids, spawned.id];
  }
  const current = ids[number - 2] ?? "";
  const callerCard = spawn(state, layout.campaignSide ? CODES.stormcaller : CODES.stormcallerOriginal, { zone: "setAside" });
  state = callerCard.state;
  state = { ...state, sea: { ...(state.sea ?? { heading: null, headingCard: null, routes: {} }), stormcaller: { card: callerCard.id, stage: current, number, deck: ids.slice(number - 1), members: [] } } };
  return build(state, layout, ctx, world, first.id, secondHero.id, seat1Hero, callerCard.id, current, chaser.id);
}

function build(initial: ScenarioState, layout: FlightLayout, ctx: ReduceContext, world: FlightWorld, hero: string, hero2: string, seat1Hero: string | null, caller: string, callerStage: string, ship: string): FlightTable {
  let state = initial;
  // The current stage and the Stormcaller enter the area (the stage is not a member).
  const moved = (id: string): void => {
    state = updateCard(state, id, { zone: "stormcallerArea" });
  };
  moved(callerStage);
  state = updateCard(state, callerStage, { face: "B", progress: layout.callerProgress ?? 0 });
  moved(caller);
  if (layout.campaignSide) state = updateCard(state, caller, { face: "B" });
  state = { ...state, setAside: state.setAside.filter((id) => id !== callerStage && id !== caller) };
  const area = state.sea?.stormcaller;
  if (area && state.sea) state = { ...state, sea: { ...state.sea, stormcaller: { ...area, members: [caller] } } };
  for (const row of layout.area ?? []) {
    const item = entry(row);
    const spawned = spawn(state, item.code, { zone: "stormcallerArea" });
    state = updateCard(spawned.state, spawned.id, { progress: item.progress, damage: item.damage, resources: item.resources });
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
  if (layout.heroDamage) state = updateCard(state, hero, { damage: layout.heroDamage });
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  const asked = layout.phase ?? "Quest";
  const phase = asked === "PlayerAttacks" ? "Combat" : asked;
  const mode = asked === "PlayerAttacks" ? "playerAttacks" : phase === "Quest" ? "questCommit" : phase === "Encounter" ? "optionalEngage" : phase === "Travel" ? "travel" : phase === "Planning" ? "planning" : phase === "Refresh" ? "refresh" : "combatActions";
  const window = asked === "PlayerAttacks" ? { kind: "playerAttack" as const } : phase === "Encounter" ? { kind: "optionalEngage" as const } : phase === "Travel" ? { kind: "travel" as const } : phase === "Refresh" ? null : { kind: "pass" as const };
  state = { ...state, phase, boundaryPhase: phase, mode, window, activeSeat: 0 };
  void world;
  return { state: syncConstants(state, ctx), ctx, hero, hero2, seat1Hero, caller, callerStage, ship };
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

/** The card's records of this timing resolve now (a When Revealed in the quest phase, a Setup), and the look windows and choices they open are answered. `source` is the card they belong to (spawned in the staging area when absent). */
export function resolveRecords(state: ScenarioState, ctx: ReduceContext, code: string, timing: Effect["timing"], source?: string, pick?: (state: ScenarioState) => string): Run & { id: string } {
  const spawned = source ? { state, id: source } : spawn(state, code, { zone: "staging" });
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
  const steps: EngineStep[] = [];
  const frame = timing === "whenRevealed" ? "whenRevealed" : timing === "setup" ? "setup" : timing === "travel" ? "travel" : timing === "shadow" ? "shadow" : "forced";
  const pushed = pushCardEffects(spawned.state, frame, spawned.id, spawned.state.firstPlayer, false, effects, ctx, steps);
  // The mode stops the round where it is, so only what the records do is read.
  const run = finish({ state: settle({ ...pushed, window: null, mode: "stopped" }, ctx, steps), steps }, ctx, pick);
  if (causeProblems(run.steps).length > 0) throw new Error(`Steps without a cause: ${causeProblems(run.steps).join("; ")}`);
  return { ...run, id: spawned.id };
}

/** An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function flightFight(world: FlightWorld, shadow: string, enemy: string, layout: FlightLayout = {}, options: { undefended?: boolean; defender?: (made: FlightTable) => string; pick?: (state: ScenarioState) => string; tweak?: (state: ScenarioState, made: FlightTable) => ScenarioState } = {}): { run: Run; ctx: ReduceContext; made: FlightTable; start: ScenarioState; during: ScenarioState } {
  const made = flightTable(world, { phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], hand: ["filler", "filler"], ...layout });
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
