import type { Instruction } from "../catalog/boundary.ts";

import type { EngineStep } from "./intents.ts";
import { addModifier } from "./keywords.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats } from "./state.ts";
import type { VerbFocus } from "./verbs.ts";
import { moveCard } from "./zones.ts";

// Verbs that read or change the enemy attack in progress.
export function runAttackVerb(state: ScenarioState, instruction: Instruction, focus: VerbFocus, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  switch (instruction.verb) {
    case "ConsiderUndefended":
      return attack ? { ...state, pendingAttack: { ...attack, undefended: true } } : state;
    case "AfterAttack":
      return attack ? { ...state, pendingAttack: { ...attack, after: [...(attack.after ?? []), ...instruction.instructions] } } : state;
    case "EngageNextPlayer": {
      const enemy = focus.sourceId ? state.cards[focus.sourceId] : undefined;
      if (!focus.sourceId || enemy?.zone !== "engaged" || enemy.controller == null) return state;
      const seats = livingSeats(state);
      const at = seats.indexOf(enemy.controller);
      const next = seats[(at + 1) % seats.length];
      if (next == null) return state;
      steps.push({ kind: "engage", seat: next, enemyId: focus.sourceId });
      return moveCard(state, focus.sourceId, { zone: "engaged", seat: next });
    }
    default:
      return state;
  }
}

// A stat change goes on the source card, or on the attacker while an enemy attack is in progress.
export function modifyStat(
  state: ScenarioState,
  instruction: Extract<Instruction, { verb: "ModifyStat" }>,
  sourceId: string | null,
): ScenarioState {
  const target = instruction.target === "attacker" ? state.pendingAttack?.enemyId : sourceId;
  if (!target || !sourceId) return state;
  return addModifier(state, target, sourceId, instruction.stat, instruction.amount, instruction.until);
}
