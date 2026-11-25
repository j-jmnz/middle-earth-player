import type { Effect, Instruction } from "../../src/catalog/boundary.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import type { EngineStep } from "../../src/rules/core/intents.ts";
import { definePrinted, type PrintedCard } from "../../src/rules/core/printed.ts";
import { byCode } from "../../src/rules/core/test-fixture.ts";
import { modifiedStat } from "../../src/rules/core/keywords.ts";
import { spawn } from "../../src/rules/core/zones.ts";
import { startReveal } from "../../src/rules/windows/frames.ts";
import { settle } from "../../src/rules/engine/machine.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../src/rules/interpret/constants.ts";
import { pushCardEffects } from "../../src/rules/interpret/effect-frames.ts";
import { runInstruction } from "../../src/rules/interpret/interpret.ts";

import { causeProblems } from "./cause-check.ts";
import { begin, send, type Run } from "./scene.ts";

// Test helper. What the campaign scenarios' scenes (test/scenarios/<scenario-id>/scene.ts) share: card and zone lookups, the answers to
// the choices an effect opens, a card's records resolved by themselves, an attack fought out with a Shadow card, the phase a table
// opens on, the stand-in cards and the filler records. A scene keeps its codes, its layout and its table; `tableFromLayout` (layout.ts, re-exported at the end)
// builds a table for any scenario from data/ alone (test/harness/card-spec.ts runs its rows on it).

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

/** The zone of the first card of a code in `state` (undefined when no card has it). */
export function zoneOf(state: ScenarioState, code: string): string | undefined {
  return state.cards[idOf(state, code)]?.zone;
}

/** A stat of the first card of a code in `state`, modifiers included (`cards` is the table's printed cards: `made.cards` or `ctx.cards`). */
export function statOf(state: ScenarioState, cards: ReduceContext["cards"], code: string, which: Parameters<typeof modifiedStat>[2]): number {
  return modifiedStat(state, state.cards[idOf(state, code)]!, which, cards);
}

/** The codes of the cards in a zone, sorted. */
export function codesIn(state: ScenarioState, zone: string): string[] {
  return Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code).sort();
}

/** The zone of the first card with this code (a card the table does not have has none). */
export const where = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;

/** The codes of the cards engaged with a seat (the first seat by default), in engagement order. */
export const engagedCodes = (state: ScenarioState, seat = 0): string[] => (state.seats[seat]?.engaged ?? []).map((id) => state.cards[id]?.code ?? "");

/** The run of a table's state, constants synced. */
export const opened = (made: { state: ScenarioState; ctx: ReduceContext }, state: ScenarioState = made.state): Run => begin(syncConstants(state, made.ctx));

/** The state after one instruction ran for a seat (the window cleared first) and the table settled. The round is stopped while the instruction runs, so only what it does is read; the table is given back as it was unless the instruction opened a window of its own. */
export function run(made: { ctx: ReduceContext }, state: ScenarioState, instruction: Instruction, options: { seat?: number; sourceId?: string | null; steps?: EngineStep[] } = {}): ScenarioState {
  const steps = options.steps ?? [];
  const done = settle(runInstruction({ ...state, window: null, mode: "stopped" }, instruction, { seat: options.seat ?? 0, sourceId: options.sourceId ?? null }, made.ctx, steps), made.ctx, steps);
  return done.window != null || done.stack.length > 0 ? done : { ...done, mode: state.mode, window: state.window, activeSeat: state.activeSeat };
}

/** The intents that let a window go by without a decision: pass, decline to travel, engage nobody, attack nobody. */
export const PASSING: readonly PlayerIntent["type"][] = ["Pass", "DeclineTravel", "DeclineEngage", "DeclineAttack"];

/**
 * An attack is fought out: a defense window names the hero `heroCode` (the first hero of the player attacked by default) as the one that takes an undefended attack, or declares `defender` when given; a choice takes the option `choose` names (the first by default); every
 * other window is passed. Stops once `stop` holds.
 */
export function fight(made: { ctx: ReduceContext }, from: Run, stop: (state: ScenarioState) => boolean, options: { defender?: string; heroCode?: string; choose?: (state: ScenarioState) => string } = {}): Run {
  let current = from;
  const answer = (intent: PlayerIntent): void => {
    current = send(current, intent, made.ctx);
  };
  for (let guard = 0; guard < 120 && !stop(current.state) && !current.state.lost && !current.state.stageCleared; guard += 1) {
    const state = current.state;
    const intents = legalIntents(state, made.ctx);
    if (state.window?.kind === "choose") answer({ type: "Choose", optionId: options.choose ? options.choose(state) : (state.window.options[0] ?? "") });
    else if (state.window?.kind === "chooseEnemy") answer({ type: "ChooseEnemy", enemyId: state.window.options[0] ?? "" });
    else if (options.defender && intents.some((intent) => intent.type === "DeclareDefender")) answer({ type: "DeclareDefender", defenderId: idOf(state, options.defender) });
    else if (intents.some((intent) => intent.type === "Undefended")) answer({ type: "Undefended", heroId: options.heroCode ? idOf(state, options.heroCode) : (state.seats[state.window?.kind === "defense" ? state.window.seat : 0]?.heroes[0] ?? "") });
    else {
      const pass = PASSING.map((type) => intents.find((intent) => intent.type === type)).find((intent) => intent != null);
      if (!pass) break;
      answer(pass as PlayerIntent);
    }
  }
  return current;
}

/** A card of the staging area or another zone: a code, or a code with its tokens. */
export type Entry = string | { code: string; damage?: number; resources?: number; progress?: number; upgraded?: true };
// `upgraded`: a ship-objective shows its Upgraded side, side B (The Hunt for the Dreadnaught's ships).
export const entry = (item: Entry): { code: string; damage: number; resources: number; progress: number; upgraded: boolean } => (typeof item === "string" ? { code: item, damage: 0, resources: 0, progress: 0, upgraded: false } : { code: item.code, damage: item.damage ?? 0, resources: item.resources ?? 0, progress: item.progress ?? 0, upgraded: item.upgraded === true });

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
 * The card is put face down on top of the encounter deck and revealed by the first player (`startReveal`), the round stopped where it is, and the effects the reveal pushed are settled. The choices and looks they open
 * are left to the caller (`finish`, or an auto-player). Shared by the card-spec `reveal` action and the encounter smoke (scripts/card-smoke/encounter-cards.ts).
 */
export function revealFromTop(state: ScenarioState, ctx: ReduceContext, code: string, steps: EngineStep[]): { state: ScenarioState; id: string } {
  const spawned = spawn({ ...state, window: null, mode: "stopped" }, code, { zone: "encounterDeck" }, "down");
  const top = { ...spawned.state, encounterDeck: [spawned.id, ...spawned.state.encounterDeck.filter((id) => id !== spawned.id)] };
  return { state: settle(startReveal(top, top.firstPlayer, ctx, steps), ctx, steps), id: spawned.id };
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

/** The state after the first card of `code` is revealed from the top of the encounter deck of `made` and the effects it opens are resolved. */
export function revealedTop(made: { state: ScenarioState; ctx: ReduceContext }, code: string): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: revealFromTop(made.state, made.ctx, code, steps).state, steps }, made.ctx).state;
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
  attachment: () => definePrinted({ code: "attachment", name: "attachment", type: "attachment", sphere: "neutral", cost: 0 }),
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

/** The hero an undefended attack of a second seat lands on (the attacking enemy engaged the next player): that seat's own first hero; null when the attack is the first seat's. */
export function secondSeatHero(state: ScenarioState): string | null {
  const seat = state.pendingAttack?.seat ?? 0;
  return seat === 0 ? null : (state.seats[seat]?.heroes[0] ?? null);
}

// The card an undefended attack lands on: the one `lands` names for the attacking enemy's code while it is in the game, else the hero asked for.
function undefendedOn(state: ScenarioState, lands: Readonly<Record<string, string>> | undefined, hero: string): string {
  const attacker = state.pendingAttack ? state.cards[state.pendingAttack.enemyId]?.code : undefined;
  const code = attacker == null ? undefined : lands?.[attacker];
  // A card that left the game since (a Battleground location a shadow removed) cannot be named again: the hero is.
  const target = code == null ? undefined : idOf(state, code);
  return target == null || state.cards[target]?.zone === "removed" ? hero : target;
}

export type FightTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string };
// `lands`: for an attacker's code, the code of the card its undefended attack must land on when a card sends its damage elsewhere (Mordor Orc's goes to Minas Tirith, 145055:A:2); the defender (a hero) for any other attacker.
export type FightOptions<T> = { undefended?: boolean; escape?: readonly string[]; lands?: Readonly<Record<string, string>>; defender?: (made: T) => string; pick?: (state: ScenarioState) => string; tweak?: (state: ScenarioState, made: T) => ScenarioState };
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
    if (run.state.window?.kind === "archery") {
      // The archery of an enemy in the fight (a Soldier of Isengard): the whole total goes on the second hero, so the first hero's damage is the attack's alone.
      const recipients = legalTargets(run.state, { type: "Distribute" }, made.ctx);
      const recipient = recipients.includes(made.hero2) ? made.hero2 : (recipients[0] ?? made.hero2);
      run = send(run, { type: "Distribute", assignments: [{ cardId: recipient, amount: run.state.window.total }] }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  if (run.state.window?.kind !== "defense") throw new Error(`no defense window: ${JSON.stringify(run.state.window)}`);
  const defender = options.defender ? options.defender(made) : made.hero;
  let during = run.state;
  run = send(run, options.undefended ? { type: "Undefended", heroId: undefendedOn(run.state, options.lands, defender) } : { type: "DeclareDefender", defenderId: defender }, made.ctx);
  for (let guard = 0; guard < 40 && (run.state.pendingAttack != null || run.state.window?.kind === "choose" || run.state.window?.kind === "look" || run.state.window?.kind === "defense"); guard += 1) {
    const window = run.state.window;
    // A second attack (the attacking enemy attacks again): defended as the first was, unless the defender is exhausted by then, and then by the second hero when the first is no hero.
    if (window?.kind === "defense") {
      const canDefend = legalTargets(run.state, { type: "DeclareDefender" }, made.ctx).includes(defender);
      const otherHero = secondSeatHero(run.state);
      if (otherHero != null) {
        run = send(run, { type: "Undefended", heroId: otherHero }, made.ctx);
        continue;
      }
      run = send(run, options.undefended || !canDefend ? { type: "Undefended", heroId: undefendedOn(run.state, options.lands, run.state.cards[defender]?.zone === "heroes" ? defender : made.hero2) } : { type: "DeclareDefender", defenderId: defender }, made.ctx);
      continue;
    }
    if (window?.kind === "choose") {
      run = send(run, { type: "Choose", optionId: options.pick?.(run.state) ?? window.options[0] ?? "" }, made.ctx);
      continue;
    }
    // An escape test a Shadow effect makes: the characters of `escape` (codes) commit, the others do not.
    if (window?.kind === "escapeCommit") {
      run = send(run, { type: "CommitEscape", cardIds: (options.escape ?? []).map((code) => idOf(run.state, code)).filter((id) => legalTargets(run.state, { type: "CommitEscape" }, made.ctx).includes(id)) }, made.ctx);
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

// The table built from a layout is test/harness/layout.ts; it lives there so this file keeps to the scene's helpers.
export { attachTargetCodes, engagedHandTable, layoutTableFor, printedIn, tableFromLayout } from "./layout.ts";
export type { Layout, LayoutTable, Placed, PileZone } from "./layout.ts";
