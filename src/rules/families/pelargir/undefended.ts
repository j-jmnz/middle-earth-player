// Rules: rr.step-6-4-1, ltp.undefended-attack, rr.step-6-4-3, ats.losing-control-of-locations (data/rules/entries.json); ledger lines 06096:A:2, 06097:A:2, 06098:A:3, 06099:A:3.
// "After the player who controls West Gate lets an attack go undefended": the family's combat hook hears the damage of the enemy attack in progress (noteAttackDamage runs it for a defended and an undefended attack, whatever the damage, even none) and, when the attack had no defender, announces
// `attackUndefended` about the defending player, with the enemy as the other card. A canceled attack never reaches the damage, so it is not announced.
import type { EngineStep } from "../../core/intents.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { queueEvent } from "../../windows/queue.ts";

/** The combat hook `damaged`: `before` holds the attack in progress as it was when its damage was dealt. Inert unless the game has a record that hears `attackUndefended`. */
export function undefendedAnnounced(before: ScenarioState, after: ScenarioState, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState {
  const attack = before.pendingAttack;
  if (!attack || !(attack.defenderId == null || attack.undefended) || !gameReads(after, ctx, '"attackUndefended"')) return after;
  return queueEvent(after, { trigger: "attackUndefended", seat: attack.seat, other: attack.enemyId });
}
