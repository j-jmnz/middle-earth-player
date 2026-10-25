// Rules: rr.framework-steps, rr.action-windows, rr.attack-resolution-chart, faq.enemy-attacks-outside-combat
// (data/rules/entries.json).
import type { ReduceContext } from "./interpret.ts";
import { legalIntents } from "./legal.ts";
import { actingSeats, openFrameActions } from "./pass.ts";
import { markReached, reached, type ScenarioState } from "./state.ts";

// Some seat could take an action now: play an event or trigger an Action the window allows.
export function anyAction(state: ScenarioState, ctx: ReduceContext): boolean {
  const probe: ScenarioState = { ...state, window: { kind: "frameAction" }, passed: [] };
  return actingSeats(probe).some((seat) => legalIntents({ ...probe, activeSeat: seat }, ctx).some((intent) => intent.type !== "Pass"));
}

// The action windows of the framework between its steps. A window opens when some seat has an action it could take, and
// closes in place when every seat has passed in a row; one nobody could use changes nothing, so it is skipped. `step`
// names the point, and each opens once a round.
export function stepWindow(state: ScenarioState, ctx: ReduceContext, step: string): ScenarioState | null {
  if (reached(state, step)) return null;
  const marked = markReached(state, step);
  return anyAction(marked, ctx) ? openFrameActions(marked) : null;
}

export type EnemyAttackStep = "defense" | "shadow" | "damage" | "end";
export type PlayerAttackStep = "strike" | "end";

// The window between two steps of an enemy attack (6.4b to 6.4.4), in or out of the combat phase. `then` is the step that
// follows it; the attack waits for it until the window and anything played in it are done.
export function enemyAttackWindow(state: ScenarioState, ctx: ReduceContext, then: EnemyAttackStep): ScenarioState | null {
  const attack = state.pendingAttack;
  if (!attack || !anyAction(state, ctx)) return null;
  return openFrameActions({ ...state, pendingAttack: { ...attack, awaiting: then, awaitDepth: state.stack.length } });
}

// The window between two steps of a player attack (6.8.1 to 6.8.4).
export function playerAttackWindow(state: ScenarioState, ctx: ReduceContext, then: PlayerAttackStep): ScenarioState | null {
  const strike = state.pendingStrike;
  if (!strike || !anyAction(state, ctx)) return null;
  return openFrameActions({ ...state, pendingStrike: { ...strike, awaiting: then, awaitDepth: state.stack.length } });
}

// An attack is waiting on a step window that has closed, with everything played in it resolved.
export function stepWindowResumes(state: ScenarioState): boolean {
  if (state.window) return false;
  const attack = state.pendingAttack;
  if (attack?.awaiting && state.stack.length <= (attack.awaitDepth ?? 0)) return true;
  const strike = state.pendingStrike;
  return strike?.awaiting != null && state.stack.length <= (strike.awaitDepth ?? 0);
}
