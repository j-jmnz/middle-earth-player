import type { Instruction } from "../catalog/boundary.ts";

import { characters } from "./combat.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { lastPicked, seatOf } from "./player-verbs.ts";
import { addModifier } from "./keywords.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats } from "./state.ts";
import type { VerbFocus } from "./verbs.ts";
import { moveCard } from "./zones.ts";
import { currentCause, UNATTRIBUTED } from "./cause.ts";

// Verbs that read or change the enemy attack in progress.
export function runAttackVerb(state: ScenarioState, instruction: Instruction, focus: VerbFocus, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  switch (instruction.verb) {
    case "ConsiderUndefended":
      return attack ? { ...state, pendingAttack: { ...attack, undefended: true } } : state;
    case "AfterAttack":
      return attack ? { ...state, pendingAttack: { ...attack, after: [...(attack.after ?? []), ...instruction.instructions], afterCause: currentCause(steps, UNATTRIBUTED) } } : state;
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

// A stat change goes on the source card, on the attacker while an enemy attack is in progress, or on the cards a Pick
// chose or the seat it names. A lasting effect from a player card holds for the cards in play when it resolves
// (rr.lasting-effects), so each card gets its own record.
export function modifyStat(
  state: ScenarioState,
  instruction: Extract<Instruction, { verb: "ModifyStat" }>,
  focus: VerbFocus,
  ctx: ReduceContext,
): ScenarioState {
  const sourceId = focus.sourceId;
  if (!sourceId) return state;
  let targets: string[];
  switch (instruction.target) {
    case "attacker":
      targets = state.pendingAttack ? [state.pendingAttack.enemyId] : [];
      break;
    case "picked":
      targets = [lastPicked(state)];
      break;
    case "pickedPlayerCharacters": {
      const seat = seatOf(lastPicked(state));
      targets = seat == null ? [] : characters(state, seat, ctx.cards);
      break;
    }
    case "ownHeroes":
      targets = [...(state.seats[focus.seat]?.heroes ?? [])];
      break;
    default:
      targets = [sourceId];
  }
  let next = state;
  for (const id of targets) next = addModifier(next, id, sourceId, instruction.stat, instruction.amount, instruction.until);
  return next;
}
