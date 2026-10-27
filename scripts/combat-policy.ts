import { expectOk } from "../src/rules/fixture.ts";
import type { EngineStep } from "../src/rules/intents.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";
import { modifiedStat } from "../src/rules/keywords.ts";

import { nextIntent } from "./auto-player.ts";
import { RING_BEARER } from "./starter-game.ts";

// Test helper. The auto-player never attacks (its goldens are pinned), so a test of combat plays a whole starter game with this
// policy instead (src/campaign/combat-flow.test.ts, src/play/clash.test.ts): the seat keeps its `keep` best attackers ready,
// back from the quest and from defense, and attacks the first enemy it can with every character that may join.

// The heroes with the most attack, kept back from the quest and from defense so the seat has someone to attack with.
function strikers(state: ScenarioState, ctx: ReduceContext, keep: number): string[] {
  const heroes = state.seats[state.activeSeat]?.heroes ?? [];
  const attack = (id: string) => modifiedStat(state, state.cards[id] ?? (null as never), "attack", ctx.cards);
  return [...heroes].filter((id) => state.cards[id]?.code !== RING_BEARER).sort((a, b) => attack(b) - attack(a)).slice(0, keep);
}

export function attackOrPolicy(state: ScenarioState, ctx: ReduceContext, keep = 1): PlayerIntent {
  const kept = strikers(state, ctx, keep);
  const legal = legalIntents(state, ctx);
  if (state.mode === "questCommit" && state.window?.kind === "pass" && legal.some((intent) => intent.type === "Commit")) {
    const cardIds = legalTargets(state, { type: "Commit" }, ctx).filter((id) => !kept.includes(id));
    if (cardIds.length > 0) return { type: "Commit", cardIds };
  }
  if (state.window?.kind === "defense" && kept.length > 0) {
    const heroes = legalTargets(state, { type: "Undefended" }, ctx).filter((id) => !kept.includes(id) && state.cards[id]?.code !== RING_BEARER);
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => !kept.includes(id));
    if (defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    if (heroes[0]) return { type: "Undefended", heroId: heroes[0] };
  }
  if (state.window?.kind === "playerAttack" && legal.some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.seats[state.activeSeat];
    const ids = [...(seat?.heroes ?? []), ...(seat?.play ?? [])];
    const enemyId = ids.flatMap((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx))[0];
    if (enemyId) {
      const attackerIds = ids.filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).includes(enemyId));
      return { type: "DeclareAttackers", enemyId, attackerIds };
    }
  }
  return nextIntent(state, ctx, { scout: "01002", prefer: "141035", protect: RING_BEARER, play: true, act: true });
}

/** One accepted intent: the state it was sent in, the state it left, the engine's steps and the intent. */
export type Reduced = { prev: ScenarioState; next: ScenarioState; steps: readonly EngineStep[]; intent: PlayerIntent };

/** Plays `start` with the policy until an intent `wanted` accepts, and returns it; null when the game ends or 900 intents pass first. */
export function playUntil(ctx: ReduceContext, start: ScenarioState, keep: number, wanted: (reduced: Reduced) => boolean): Reduced | null {
  let state = start;
  for (let turn = 0; turn < 900 && !state.lost && !state.stageCleared; turn += 1) {
    const intent = attackOrPolicy(state, ctx, keep);
    const result = expectOk(reduce(state, intent, ctx));
    const reduced = { prev: state, next: result.state, steps: result.steps, intent };
    if (wanted(reduced)) return reduced;
    state = result.state;
  }
  return null;
}
