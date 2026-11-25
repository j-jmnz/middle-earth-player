import { existsSync } from "node:fs";
import path from "node:path";

import { PLAYABLE_SCENARIOS } from "../../src/campaign/playable.ts";
import { legalIntents, reduce, type PlayerIntent, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import { flagged } from "../../src/rules/core/state.ts";
import { expectOk } from "../../src/rules/core/test-fixture.ts";

import { DATA_DIR } from "../data/paths.ts";
import { describeError, duration, runScript, type Log } from "../log.ts";
import { encounterCards, probeCard, probesOf, type CardResult } from "./encounter-cards.ts";
import { formatIdle } from "./idle.ts";
import { unknownIdle } from "./idle-known.ts";
import { GAMES, playGame, type GameSummary } from "./encounter-games.ts";
import { encounterStart, encounterWorld, kept, type EncounterWorld } from "./encounter-world.ts";

// A smoke test for one scenario's encounter side. Every encounter-side card the scenario deals is played once on a table made from the
// scenario's own opening, and a few dozen seeded games are played with random legal intents (scripts/card-smoke/encounter-cards.ts,
// encounter-games.ts). A throw, a refused intent, `state.failure`, a window that never closes, a game that does not end or one
// that does not replay to the same state is a problem, reported with the card or the game, the intent and the step. It proves that
// the records run without breaking the game, not that they do what the cards say. `pnpm test scenario` runs it for each scenario.
//
// Usage: pnpm test encounter <scenario-id>... [--all] [--games=<n>] [--from=<n>] [--minutes=<n>] [--cards-only] [--games-only] [--verbose]
// --all smokes every playable scenario (src/campaign/playable.ts).
// --from=<n> numbers the first game n instead of 0: game n is the same game every run (profile, seat count and seed follow from the number), so a new range is new seeds.
// --minutes=<n> is the soak (.claude/agents/orchestrator.md, Implementer tasks): games only, from a random first number (printed, or --from), as many as fit in n minutes, the time shared
// by the scenarios named. The committed smoke and `pnpm test scenario` use the fixed numbers 0 to 23, so a soak finds what they do not. A problem prints the `pnpm game show` source that opens it.

/**
 * Failures the engine has and this smoke reports without failing the run, each open in a GitHub issue its note names. A game is named by its scenario, number and seed, and the entry matches only the
 * message that contains `error` on an intent that contains `intent`: any other problem of that game, and any other game, still fails. Delete an entry when its engine fix lands.
 */
export type KnownFailure = { scenario: string; game: number; seed: number; intent: string; error: string; note: string };
export const KNOWN: readonly KnownFailure[] = [];

export type EncounterSummary = { scenario: string; cards: CardResult[]; games: GameSummary[]; ms: number };

/** The table the card probes run on: the scenario dealt to one seat, its first seat kept. A quest card's Setup that asks (The Uruk-hai: each seat chooses a Captive) is answered with the first intent offered,
 * except that a table whose combat phase is skipped (Helm's Deep's stage 1B) cannot play the shadow probes, so the first answer that leaves combat to be played is taken when there is one. */
export function probeTable(world: EncounterWorld): ScenarioState {
  const ctx = world.contexts.strong;
  let state = kept(encounterStart(world, 1, 1), ctx);
  for (let guard = 0; guard < 20 && state.window?.kind === "choose" && state.phase === "Beginning of round"; guard += 1) {
    const offered = legalIntents(state, ctx);
    // An answer the engine offers and then refuses is a fault of the table, not a probe to skip.
    const answers = offered.map((intent) => expectOk(reduce(state, intent as PlayerIntent, ctx)).state);
    const next = answers.find((answer) => !flagged(answer, "table", "skipCombat")) ?? answers[0];
    if (!next) break;
    state = next;
  }
  return state;
}

/**
 * Plays every encounter-side card of the scenario, and `games` seeded random games (none with 0), numbered from `from` (0 by default). With `until` (a time on the `performance.now()` clock) it plays games from
 * `from` until then instead of `games` of them, and at least one.
 */
export async function smokeScenario(scenarioId: string, options: { games?: number; cards?: boolean; from?: number; until?: number } = {}): Promise<EncounterSummary> {
  const begin = performance.now();
  const world = await encounterWorld(scenarioId);
  const ctx = world.contexts.strong;
  const results: CardResult[] = [];
  if (options.cards !== false) {
    const base = probeTable(world);
    const { cards, stages } = encounterCards(world.scenario);
    for (const card of cards) for (const probe of probesOf(ctx, card)) results.push(probeCard(base, ctx, card.code, probe));
    for (const stage of stages) for (const probe of probesOf(ctx, { stage })) results.push(probeCard(base, ctx, stage, probe));
  }
  const games: GameSummary[] = [];
  const first = options.from ?? 0;
  const more = (played: number): boolean => (options.until === undefined ? played < (options.games ?? GAMES) : played === 0 || performance.now() < options.until);
  for (let played = 0; more(played); played += 1) games.push(playGame(world, first + played));
  return { scenario: scenarioId, cards: results, games, ms: performance.now() - begin };
}

const gameLine = (scenario: string, game: GameSummary, problem: NonNullable<GameSummary["problem"]>): string =>
  `${scenario} game ${game.game} (seed ${game.seed}, ${game.profile} heroes, ${game.seats} seat${game.seats > 1 ? "s" : ""}) intent ${problem.step} (round ${problem.round}, window ${problem.window ?? "none"}): ${JSON.stringify(problem.intent)}: ${problem.message} (\`pnpm game show encounter:${scenario}:${game.game} --legal\` opens it)`;

/** The problems of a summary that are not in `known`: what fails the run. */
export function problemsOf(summary: EncounterSummary, known: readonly KnownFailure[] = KNOWN): string[] {
  const cards = summary.cards.flatMap((result) => (result.problem ? [`${summary.scenario} card ${result.code} ${result.probe}: ${result.problem}`] : []));
  const games = summary.games.flatMap((game) => (game.problem && !knownFailure(summary.scenario, game, known) ? [gameLine(summary.scenario, game, game.problem)] : []));
  // An ability a player used that changed nothing (scripts/card-smoke/idle.ts).
  const idle = summary.games.flatMap((game) => unknownIdle(game.idle).map((hit) => `${summary.scenario} game ${game.game}: ${formatIdle(hit)}`));
  return [...cards, ...games, ...idle];
}

/** The known failure a game's problem is, or undefined (a different message, intent, game or seed is not it). */
export function knownFailure(scenario: string, game: GameSummary, known: readonly KnownFailure[] = KNOWN): KnownFailure | undefined {
  const problem = game.problem;
  if (!problem) return undefined;
  return known.find((item) => item.scenario === scenario && item.game === game.game && item.seed === game.seed && problem.message.includes(item.error) && JSON.stringify(problem.intent).includes(item.intent));
}

/** The games whose problem is a known failure, as report lines. */
export function knownOf(summary: EncounterSummary, known: readonly KnownFailure[] = KNOWN): string[] {
  return summary.games.flatMap((game) => {
    const item = knownFailure(summary.scenario, game, known);
    return item && game.problem ? [`${gameLine(summary.scenario, game, game.problem)} (known: ${item.note})`] : [];
  });
}

/** The lost games by reason, the most frequent first (ties by the reason's text): `["No seats remain", 18]`. A game that did not end lost has none; a lost game always has its reason (`recordGame`, encounter-games.ts, records it). */
export function lossesOf(games: readonly GameSummary[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const { ended, lossReason } of games) if (ended === "lost" && lossReason !== null) counts.set(lossReason, (counts.get(lossReason) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"));
}

export function formatSummary(summary: EncounterSummary): string {
  const ended = (kind: GameSummary["ended"]) => summary.games.filter((game) => game.ended === kind).length;
  const knownLines = knownOf(summary);
  const probes = summary.cards.length;
  const notes = summary.cards.filter((result) => result.note != null).length;
  const losses = lossesOf(summary.games);
  const lostBy = losses.length > 0 ? ` (${losses.map(([reason, count]) => `${reason} x${count}`).join(", ")})` : "";
  const head = `${summary.scenario}: ${probes} card probes (${notes} with nothing to run), ${summary.games.length} games (${ended("won")} won, ${ended("lost")} lost${lostBy}, ${ended("problem") - knownLines.length} problems${knownLines.length > 0 ? `, ${knownLines.length} known` : ""}), ${duration(summary.ms)}`;
  return [head, ...problemsOf(summary).map((line) => `  problem: ${line}`), ...knownLines.map((line) => `  known: ${line}`)].join("\n");
}

/** A non-negative whole number from a flag: `--games=abc` is an error, not a run of no games that passes. */
export function countOf(name: string, value: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`--${name}=${value}: expected a whole number`);
  return Number(value);
}

/** The first game number of a soak: `from` when given, else a random number past the committed games, so each soak plays seeds the last one did not. */
export function soakStart(from: number | undefined, random: () => number = Math.random): number {
  return from ?? GAMES + Math.floor(random() * 1_000_000);
}

/** The command that plays a soak's games of one scenario again: the same first number and as many games as the soak played (`--games-only` leaves out the card probes). */
export function replayCommand(scenario: string, from: number, games: number): string {
  return `pnpm test encounter ${scenario} --from=${from} --games=${games} --games-only`;
}

/** The line a soak adds after a scenario's summary: how to replay it, and that KNOWN (keyed by game number) is not matched, so a known failure shows as a problem here. */
export function soakNote(scenario: string, from: number, games: number): string {
  return `  replay: ${replayCommand(scenario, from, games)} (a soak does not match KNOWN: a known failure shows as a problem; compare its message with the KNOWN entries)`;
}

/** When the next scenario of a soak must stop: its share of the time left, `remaining` scenarios including it. */
export function soakDeadline(now: number, end: number, remaining: number): number {
  return now + Math.max(0, end - now) / Math.max(1, remaining);
}

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2);
  const number = (name: string) => {
    const value = args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
    return value == null ? undefined : countOf(name, value);
  };
  const named = args.filter((arg) => !arg.startsWith("--"));
  const ids = args.includes("--all") ? [...PLAYABLE_SCENARIOS] : named;
  if (ids.length === 0) throw new Error("Name at least one scenario id, or --all");
  const unknown = ids.filter((id) => !existsSync(path.join(DATA_DIR, "scenarios", `${id}.json`)));
  if (unknown.length > 0) throw new Error(`Not a scenario in data/scenarios: ${unknown.join(", ")}`);
  const games = args.includes("--cards-only") ? 0 : number("games");
  const minutes = number("minutes");
  if (minutes !== undefined && (args.includes("--cards-only") || games !== undefined)) throw new Error("--minutes plays games only, as many as fit: it takes neither --cards-only nor --games");
  const from = minutes === undefined ? number("from") : soakStart(number("from"));
  const end = minutes === undefined ? 0 : performance.now() + minutes * 60_000;
  if (minutes !== undefined) log.info(`soak: ${minutes} min over ${ids.length} scenarios, games from number ${from}; each scenario's summary is followed by the command that plays its games again`);
  let failed = 0;
  for (const [at, id] of ids.entries()) {
    try {
      const soak = minutes === undefined ? {} : { until: soakDeadline(performance.now(), end, ids.length - at) };
      const summary = await smokeScenario(id, { ...(games == null ? {} : { games }), ...(from == null ? {} : { from }), ...soak, cards: minutes === undefined && !args.includes("--games-only") });
      if (problemsOf(summary).length > 0) failed += 1;
      (problemsOf(summary).length > 0 ? log.error : log.info)(formatSummary(summary));
      if (minutes !== undefined && from !== undefined) log.info(soakNote(id, from, summary.games.length));
    } catch (error) {
      failed += 1;
      log.error(`${id}: ${describeError(error)}`);
    }
  }
  if (failed > 0) throw new Error(`${failed} of ${ids.length} scenarios had problems`);
}


if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) void runScript("encounter-smoke", main);
