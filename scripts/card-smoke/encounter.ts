import { existsSync } from "node:fs";
import path from "node:path";

import { PLAYABLE_SCENARIOS } from "../../src/campaign/playable.ts";
import { legalIntents, reduce, type PlayerIntent, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import { flagged } from "../../src/rules/core/state.ts";
import { expectOk } from "../../src/rules/core/test-fixture.ts";

import { DATA_DIR } from "../data/paths.ts";
import { describeError, duration, runScript, type Log } from "../log.ts";
import { encounterCards, probeCard, probesOf, type CardResult } from "./encounter-cards.ts";
import { GAMES, playGame, type GameSummary } from "./encounter-games.ts";
import { encounterStart, encounterWorld, kept, type EncounterWorld } from "./encounter-world.ts";

// A smoke test for one scenario's encounter side. Every encounter-side card the scenario deals is played once on a table made from the
// scenario's own opening, and a few dozen seeded games are played with random legal intents (scripts/card-smoke/encounter-cards.ts,
// encounter-games.ts). A throw, a refused intent, `state.failure`, a window that never closes, a game that does not end or one
// that does not replay to the same state is a problem, reported with the card or the game, the intent and the step. It proves that
// the records run without breaking the game, not that they do what the cards say. `pnpm test scenario` runs it for each scenario.
//
// Usage: pnpm test encounter <scenario-id>... [--all] [--games=<n>] [--cards-only] [--games-only] [--verbose]
// --all smokes every playable scenario (src/campaign/playable.ts).

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

/** Plays every encounter-side card of the scenario, and `games` seeded random games (none with 0). */
export async function smokeScenario(scenarioId: string, options: { games?: number; cards?: boolean } = {}): Promise<EncounterSummary> {
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
  for (let game = 0; game < (options.games ?? GAMES); game += 1) games.push(playGame(world, game));
  return { scenario: scenarioId, cards: results, games, ms: performance.now() - begin };
}

const gameLine = (scenario: string, game: GameSummary, problem: NonNullable<GameSummary["problem"]>): string =>
  `${scenario} game ${game.game} (seed ${game.seed}, ${game.profile} heroes, ${game.seats} seat${game.seats > 1 ? "s" : ""}) intent ${problem.step} (round ${problem.round}, window ${problem.window ?? "none"}): ${JSON.stringify(problem.intent)}: ${problem.message} (\`pnpm game show encounter:${scenario}:${game.game} --legal\` opens it)`;

/** The problems of a summary that are not in `known`: what fails the run. */
export function problemsOf(summary: EncounterSummary, known: readonly KnownFailure[] = KNOWN): string[] {
  const cards = summary.cards.flatMap((result) => (result.problem ? [`${summary.scenario} card ${result.code} ${result.probe}: ${result.problem}`] : []));
  const games = summary.games.flatMap((game) => (game.problem && !knownFailure(summary.scenario, game, known) ? [gameLine(summary.scenario, game, game.problem)] : []));
  return [...cards, ...games];
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

export function formatSummary(summary: EncounterSummary): string {
  const ended = (kind: GameSummary["ended"]) => summary.games.filter((game) => game.ended === kind).length;
  const knownLines = knownOf(summary);
  const probes = summary.cards.length;
  const notes = summary.cards.filter((result) => result.note != null).length;
  const head = `${summary.scenario}: ${probes} card probes (${notes} with nothing to run), ${summary.games.length} games (${ended("won")} won, ${ended("lost")} lost, ${ended("problem") - knownLines.length} problems${knownLines.length > 0 ? `, ${knownLines.length} known` : ""}), ${duration(summary.ms)}`;
  return [head, ...problemsOf(summary).map((line) => `  problem: ${line}`), ...knownLines.map((line) => `  known: ${line}`)].join("\n");
}

/** A non-negative whole number from a flag: `--games=abc` is an error, not a run of no games that passes. */
export function countOf(name: string, value: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`--${name}=${value}: expected a whole number`);
  return Number(value);
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
  let failed = 0;
  for (const id of ids) {
    try {
      const summary = await smokeScenario(id, { ...(games == null ? {} : { games }), cards: !args.includes("--games-only") });
      if (problemsOf(summary).length > 0) failed += 1;
      (problemsOf(summary).length > 0 ? log.error : log.info)(formatSummary(summary));
    } catch (error) {
      failed += 1;
      log.error(`${id}: ${describeError(error)}`);
    }
  }
  if (failed > 0) throw new Error(`${failed} of ${ids.length} scenarios had problems`);
}


if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) void runScript("encounter-smoke", main);
