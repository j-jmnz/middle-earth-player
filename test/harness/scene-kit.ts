import type { Effect, ScenarioDefinition } from "../../src/catalog/boundary.ts";
import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import type { EngineStep } from "../../src/rules/core/intents.ts";
import { definePrinted, printedFromCard, type PrintedCard } from "../../src/rules/core/printed.ts";
import { byCode } from "../../src/rules/core/test-fixture.ts";
import { blankScenario, updateCard, withThreat } from "../../src/rules/core/state.ts";
import { attachTo, spawn, type Destination } from "../../src/rules/core/zones.ts";
import { settle } from "../../src/rules/engine/machine.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../src/rules/interpret/constants.ts";
import { pushCardEffects } from "../../src/rules/interpret/effect-frames.ts";

import { gameCodes, loadCampaigns, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { loadCards } from "../../scripts/data/load-cards.ts";

import { causeProblems } from "./cause-check.ts";
import { begin, send, type Run } from "./scene.ts";

// Test helper. What the campaign scenarios' scenes (test/scenarios/<scenario-id>/scene.ts) share: card and zone lookups, the answers to
// the choices an effect opens, a card's records resolved by themselves, an attack fought out with a Shadow card, the phase a table
// opens on, the stand-in cards and the filler records. A scene keeps its codes, its layout and its table; `tableFromLayout` builds a table
// for any scenario from data/ alone (test/harness/card-spec.ts runs its rows on it).

export { begin as start, send, legalIntents, legalTargets };
export type { Run };

/** The first card of a code. */
export function idOf(state: ScenarioState, code: string): string {
  const found = Object.values(state.cards).find((card) => card.code === code);
  if (!found) throw new Error(`no card ${code}`);
  return found.id;
}

/** The first card of a code, or an empty id when there is none. */
export function first(state: ScenarioState, code: string): string {
  return byCode(state, code)[0] ?? "";
}

/** The ids of the cards of a code, in id order. */
export function idsOf(state: ScenarioState, code: string): string[] {
  return Object.values(state.cards).filter((card) => card.code === code).map((card) => card.id);
}

/** The codes of the cards in a zone, sorted. */
export function codesIn(state: ScenarioState, zone: string): string[] {
  return Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code).sort();
}

/** A card of the staging area or another zone: a code, or a code with its tokens. */
export type Entry = string | { code: string; damage?: number; resources?: number; progress?: number };
export const entry = (item: Entry): { code: string; damage: number; resources: number; progress: number } => (typeof item === "string" ? { code: item, damage: 0, resources: 0, progress: 0 } : { code: item.code, damage: item.damage ?? 0, resources: item.resources ?? 0, progress: item.progress ?? 0 });

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

/**
 * The card's records of this timing resolve now (a When Revealed in the quest phase, a Setup), and the look windows and choices they
 * open are answered. `source` is the card they belong to (spawned in the staging area when absent). The mode stops the round where it
 * is, so only what the records do is read, unless `stopped` is false.
 */
export function resolveRecords(state: ScenarioState, ctx: ReduceContext, code: string, timing: Effect["timing"], source?: string, pick?: (state: ScenarioState) => string, stopped = true): Run & { id: string } {
  const spawned = source ? { state, id: source } : spawn(state, code, { zone: "staging" });
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
  const steps: EngineStep[] = [];
  const frame = timing === "whenRevealed" ? "whenRevealed" : timing === "setup" ? "setup" : timing === "travel" ? "travel" : timing === "shadow" ? "shadow" : "forced";
  const pushed = pushCardEffects(spawned.state, frame, spawned.id, spawned.state.firstPlayer, false, effects, ctx, steps);
  const run = finish({ state: settle({ ...pushed, window: null, ...(stopped ? { mode: "stopped" as const } : {}) }, ctx, steps), steps }, ctx, pick);
  if (causeProblems(run.steps).length > 0) throw new Error(`Steps without a cause: ${causeProblems(run.steps).join("; ")}`);
  return { ...run, id: spawned.id };
}

export type ScenePhase = "Quest" | "Encounter" | "Combat" | "Travel" | "Refresh" | "Planning" | "PlayerAttacks";

const OPENINGS = {
  Quest: { phase: "Quest", mode: "questCommit", window: { kind: "pass" } },
  Planning: { phase: "Planning", mode: "planning", window: { kind: "pass" } },
  Travel: { phase: "Travel", mode: "travel", window: { kind: "travel" } },
  Encounter: { phase: "Encounter", mode: "optionalEngage", window: { kind: "optionalEngage" } },
  Refresh: { phase: "Refresh", mode: "refresh", window: null },
  Combat: { phase: "Combat", mode: "combatActions", window: { kind: "pass" } },
  PlayerAttacks: { phase: "Combat", mode: "playerAttacks", window: { kind: "playerAttack" } },
} as const;

/** The phase, the mode and the window a table opens on when its layout asks for `asked`. */
export function opening(asked: ScenePhase): { phase: ScenarioState["phase"]; boundaryPhase: ScenarioState["phase"]; mode: ScenarioState["mode"]; window: ScenarioState["window"]; activeSeat: number } {
  const at = OPENINGS[asked];
  return { phase: at.phase, boundaryPhase: at.phase, mode: at.mode, window: at.window, activeSeat: 0 };
}

// The filler event has an Action that does nothing, so it can be played: an event with no record at all cannot (rr.triggered-ability).
export function fillerRecord(code: string): Effect {
  return { id: `${code}:action:1`, cardCode: code, lines: [`${code}:A:1`], timing: "action", instructions: [] };
}

/** The authored records and a do-nothing Action for the filler event, and for each of `more` other stand-in events. */
export function sceneEffects(...more: readonly string[]): readonly Effect[] {
  return [...EFFECTS, ...["filler", ...more].map(fillerRecord)];
}

export type PrintedStats = Partial<Parameters<typeof definePrinted>[0]>;

/** A stand-in enemy: engagement cost 50 unless `stats` say otherwise. */
export const enemyCard = (code: string, stats: PrintedStats): PrintedCard => definePrinted({ code, name: code, type: "enemy", engagementCost: 50, ...stats });

/** An event of this cost and no text. */
export const eventCard = (code: string, cost: number): PrintedCard => definePrinted({ code, name: code, type: "event", sphere: "neutral", cost });

/** A neutral ally of this cost and 1/1/2 or the stats given. */
export const allyCard = (code: string, cost: number, stats: PrintedStats = {}): PrintedCard => definePrinted({ code, name: code, type: "ally", sphere: "neutral", cost, willpower: 1, attack: 1, defense: 1, health: 2, ...stats });

/** A stand-in hero of the plain numbers (threat 8, 2/2/2, 6 hit points). */
export const heroCard = (code: string): PrintedCard => definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: 2, attack: 2, defense: 2, health: 6 });

export const HERO = "dh1";
export const HERO2 = "dh2";
export const HERO3 = "dh3";

const STAND_INS = {
  f0: () => enemyCard("f0", { threat: 0, attack: 1, defense: 1, health: 3 }),
  f3: () => enemyCard("f3", { threat: 3, attack: 1, defense: 1, health: 3 }),
  mild: () => enemyCard("mild", { threat: 1, engagementCost: 10, attack: 3, defense: 1, health: 20 }),
  undead: () => enemyCard("undead", { traits: ["Undead"], threat: 1, engagementCost: 50, attack: 1, defense: 1, health: 3 }),
  corsair: () => enemyCard("corsair", { traits: ["Corsair"], threat: 1, engagementCost: 50, attack: 1, defense: 1, health: 3 }),
  corsair2: () => enemyCard("corsair2", { traits: ["Corsair"], threat: 2, engagementCost: 50, attack: 1, defense: 1, health: 3 }),
  ship: () => enemyCard("ship", { traits: ["Corsair", "Ship"], threat: 2, engagementCost: 50, attack: 1, defense: 1, health: 3 }),
  raider: () => enemyCard("raider", { traits: ["Corsair", "Raider"], threat: 1, engagementCost: 10, attack: 2, defense: 1, health: 3 }),
  place: () => definePrinted({ code: "place", name: "place", type: "location", threat: 2, questPoints: 2 }),
  treachery: () => definePrinted({ code: "treachery", name: "treachery", type: "treachery" }),
  filler: () => eventCard("filler", 0),
  event: () => eventCard("event", 1),
  ally: () => allyCard("ally", 1),
} as const;
export type StandIn = keyof typeof STAND_INS | "heroes";

/**
 * Adds the stand-in cards named to a scene's cards: plain-number enemies, the three heroes dh1 to dh3, a place, a treachery, the
 * filler event, and the events `c0`, `c1`... of the printed costs given.
 */
export function addStandIns(cards: Map<string, PrintedCard>, names: readonly StandIn[], costs: readonly number[] = []): void {
  for (const name of names) {
    if (name === "heroes") for (const code of [HERO, HERO2, HERO3]) cards.set(code, heroCard(code));
    else cards.set(name, STAND_INS[name]());
  }
  for (const cost of costs) cards.set(`c${cost}`, eventCard(`c${cost}`, cost));
}

export type FightTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string };
export type FightOptions<T> = { undefended?: boolean; defender?: (made: T) => string; pick?: (state: ScenarioState) => string; tweak?: (state: ScenarioState, made: T) => ScenarioState };
export type Fight<T> = { run: Run; ctx: ReduceContext; made: T; start: ScenarioState; during: ScenarioState };

/**
 * An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, the first hero defending (or nobody).
 * `table` builds the scene's table from a layout. `run` is the state at the end of the attack and `during` the last state of the attack
 * while it is still in progress: the closing pass of the combat phase goes on to the refresh phase, which readies every card.
 */
export function fightEnemy<T extends FightTable, L>(table: (layout: L) => T, shadow: string, enemy: string, layout: L, options: FightOptions<T> = {}): Fight<T> {
  const made = table({ phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], hand: ["filler", "filler"], ...layout } as L);
  const state = syncConstants(options.tweak ? options.tweak(made.state, made) : made.state, made.ctx);
  let run: Run = send(begin(state), { type: "DeclineEngage" }, made.ctx);
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
    // A second attack (the attacking enemy attacks again): defended as the first was, unless the defender is exhausted by then, and then by the second hero when the first is no hero.
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

/** A card the layout places: a code, or a code with its tokens. */
export type Placed = Entry | { code: string; seat: number; damage?: number; resources?: number };

/** The zones a layout fills with a list of cards and no seat: a second deck, the Corsair or uncharted decks, the victory display. */
export type PileZone = Extract<Destination, { area?: number }>["zone"];

/**
 * A table by zone: what a card's behaviour needs and nothing else. The scenario's quest stages come from data/scenarios/<id>.json (the one
 * in `stage` is the current quest, the later ones the quest deck, the earlier ones set aside); the heroes are the plain-number stand-ins.
 * `deck` is the encounter deck, top first.
 */
export type Layout = {
  seats?: 1 | 2;
  seed?: number;
  stage?: string;
  progress?: number;
  active?: string;
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly Entry[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly Placed[];
  hand?: readonly string[];
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: ScenePhase;
  threat?: readonly [number, number];
  // The campaign card is on the table (a campaign game).
  campaign?: boolean;
  // Cards attached to the first card of `to`, wherever it lies (an attachment is spawned in play and attached).
  attached?: readonly { code: string; to: string }[];
  // The codes of the cards committed to the quest (a hero stand-in, an ally of `play`).
  committed?: readonly string[];
  // Other zones that hold a list of cards (a second deck, a named pile).
  piles?: Partial<Record<PileZone, readonly Entry[]>>;
};

export type LayoutTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null; definition: ScenarioDefinition; cards: Map<string, PrintedCard> };

type Loaded = { data: ScenarioData; dealt: ScenarioData; campaign: CampaignData; cards: Map<string, PrintedCard> };
const LOADED = new Map<string, Loaded>();

// The scenario's data, its campaign and the printed cards it deals (and the stand-ins), read once for each scenario.
function loadedWorld(scenarioId: string): Loaded {
  const known = LOADED.get(scenarioId);
  if (known) return known;
  const data = loadScenario(scenarioId);
  const campaign = loadCampaigns().find((one) => one.scenarios.includes(scenarioId));
  if (!campaign) throw new Error(`no campaign plays ${scenarioId}`);
  const dealt = campaignScenario(data);
  const codes = new Set([...dealt.cards.flatMap((card) => (card.back != null ? [card.code, card.back] : [card.code])), ...dealt.campaignPlaced, dealt.campaignCard, ...dealt.stages, ...gameCodes(campaign, data)]);
  const byCode = new Map(loadCards().map((card) => [card.code, card]));
  const cards = new Map<string, PrintedCard>();
  for (const code of codes) {
    const card = byCode.get(code);
    if (!card) throw new Error(`data/cards has no card ${code}`);
    cards.set(code, printedFromCard(card));
  }
  addStandIns(cards, ["f0", "f3", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  const made = { data, dealt, campaign, cards };
  LOADED.set(scenarioId, made);
  return made;
}

/** The printed card of a code the scenario deals, or a stand-in. */
export function printedIn(scenarioId: string, code: string): PrintedCard | undefined {
  return loadedWorld(scenarioId).cards.get(code);
}

/**
 * A table built from a layout, with no scene file: the scenario's codes are read from data/scenarios/<scenarioId>.json and data/cards.
 * `effects` are the records the table runs (the authored ones by default); the do-nothing Action for the filler event is added to them.
 */
export function tableFromLayout(scenarioId: string, layout: Layout = {}, options: { effects?: readonly Effect[] } = {}): LayoutTable {
  const world = loadedWorld(scenarioId);
  const effects = options.effects ?? EFFECTS;
  const definition = scenarioDefinition(world.dealt, world.campaign, effects);
  const ctx: ReduceContext = { effects: [...effects, fillerRecord("filler")], cards: world.cards };
  const stages = definition.stages.map((stage) => stage.code);
  const stage = layout.stage ?? stages[0] ?? "";
  const seats = layout.seats ?? 1;
  let state = blankScenario({ seatCount: seats, seed: layout.seed ?? 3, definition });
  const at = stages.indexOf(stage);
  for (const code of stages) {
    const index = stages.indexOf(code);
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
  const put = (code: string, dest: Destination, tokens: Entry = code, face?: "up" | "down"): void => {
    const row = entry(tokens);
    const spawned = spawn(state, code, dest, face);
    state = updateCard(spawned.state, spawned.id, { progress: row.progress, damage: row.damage, resources: row.resources });
  };
  for (const code of layout.play ?? []) put(code, { zone: "play", seat: 0 });
  for (const code of layout.deck ?? []) put(code, { zone: "encounterDeck" }, code, "down");
  for (const code of layout.discard ?? []) put(code, { zone: "encounterDiscard" });
  for (const item of layout.staging ?? []) put(entry(item).code, { zone: "staging" }, item);
  for (const code of layout.setAside ?? []) put(code, { zone: "setAside" }, code, "up");
  for (const item of layout.engaged ?? []) put(entry(item).code, { zone: "engaged", seat: typeof item === "object" && "seat" in item ? item.seat : 0 }, item);
  for (const code of layout.victory ?? []) put(code, { zone: "victory" });
  if (layout.active) put(layout.active, { zone: "activeLocation" });
  if (layout.campaign) put(world.dealt.campaignCard, { zone: "campaign" });
  for (const [zone, items] of Object.entries(layout.piles ?? {}) as [PileZone, readonly Entry[]][]) for (const item of items) put(entry(item).code, { zone }, item);
  for (const attachment of layout.attached ?? []) {
    const host = idOf(state, attachment.to);
    const spawned = spawn(state, attachment.code, { zone: "play", seat: 0 });
    state = attachTo(spawned.state, spawned.id, host);
  }
  for (const code of layout.committed ?? []) for (const id of idsOf(state, code)) state = updateCard(state, id, { committed: true });
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero, definition, cards: world.cards };
}
