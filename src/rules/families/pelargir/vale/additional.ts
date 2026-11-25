// Rules: rr.shadow-effects, rr.forced, faq.additional-attacks (data/rules/entries.json); ledger line 06152:A:2.
// "When Lord Alcaron is dealt a shadow card with no shadow effect, he makes an additional attack after this one": each such card is its own trigger (Readings, 06152:A:2, several shadow cards). The Forced effect runs once the attack has ended, with the shadow cards still dealt (they are discarded as the
// next attack deals its own card, or at the end of the phase). One attack is in progress at a time, so the verb begins the first additional attack and leaves itself, for the rest, at the end of that attack: each further attack starts when the one before has ended and is dealt a shadow card of its own.
import type { Instruction } from "../../../../catalog/boundary.ts";
import type { EngineStep } from "../../../core/intents.ts";
import type { ScenarioState } from "../../../core/state.ts";
import { shadowCards } from "../../../core/zones.ts";
import { currentCause, UNATTRIBUTED } from "../../../core/cause.ts";
import { immediateAttack } from "../../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../../interpret/interpret.ts";
import type { Focus } from "../../index.ts";

type Verb = Extract<Instruction, { verb: "AttackPerBlankShadow" }>;

// The shadow cards dealt to the enemy that no record gives a shadow effect.
function blankShadows(state: ScenarioState, enemyId: string, ctx: ReduceContext): number {
  return shadowCards(state.cards[enemyId]).filter((id) => {
    const code = state.cards[id]?.code;
    return code != null && !ctx.effects.some((effect) => effect.cardCode === code && effect.timing === "shadow");
  }).length;
}

/** AttackPerBlankShadow: the source enemy attacks now for the first blank shadow card (or `left` more attacks, when the verb runs again), and the others are left for the end of that attack. */
export function attackPerBlankShadow(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (focus.sourceId == null) return state;
  const attacks = instruction.left ?? blankShadows(state, focus.sourceId, ctx);
  if (attacks <= 0) return state;
  const later = (from: ScenarioState, attack: NonNullable<ScenarioState["pendingAttack"]>, count: number): ScenarioState => {
    const next: Instruction = { verb: "AttackPerBlankShadow", left: count };
    return { ...from, pendingAttack: { ...attack, after: [...(attack.after ?? []), next], afterCause: currentCause(steps, UNATTRIBUTED) } };
  };
  // An attack of this enemy is already in progress (the one an earlier run of this verb began, whose end ran this verb again before the Forced effect of the attack before it was heard): these attacks follow it, one after another.
  if (state.pendingAttack?.enemyId === focus.sourceId) return later(state, state.pendingAttack, attacks);
  const begun = immediateAttack(state, focus.sourceId, focus.seat, ctx, steps);
  const attack = begun.pendingAttack;
  if (!attack || attack === state.pendingAttack || attacks === 1) return begun;
  return later(begun, attack, attacks - 1);
}
