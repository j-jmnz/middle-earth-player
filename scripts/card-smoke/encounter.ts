import { existsSync } from "node:fs";
import path from "node:path";

import { PLAYABLE_SCENARIOS } from "../../src/campaign/playable.ts";
import type { ScenarioState } from "../../src/rules/engine/reduce.ts";

import { DATA_DIR } from "../data/paths.ts";
import { describeError, duration, runScript, type Log } from "../log.ts";
import { encounterCards, probeCard, probesOf, type CardResult } from "./encounter-cards.ts";
import { GAMES, playGame, type GameSummary } from "./encounter-games.ts";
import { encounterStart, encounterWorld, kept, type EncounterWorld } from "./encounter-world.ts";

// A smoke test for one scenario's encounter side. Every encounter-side card the scenario deals is played once on a table made from the
// scenario's own opening, and a few dozen seeded games are played with random legal intents (scripts/card-smoke/encounter-cards.ts,
// encounter-games.ts). A throw, a refused intent, `state.failure`, a window that never closes, a game that does not end or one
// that does not replay to the same state is a problem, reported with the card or the game, the intent and the step. It proves that
// the records run without breaking the game, not that they do what the cards say. `pnpm test:scenario` runs it for each scenario.
//
// Usage: node --experimental-strip-types scripts/card-smoke/encounter.ts <scenario-id>... [--all] [--games=<n>] [--cards-only] [--games-only] [--verbose]
// --all smokes every playable scenario (src/campaign/playable.ts).

export type EncounterSummary = { scenario: string; cards: CardResult[]; games: GameSummary[]; ms: number };

/** The table the card probes run on: the scenario dealt to one seat, its first seat kept. */
export function probeTable(world: EncounterWorld): ScenarioState {
  return kept(encounterStart(world, 1, 1), world.contexts.strong);
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

export function problemsOf(summary: EncounterSummary): string[] {
  const cards = summary.cards.flatMap((result) => (result.problem ? [`${summary.scenario} card ${result.code} ${result.probe}: ${result.problem}`] : []));
  const games = summary.games.flatMap((game) => {
    const problem = game.problem;
    if (!problem) return [];
    return [`${summary.scenario} game ${game.game} (seed ${game.seed}, ${game.profile} heroes, ${game.seats} seat${game.seats > 1 ? "s" : ""}) intent ${problem.step} (round ${problem.round}, window ${problem.window ?? "none"}): ${JSON.stringify(problem.intent)}: ${problem.message}`];
  });
  return [...cards, ...games];
}

export function formatSummary(summary: EncounterSummary): string {
  const ended = (kind: GameSummary["ended"]) => summary.games.filter((game) => game.ended === kind).length;
  const probes = summary.cards.length;
  const notes = summary.cards.filter((result) => result.note != null).length;
  const head = `${summary.scenario}: ${probes} card probes (${notes} with nothing to run), ${summary.games.length} games (${ended("won")} won, ${ended("lost")} lost, ${ended("problem")} problems), ${duration(summary.ms)}`;
  return [head, ...problemsOf(summary).map((line) => `  problem: ${line}`)].join("\n");
}

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2);
  const number = (name: string) => {
    const value = args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
    return value == null ? undefined : Number(value);
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
