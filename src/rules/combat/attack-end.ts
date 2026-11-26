// Rules: rr.attacks-outside-the-combat-phase, rr.step-6-4-1 (data/rules/entries.json); ledger lines 08067:B:2, 08083:A:1.
// One attack is in progress at a time, so an attack an effect makes while another is in progress waits for its end. The effect queues its instructions on the attack (`queueAtEnd`) and the end of the attack runs them in a frame of their own (`runAtEnd`),
// after the attack's own "after" instructions and its shadow attackers. The attack that is waiting is still an effect that resolves, so it happens whatever became of the attack it waited for.
import type { Instruction } from "../../catalog/boundary.ts";
import type { EngineStep } from "../core/intents.ts";
import { currentCause, UNATTRIBUTED } from "../core/cause.ts";
import type { ScenarioState } from "../core/state.ts";
import { pushEffectFrame } from "../interpret/effect-frames.ts";
import type { PendingAttack } from "../windows/frame-types.ts";

/** The instructions join those waiting on the attack in progress; the state itself when no attack is in progress. */
export function queueAtEnd(state: ScenarioState, instructions: readonly Instruction[], steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack) return state;
  return { ...state, pendingAttack: { ...attack, onEnd: [...(attack.onEnd ?? []), ...instructions], onEndCause: currentCause(steps, UNATTRIBUTED) } };
}

/** What waits on `attack` runs now in a frame of the attacker's; the state itself when nothing waits. */
export function runAtEnd(state: ScenarioState, attack: PendingAttack, steps: EngineStep[], leading: readonly Instruction[] = []): ScenarioState {
  const waiting = attack.onEnd ?? [];
  if (waiting.length === 0) return state;
  return pushEffectFrame(
    state,
    { frame: "shadow", sourceId: attack.enemyId, actor: attack.seat, peril: false, effectId: `${attack.enemyId}:attackEnd`, instructions: [...leading, ...waiting], cancel: null, blockCancel: null, ...(attack.onEndCause ? { cause: attack.onEndCause } : {}) },
    steps,
  );
}
