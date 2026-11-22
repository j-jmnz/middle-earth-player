import type { PlayerIntent } from "../../../src/rules/core/intents.ts";
import { reduce, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { duration, type Log } from "../../log.ts";
import { searchGame, type BeamOutcome } from "./beam.ts";
import type { SearchFlags } from "./options.ts";
import type { ScoreHook } from "./score.ts";

// The finder's use of the search: deal each seed of the range, search it within the time left, print one line per seed, and on a win replay
// the intents on a fresh deal to prove the game is a real save.

export type DealtGame<L> = { loadout: L; state: ScenarioState; ctx: ReduceContext };
export type FoundWin<L> = { seed: number; loadout: L; intents: PlayerIntent[] };

/** Plays `intents` from the dealt state: the state they reach, or null when the reducer refuses one. */
export function replayIntents(start: ScenarioState, ctx: ReduceContext, intents: readonly PlayerIntent[]): ScenarioState | null {
  let state = start;
  for (const intent of intents) {
    const result = reduce(state, intent, ctx);
    if (!result.ok) return null;
    state = result.state;
  }
  return state;
}

const peakMegabytes = (): number => Math.round(process.resourceUsage().maxRSS / 1024);

function summary(outcome: BeamOutcome): string {
  const ended = Object.entries(outcome.endings).sort((left, right) => right[1] - left[1]).slice(0, 3).map(([reason, count]) => `${reason} x${count}`).join("; ");
  return `round ${outcome.round}, best ${outcome.best} (${outcome.stage}), ${outcome.stopped}${ended ? `, lines ended by: ${ended}` : ""}`;
}

/** The passes over the seeds when the flags name no width or branches: a quick look at every seed, then wider ones. `share` is the part of the time each takes. */
const PASSES: readonly { width: number; branches: number; share: number }[] = [
  { width: 3, branches: 4, share: 0.2 },
  { width: 6, branches: 6, share: 0.35 },
  { width: 10, branches: 8, share: 0.45 },
];

/**
 * Searches the seeds of `flags` for a game `wanted` accepts (a stage cleared and the game not lost). It looks at every seed quickly first and then
 * again wider, so a seed that wins easily is found before the time goes to a seed that does not; each seed gets an equal share of its pass. Null,
 * with a warning, when none wins within `flags.budgetSeconds`.
 */
export function searchWin<L>(say: Log, label: string, deal: (seed: number) => DealtGame<L>, wanted: (state: ScenarioState) => boolean, flags: SearchFlags, hook?: ScoreHook): FoundWin<L> | null {
  const total = flags.budgetSeconds * 1000;
  const seeds = flags.seedTo - flags.seedFrom + 1;
  const passes = flags.width != null || flags.branches != null ? [{ width: flags.width ?? 6, branches: flags.branches ?? 6, share: 1 }] : PASSES;
  for (const [number, pass] of passes.entries()) {
    const each = (total * pass.share) / seeds;
    for (let seed = flags.seedFrom; seed <= flags.seedTo; seed += 1) {
      const dealt = deal(seed);
      const began = Date.now();
      const outcome = searchGame(dealt.state, dealt.ctx, seed, { width: pass.width, branches: pass.branches, rounds: flags.rounds, deadline: began + each, hook, report: (message) => say.debug(`${label} seed ${seed}: ${message}`) });
      say.info(`${label} pass ${number + 1} seed ${seed}: ${duration(Date.now() - began)}, ${outcome.sent} intents sent, peak ${peakMegabytes()} MB, ${summary(outcome)}`);
      if (!outcome.won) continue;
      const end = replayIntents(dealt.state, dealt.ctx, outcome.won);
      if (!end || !end.stageCleared || end.lost || !wanted(end)) {
        say.warn(`${label} seed ${seed}: the won line does not replay to a wanted win, so it is dropped`);
        continue;
      }
      say.info(`${label}: found by search, seed ${seed}, ${outcome.won.length} intents, round ${end.round}`);
      return { seed, loadout: dealt.loadout, intents: outcome.won };
    }
  }
  say.warn(`no ${label} game found by search in seeds ${flags.seedFrom}-${flags.seedTo}`);
  return null;
}
