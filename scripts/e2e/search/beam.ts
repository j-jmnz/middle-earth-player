import type { PlayerIntent } from "../../../src/rules/core/intents.ts";
import { reduce, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { movesOf, passedKey, STYLES, usedKey, type Style } from "./moves.ts";
import { bestFirst, hurts } from "./probe.ts";
import { safetyOf, scoreOf, type ScoreHook } from "./score.ts";

// A beam search over end-of-round states for one dealt game. Each line is played one round at a time in several ways (a style for each
// branch, plus a seeded noise that takes another option now and then); the lines with the best score and the safest lines carry on.
// Every intent is one the reducer accepted, so a won line is a real game. The search is deterministic for a seed, and caches nothing:
// `reduce` is pure and a line is a reference to its state.

export type BeamOptions = {
  /** Lines kept after each round, and branches played from each. */
  width: number;
  branches: number;
  /** Rounds played at most. */
  rounds: number;
  /** Time the search stops at (Date.now()). */
  deadline: number;
  /** A term a scenario adds to the generic score. */
  hook?: ScoreHook;
  /** Reports a round's result (the verbose log). */
  report?: (message: string) => void;
};

export type BeamOutcome = {
  /** The intents of a won game, or null. */
  won: PlayerIntent[] | null;
  /** The deepest round the beam reached, and the best score and table it held. */
  round: number;
  best: number;
  stage: string;
  /** How the lines that ended before the round did: loss reasons and stalls, counted. */
  endings: Record<string, number>;
  /** Why the search stopped: a win, the round limit, the deadline, or every line lost. */
  stopped: "won" | "rounds" | "deadline" | "lost";
  /** The intents sent, in all, by every branch (the cost of the search). */
  sent: number;
};

type Trail = { prev: Trail | null; chunk: readonly PlayerIntent[] };
type Line = { state: ScenarioState; trail: Trail | null; score: number };

/** The most intents one round of one branch sends before it is called stuck. */
const MOST_PER_ROUND = 700;

// A small seeded generator (mulberry32), so a search finds the same game every run.
function generator(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Played = { state: ScenarioState; chunk: PlayerIntent[]; end: "round" | "won" | "lost" | "stuck"; reason: string };

/** Plays one round from `from` with the style, taking the style's first option except with probability `noise`, when it takes another. */
function playRound(from: ScenarioState, ctx: ReduceContext, style: Style, noise: number, random: () => number, hook?: ScoreHook): Played {
  let state = from;
  const chunk: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < MOST_PER_ROUND; turn += 1) {
    if (state.lost) return { state, chunk, end: "lost", reason: state.lossReason ?? "lost" };
    if (state.stageCleared) return { state, chunk, end: "won", reason: "won" };
    if (state.round !== from.round) return { state, chunk, end: "round", reason: "round" };
    const options = movesOf(state, ctx, memory, style);
    if (options.length === 0) return { state, chunk, end: "stuck", reason: `no move in ${state.window?.kind ?? "no window"} (${state.mode})` };
    const first = options.length > 1 && random() < noise ? 1 + Math.floor(random() * (options.length - 1)) : 0;
    // A choice (a target, an option) the line makes without noise is the one that leaves the table with the best score.
    const ranked = first === 0 && options.length > 1 && state.window?.kind === "choose" ? bestFirst(state, options, ctx, style, hook) : options;
    const order = [ranked[first], ...ranked.filter((_, index) => index !== first)];
    // A card or an Action that costs the table more than it gives is passed over, unless nothing else can be sent.
    let sent = false;
    for (const filtered of [true, false]) {
      for (const intent of order) {
        if (!intent) continue;
        if (filtered && (intent.type === "Trigger" || intent.type === "PlayCard") && hurts(state, intent, ctx, style, hook)) {
          // It is not offered again this round.
          memory.add(intent.type === "Trigger" ? usedKey(state, intent.cardId, intent.effectId) : passedKey(state, intent.cardId));
          continue;
        }
        const result = reduce(state, intent, ctx);
        if (!result.ok) continue;
        if (intent.type === "Trigger") memory.add(usedKey(state, intent.cardId, intent.effectId));
        state = result.state;
        chunk.push(intent);
        sent = true;
        break;
      }
      if (sent) break;
    }
    if (!sent) return { state, chunk, end: "stuck", reason: `every option refused in ${state.window?.kind ?? "no window"}` };
  }
  return { state, chunk, end: "stuck", reason: "a round of more than 700 intents" };
}

/** What makes two lines the same table: the round, the seats' threat and heroes with their damage, the cards in hand and in play, the progress. */
function signature(state: ScenarioState): string {
  const seats = state.seats.slice(0, state.seatCount).map((seat) => [seat.threat, seat.heroes.map((id) => `${id}:${state.cards[id]?.damage ?? 0}`).join("+"), [...seat.hand].sort().join("+"), [...seat.play].sort().join("+"), seat.engaged.join("+")].join("|"));
  const quest = [state.questStage, ...state.seats.map((seat) => seat.stage)].map((id) => `${id ?? ""}:${state.cards[id ?? ""]?.progress ?? 0}`).join(",");
  return `${state.round};${quest};${state.staging.length};${seats.join(";")}`;
}

function flatten(trail: Trail | null, last: readonly PlayerIntent[]): PlayerIntent[] {
  const chunks: (readonly PlayerIntent[])[] = [last];
  for (let at = trail; at; at = at.prev) chunks.push(at.chunk);
  return chunks.reverse().flat();
}

/** The lines the next round starts from: the best-scoring ones, then the safest of the rest. */
function select(children: readonly Line[], ctx: ReduceContext, width: number): Line[] {
  const unique = new Map<string, Line>();
  for (const child of children) {
    const key = signature(child.state);
    const same = unique.get(key);
    if (!same || child.score > same.score) unique.set(key, child);
  }
  const all = [...unique.values()];
  const ahead = [...all].sort((left, right) => right.score - left.score).slice(0, Math.ceil(width * 0.65));
  const safe = all.filter((line) => !ahead.includes(line)).sort((left, right) => safetyOf(right.state, ctx) - safetyOf(left.state, ctx)).slice(0, width - ahead.length);
  return [...ahead, ...safe];
}

function describe(state: ScenarioState): string {
  const card = state.cards[state.questStage ?? ""];
  return `stage ${card?.code ?? "?"} progress ${card?.progress ?? 0}, threat ${state.seats.slice(0, state.seatCount).map((seat) => seat.threat).join("/")}, heroes ${state.seats.slice(0, state.seatCount).map((seat) => seat.heroes.length).join("/")}`;
}

/** Searches one dealt game: the intents of a won game, or how far the best line got and what ended the others. */
export function searchGame(start: ScenarioState, ctx: ReduceContext, seed: number, options: BeamOptions): BeamOutcome {
  const endings: Record<string, number> = {};
  let sent = 0;
  let best: Line = { state: start, trail: null, score: scoreOf(start, ctx, options.hook) };
  let deepest = 0;
  const outcome = (stopped: BeamOutcome["stopped"], won: PlayerIntent[] | null): BeamOutcome => ({ won, round: best.state.round, best: Math.round(best.score), stage: describe(best.state), endings, stopped, sent });
  // The beams of each round so far: a round whose lines all end is played again with other noise, and after three tries the round before is.
  const stack: Line[][] = [[{ state: start, trail: null, score: best.score }]];
  const attempts: number[] = [0];
  while (stack.length > 0) {
    const depth = stack.length - 1;
    if (depth >= options.rounds) return outcome("rounds", null);
    const beam = stack[depth] ?? [];
    const attempt = attempts[depth] ?? 0;
    const children: Line[] = [];
    for (const [index, line] of beam.entries()) {
      for (let branch = 0; branch < options.branches; branch += 1) {
        if (Date.now() > options.deadline) return outcome("deadline", null);
        const style = STYLES[(branch + attempt) % STYLES.length] ?? STYLES[0];
        if (!style) continue;
        const noise = branch === 0 && attempt === 0 ? 0 : 0.08 + 0.12 * attempt + (branch >= STYLES.length ? 0.15 : 0);
        const random = generator(seed * 1_000_003 + depth * 10_007 + index * 101 + branch * 7 + attempt * 13);
        const played = playRound(line.state, ctx, style, noise, random, options.hook);
        sent += played.chunk.length;
        if (played.end === "won") return { ...outcome("won", flatten(line.trail, played.chunk)), round: played.state.round, sent };
        if (played.end !== "round") {
          endings[played.reason] = (endings[played.reason] ?? 0) + 1;
          continue;
        }
        children.push({ state: played.state, trail: { prev: line.trail, chunk: played.chunk }, score: scoreOf(played.state, ctx, options.hook) });
      }
    }
    if (children.length === 0) {
      attempts[depth] = attempt + 1;
      if (attempt + 1 >= 3) {
        stack.pop();
        attempts.pop();
        if (stack.length > 0) attempts[stack.length - 1] = (attempts[stack.length - 1] ?? 0) + 1;
        if (stack.length === 0) return outcome("lost", null);
      }
      continue;
    }
    const next = select(children, ctx, options.width);
    const top = next.reduce((one, other) => (other.score > one.score ? other : one));
    // The best line is the best of the deepest round reached.
    if (stack.length > deepest || (stack.length === deepest && top.score > best.score)) {
      deepest = stack.length;
      best = top;
    }
    options.report?.(`round ${top.state.round}: ${children.length} lines, best ${Math.round(top.score)}, ${describe(top.state)}`);
    stack.push(next);
    attempts.push(0);
  }
  return outcome("lost", null);
}
