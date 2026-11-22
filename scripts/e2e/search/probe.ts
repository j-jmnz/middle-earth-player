import type { PlayerIntent } from "../../../src/rules/core/intents.ts";
import { reduce, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { movesOf, type Style } from "./moves.ts";
import { scoreOf, type ScoreHook } from "./score.ts";

// A look one intent ahead for the cards and Actions a line uses freely: an effect that costs the table more than it gives (a threat raise, damage to
// its own heroes) is not worth sending. The intent is sent on a copy and its own follow-up windows (a choice of target, a look at the top of the
// deck) are answered with the first option each lists; the score before and after are compared. An effect that gains nothing the score can see
// (a card drawn, a resource added) is not held back.

/** The windows an effect opens that its own intent answers: a choice, a look, a cancel offer. */
const FOLLOWING = new Set(["choose", "look", "cancelOffer"]);

/** The most follow-up intents one probe sends. */
const MOST_FOLLOWING = 12;

/** The score of the table once `intent` is sent and its follow-up windows are answered, or null when the reducer refuses it. */
function after(state: ScenarioState, intent: PlayerIntent, ctx: ReduceContext, style: Style, hook?: ScoreHook): number | null {
  const first = reduce(state, intent, ctx);
  if (!first.ok) return null;
  let next = first.state;
  for (let step = 0; step < MOST_FOLLOWING && next.window != null && FOLLOWING.has(next.window.kind) && !next.lost && !next.stageCleared; step += 1) {
    const answer = movesOf(next, ctx, new Set(), style)[0];
    if (!answer) break;
    const result = reduce(next, answer, ctx);
    if (!result.ok) break;
    next = result.state;
  }
  return scoreOf(next, ctx, hook);
}

/** True when sending `intent` lowers the score of the table once its follow-up windows are answered. */
export function hurts(state: ScenarioState, intent: PlayerIntent, ctx: ReduceContext, style: Style, hook?: ScoreHook): boolean {
  const score = after(state, intent, ctx, style, hook);
  return score != null && score < scoreOf(state, ctx, hook) - 0.5;
}

/** The options of a choice window, the one that leaves the table with the best score first (the others in their order). */
export function bestFirst(state: ScenarioState, options: readonly PlayerIntent[], ctx: ReduceContext, style: Style, hook?: ScoreHook): PlayerIntent[] {
  const scored = options.map((intent, index) => ({ intent, index, score: after(state, intent, ctx, style, hook) ?? -Infinity }));
  return scored.sort((left, right) => right.score - left.score || left.index - right.index).map((entry) => entry.intent);
}
