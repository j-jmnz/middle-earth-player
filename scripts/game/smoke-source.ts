// The smoke runs as `pnpm game` sources (scripts/game/source.ts), so a smoke failure opens on its table:
// - `encounter:<scenario-id>:<game>` is one numbered game of `pnpm test encounter` (scripts/card-smoke/encounter-games.ts), played again from its start: its
//   accepted intents, then the one that failed. The game is the same every run, so `--at` and `log` read it like a fixture.
// - `smoke:<code>[:<seed>[:<deal>]]` is one card's run of `pnpm test smoke` (scripts/card-smoke/run.ts). That run deals copies of the card between intents,
//   outside the reducer, so it cannot be replayed from its start: the source opens on the table the failing intent was sent on, with that intent to send.
import { startScenario } from "../../src/rules/engine/reduce.ts";

import { recordGame } from "../card-smoke/encounter-games.ts";
import { encounterWorld } from "../card-smoke/encounter-world.ts";
import { smokeCard } from "../card-smoke/run.ts";
import { smokeWorld } from "../card-smoke/world.ts";
import type { GameSource } from "./source.ts";

function whole(text: string | undefined, label: string): number | undefined {
  if (text === undefined || text === "") return undefined;
  if (!/^\d+$/.test(text)) throw new Error(`${label} is a whole number, not ${text}`);
  return Number(text);
}

export async function encounterSource(scenarioId: string, game: string): Promise<GameSource> {
  const number = whole(game, "the game") ?? 0;
  const record = recordGame(await encounterWorld(scenarioId), number);
  if (!record.start) throw new Error(`encounter game ${number} of ${scenarioId} did not start: ${record.summary.problem?.message ?? "no start"}`);
  const { summary } = record;
  const how = summary.problem ? `problem at intent ${summary.problem.step}: ${summary.problem.message}` : `ended ${summary.ended} after ${summary.steps} intents`;
  return {
    label: `encounter smoke ${scenarioId} game ${number} (seed ${summary.seed}, ${summary.profile} heroes, ${summary.seats} seat${summary.seats > 1 ? "s" : ""}), ${how}`,
    ctx: record.ctx,
    opening: startScenario(record.start, record.ctx),
    intents: [...record.intents, ...(record.failing ? [record.failing] : [])],
  };
}

export async function cardSmokeSource(code: string, seed?: string, deal?: string): Promise<GameSource> {
  const world = await smokeWorld([code], whole(deal, "the deal seed"));
  const summary = smokeCard(code, { world, seed: whole(seed, "the seed") });
  const problem = summary.problems[0];
  if (!problem) return { label: `card smoke ${code}: no problem (ended ${summary.ended} after ${summary.steps} steps); the starter game's planning table`, ctx: world.ctx, opening: world.planning, intents: [] };
  return {
    label: `card smoke ${code}: step ${problem.step}, ${problem.message}; the table it was sent on, then that intent`,
    ctx: world.ctx,
    opening: problem.before,
    intents: problem.intent ? [problem.intent] : [],
  };
}
