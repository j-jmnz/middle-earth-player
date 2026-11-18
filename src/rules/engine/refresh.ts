// Rules: rr.refresh-phase, rr.step-7-3, ltp.phase-7-refresh, dwd.regenerate (data/rules/entries.json).
import { ruleCause } from "../core/cause.ts";
import type { GameEvent } from "../windows/frame-types.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { raiseThreat } from "../core/keywords.ts";
import { gameReads } from "../core/game-reads.ts";
import { queueEvent } from "../windows/queue.ts";
import { fireForced } from "../windows/triggers.ts";
import { flagged, livingSeats, updateCards, withMode, type CardInstance, type ScenarioState } from "../core/state.ts";
import { inPlay } from "../core/zones.ts";
import { readiedThisPhase, readyPatch } from "../core/holder-classes.ts";
import { regenerateEnemies } from "../families/encounter/regenerate.ts";

export function doRefresh(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // A Response to "After a character readies during the refresh phase" (02102:A:1) hears each card that readies here.
  const heard = gameReads(state, ctx, '"trigger":"readied"');
  const patches: [string, Partial<CardInstance>][] = [];
  const readied: GameEvent[] = [];
  for (const instance of Object.values(state.cards)) {
    if (!inPlay(instance.zone) || (!instance.exhausted && !instance.committed)) continue;
    // "Does not ready during the refresh phase" (a flag) leaves the card exhausted.
    // So does "cannot ready" (cannotReady, 900103:A:1), and a card readied in this phase already that cannot be readied more than once per phase (22134:B:2).
    const stays = instance.exhausted && (flagged(state, instance.id, "doesNotReady") || flagged(state, instance.id, "cannotReady") || readiedThisPhase(state, instance.id));
    patches.push([instance.id, instance.exhausted && !stays ? { ...readyPatch(state, instance.id), committed: false } : { exhausted: stays, committed: false }]);
    if (heard && instance.exhausted && !stays) readied.push({ trigger: "readied", seat: instance.controller, cardId: instance.id, phase: "Refresh" });
  }
  let next = updateCards(state, patches);
  for (const event of readied) next = queueEvent(next, event);
  // "Players do not raise their threat at the end of the refresh phase" (noRefreshThreat, 146042:A:1).
  // The campaign card of Escape from Mount Gram raises it by its own count instead (families/captured/values.ts).
  if (!flagged(next, "table", "noRefreshThreat") && next.capture?.refresh !== true) for (const seat of livingSeats(next)) next = raiseThreat(next, seat, 1, steps, ruleCause("rr.step-7-3"));
  // Regenerate X (dwd.regenerate): right after the first player token passes, before player actions.
  return withMode(regenerateEnemies(passToken(next, ctx, steps), ctx, steps), "endRound");
}

// The token moves to the next seat still in the game, then the event is announced to cards in play.
// Only this function announces it.
function passToken(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.seatCount === 1) return state;
  // "For the rest of the game, you cannot lose control of the first player token" (142068:A:2): the token stays, unless its holder is eliminated.
  if (flagged(state, "table", "firstPlayerLocked") && !state.seats[state.firstPlayer]?.eliminated) return state;
  for (let step = 1; step <= state.seatCount; step += 1) {
    const index = (state.firstPlayer + step) % state.seatCount;
    if (state.seats[index]?.eliminated) continue;
    if (index === state.firstPlayer) return state;
    return fireForced({ ...state, firstPlayer: index }, { trigger: "firstPlayerTokenPassed", seat: index }, ctx, steps);
  }
  return state;
}
