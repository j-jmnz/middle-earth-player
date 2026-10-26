import path from "node:path";

import type { Effect } from "../src/catalog/boundary.ts";
import { printedOf } from "../src/rules/printed.ts";
import { legalIntents, reduce, type EngineStep, type PlayerIntent, type ScenarioState } from "../src/rules/reduce.ts";
import { spawn } from "../src/rules/zones.ts";

import { nextIntent } from "./auto-player.ts";
import { dice, seedOf, smokeIntent, type Preference, type Smoked } from "./card-smoke-policy.ts";
import { handCopy, POLICY, SMOKE_SEED, smokeCodes, smokeWorld, type SmokeWorld } from "./card-smoke-world.ts";
import { describeError, runScript, type Log } from "./log.ts";

// A smoke test for one player card's effect records. A seeded Stealth and Steadfastness game is played to its first planning
// phase; the card is put where it can act (a hero on the table, anything else in the hand with resources to pay for it) and
// the game goes on, preferring every intent that uses the card and leaving the rest to the auto-player. Every intent sent
// is one the engine offered; a throw, a refusal or `state.failure` is a problem, reported with the intent and the step.
// It proves that the records run without breaking the game, not that they do what the card says.
//
// Usage: node --experimental-strip-types scripts/card-smoke.ts <code>... [--all] [--deal=<n>] [--seed=<n>] [--steps=<n>] [--verbose]
// --deal seeds the starter game, --seed the dice that choose among the card's intents.

export { smokeCodes, smokeWorld, type SmokeWorld };

// The frames an effect of the card resolves in (an Action, a Response, a Forced or delayed effect, a played event).
const EFFECT_FRAMES = new Set(["ResolveEffect", "forced", "delayed"]);
// A round of the starter game takes 20 to 40 steps. One that has not ended after this many is a window that never closes.
const STALL = 200;

export type SmokeOptions = {
  world: SmokeWorld;
  // Seeds the dice that choose among the card's intents (the deal is the world's).
  seed?: number;
  // Reducer steps before the run stops, if the game has not ended.
  steps?: number;
  // The chance an offered intent that uses the card is taken; the first chance to play it always is.
  prefer?: number;
  // Copies put in the hand in all: when every copy has left the hand and play, a new one is dealt.
  copies?: number;
};

/**
 * One effect record: how often its Trigger was offered, how often it was used (a Trigger sent, or its event played), the
 * engine steps that name it as their cause, and the steps after which a modifier it put on the table was there. A Forced or
 * triggered record moves no counter of its own unless it changes a number; the card's `frames` count it.
 */
export type RecordTally = { id: string; timing: Effect["timing"]; offered: number; used: number; caused: number; active: number };
export type SmokeProblem = { step: number; round: number; phase: string; window: string | null; intent: PlayerIntent | null; message: string };
export type SmokeSummary = {
  code: string;
  type: string;
  // Where the card started: already on the table, spawned among the heroes, or spawned in the hand.
  placed: "table" | "heroes" | "hand";
  // Heroes added so a copy could be paid for or attached.
  added: string[];
  // Copies played from the hand (a PlayCard, or an event's Trigger there), and copies dealt.
  plays: number;
  copies: number;
  steps: number;
  rounds: number;
  ended: "lost" | "won" | "steps" | "problem";
  // Effect frames the card was the source of.
  frames: number;
  records: RecordTally[];
  problems: SmokeProblem[];
};

function inHandOrPlay(state: ScenarioState, id: string): boolean {
  const zone = state.cards[id]?.zone;
  return zone === "hand" || zone === "heroes" || zone === "play" || zone === "attached";
}

// Counts what one accepted intent did for the card: its plays, Trigger uses, effect frames and caused steps.
function tally(summary: SmokeSummary, records: Map<string, RecordTally>, smoked: Smoked, before: ScenarioState, intent: PlayerIntent, steps: readonly EngineStep[]): void {
  const fromHand = "cardId" in intent && smoked.ids.has(intent.cardId) && before.cards[intent.cardId]?.zone === "hand";
  if (fromHand && (intent.type === "PlayCard" || intent.type === "Trigger")) {
    summary.plays += 1;
    smoked.played = true;
  }
  // An event played from the hand resolves its Actions.
  if (fromHand && intent.type === "PlayCard" && summary.type === "event") {
    for (const record of records.values()) if (record.timing === "action") record.used += 1;
  }
  if (intent.type === "Trigger" && smoked.ids.has(intent.cardId)) {
    const record = records.get(intent.effectId);
    if (record) record.used += 1;
  }
  for (const step of steps) {
    if (step.kind === "push" && step.cardId != null && smoked.ids.has(step.cardId) && EFFECT_FRAMES.has(step.frame)) summary.frames += 1;
    if ("cause" in step && "effect" in step.cause) {
      const record = records.get(step.cause.effect);
      if (record) record.caused += 1;
    }
  }
}

/** Plays one card's records in a real game and reports what ran and anything the engine got wrong. */
export function smokeCard(code: string, options: SmokeOptions): SmokeSummary {
  const { world } = options;
  const { ctx } = world;
  const printed = printedOf(ctx.cards, code);
  const records = new Map(ctx.effects.filter((effect) => effect.cardCode === code).map((effect): [string, RecordTally] => [effect.id, { id: effect.id, timing: effect.timing, offered: 0, used: 0, caused: 0, active: 0 }]));
  const ids = new Set<string>();
  const smoked: Smoked = { ids, records: new Set(records.keys()), played: printed.type === "hero" };
  const preference: Preference = { prefer: options.prefer ?? 0.8, dice: dice(seedOf(code, options.seed ?? SMOKE_SEED)), uses: new Map() };
  const summary: SmokeSummary = { code, type: printed.type, placed: "hand", added: [], plays: 0, copies: 0, steps: 0, rounds: 0, ended: "steps", frames: 0, records: [...records.values()], problems: [] };
  const deal = (from: ScenarioState): ScenarioState => {
    const copy = handCopy(world, from, code, summary.added);
    ids.add(copy.id);
    summary.copies += 1;
    return copy.state;
  };
  // The reducer never changes a state it is given; the clone keeps one card's run from reaching the next if it ever did.
  let state = structuredClone(world.planning);
  const onTable = state.seats[0].heroes.find((id) => state.cards[id]?.code === code);
  if (onTable) {
    ids.add(onTable);
    summary.placed = "table";
  } else if (printed.type === "hero") {
    const spawned = spawn(state, code, { zone: "heroes", seat: 0 });
    state = spawned.state;
    ids.add(spawned.id);
    summary.placed = "heroes";
  } else if (printed.type === "contract") {
    // A contract begins the game in play showing its side A.
    const spawned = spawn(state, code, { zone: "play", seat: 0 }, "A");
    state = spawned.state;
    ids.add(spawned.id);
    summary.placed = "table";
  } else {
    // A copy in the discard pile too, so an effect that takes a card of its own sphere or type from there has one.
    const discarded = spawn(state, code, { zone: "discard", seat: 0 });
    ids.add(discarded.id);
    state = deal(discarded.state);
  }
  const memory = new Set<string>();
  let roundStart = { round: state.round, step: 0 };
  for (let step = 0; step < (options.steps ?? 300); step += 1) {
    if (state.lost || (state.stageCleared && state.window == null)) {
      summary.ended = state.lost ? "lost" : "won";
      break;
    }
    let intent: PlayerIntent | null = null;
    try {
      const legal = legalIntents(state, ctx);
      if (legal.length === 0) throw new Error(`The engine offers no intent (window ${state.window?.kind ?? "none"}) and the game is not over`);
      if (state.round !== roundStart.round) roundStart = { round: state.round, step };
      if (step - roundStart.step >= STALL) throw new Error(`Round ${state.round} has not ended after ${STALL} steps`);
      for (const offer of legal) {
        const record = offer.type === "Trigger" && ids.has(offer.cardId) ? records.get(offer.effectId) : undefined;
        if (record) record.offered += 1;
      }
      intent = smokeIntent(state, ctx, legal, smoked, preference) ?? nextIntent(state, ctx, POLICY, memory, legal);
      const result = reduce(state, intent, ctx);
      if (!result.ok) throw new Error(`The reducer refused an offered intent: ${result.reason}`);
      if (result.state.failure) throw new Error(`state.failure: ${result.state.failure}`);
      tally(summary, records, smoked, state, intent, result.steps);
      state = result.state;
      for (const record of records.values()) if (state.modifiers.some((modifier) => modifier.origin === record.id)) record.active += 1;
      if (printed.type !== "hero" && summary.copies < (options.copies ?? 3) && ![...ids].some((id) => inHandOrPlay(state, id))) state = deal(state);
    } catch (error) {
      summary.problems.push({ step, round: state.round, phase: state.phase, window: state.window?.kind ?? null, intent, message: describeError(error) });
      summary.ended = "problem";
      break;
    } finally {
      summary.steps = step + 1;
    }
  }
  summary.rounds = state.round;
  return summary;
}

export function formatProblem(code: string, problem: SmokeProblem): string {
  return `${code} step ${problem.step} (round ${problem.round} ${problem.phase}, window ${problem.window ?? "none"}): ${JSON.stringify(problem.intent)}: ${problem.message}`;
}

export function formatSummary(summary: SmokeSummary): string {
  const added = summary.added.length > 0 ? `, added ${summary.added.join(" ")}` : "";
  const head = `${summary.code} ${summary.type} (${summary.placed}${added}): played ${summary.plays} of ${summary.copies} copies, ${summary.frames} effect frames, ${summary.steps} steps to round ${summary.rounds}, ended ${summary.ended}`;
  const lines = summary.records.map((record) => `  ${record.id.padEnd(22)} offered ${record.offered}, used ${record.used}, caused ${record.caused} steps, modifiers on ${record.active} steps`);
  return [head, ...lines, ...summary.problems.map((problem) => `  problem: ${formatProblem(summary.code, problem)}`)].join("\n");
}

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2);
  const number = (name: string) => {
    const value = args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
    return value == null ? undefined : Number(value);
  };
  const codes = args.includes("--all") ? smokeCodes() : args.filter((arg) => !arg.startsWith("--"));
  if (codes.length === 0) throw new Error("Name at least one card code, or --all");
  const world = await log.stepAsync(`starter game to planning, ${codes.length} cards loaded`, () => smokeWorld(codes, number("deal")));
  let failed = 0;
  for (const code of codes) {
    const summary = smokeCard(code, { world, seed: number("seed"), steps: number("steps") });
    if (summary.problems.length > 0) failed += 1;
    (summary.problems.length > 0 ? log.error : log.info)(formatSummary(summary));
  }
  if (failed > 0) throw new Error(`${failed} of ${codes.length} cards had problems`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) void runScript("card-smoke", main);
