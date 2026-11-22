// Rules: rr.step-6-2, rr.step-6-4-2, rr.shadow-effects, rr.cancel, rr.search, faq.additional-attacks (data/rules/entries.json); ledger lines 51335:A:2, 51342:A:2, 51320:A:2 (docs/scenarios/standalone-scenarios.md, Escape from Khazad-dûm, readings 20, 21 and 27).
// The verbs of Escape from Khazad-dûm that read or change the enemy attack in progress and the cancel of a When Revealed effect: RemoveDefender, SearchTopShadow and Undisturbed Bones' replacement of a cancel.
import type { Condition, Instruction, ModifierStat } from "../../../catalog/boundary.ts";

import { destroyCard } from "../../core/keywords.ts";
import { heldAmountByClass } from "../../core/holder-classes.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { moveCard, shadowCards } from "../../core/zones.ts";
import { effectsOf } from "../../windows/listen.ts";
import { shadowFace } from "../defense/shadow.ts";
import { queueHeard } from "../defense/listen.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** RemoveDefender: the defending character leaves the attack in progress and cannot be declared as its defender again. The attack is not undefended: the defending player names another defender, or none, once the shadow effect is over. A shadow effect that already made the attack undefended, or an attack with no defender, changes nothing. */
export function removeDefender(state: ScenarioState): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack?.defenderId || attack.undefended === true) return state;
  const { defenderId: removed, ...rest } = attack;
  return { ...state, pendingAttack: { ...rest, removedDefenders: [...(attack.removedDefenders ?? []), removed] } };
}

// The card the opposing team deals: an enemy of the highest Attack among the top cards, else the card nearest the top (reading 27).
function shadowChoice(state: ScenarioState, ids: readonly string[], ctx: ReduceContext): string | undefined {
  const attackOf = (id: string): number => {
    const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
    return printed.type === "enemy" ? (printed.attack ?? 0) : -1;
  };
  return ids.reduce<string | undefined>((best, id) => (best === undefined || attackOf(id) > attackOf(best) ? id : best), undefined);
}

/** The Attack an enemy holds from effects that count its shadow cards while it attacks (the flag attackPerShadow, 51342:A:1): the amount of each modifier of its class times the shadow cards dealt to it, read now so a card dealt during the attack counts. 0 for any other stat or enemy. */
export function perShadow(state: ScenarioState, instance: CardInstance, printed: PrintedCard, stat: ModifierStat): number {
  if (stat !== "attack" || state.pendingAttack?.enemyId !== instance.id) return 0;
  return shadowCards(instance).length * heldAmountByClass(state, instance, printed, "attackPerShadow");
}

/** SearchTopShadow: of the top `top` cards of the encounter deck, the card the opposing team picks is dealt to the attacking enemy as a shadow card, face down, to resolve after the shadow card being resolved. It is not revealed. Nothing happens outside an attack or with an empty deck. */
export function searchTopShadow(state: ScenarioState, instruction: Verb<"SearchTopShadow">, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  const enemy = attack ? state.cards[attack.enemyId] : undefined;
  if (!attack || !enemy) return state;
  const id = shadowChoice(state, state.encounterDeck.slice(0, instruction.top), ctx);
  if (!id) return state;
  const face = shadowFace(state, enemy.id);
  const moved = moveCard(state, id, { zone: "shadow", enemyId: enemy.id });
  return queueHeard(updateCard(moved, id, { face }), ctx, { trigger: "shadowDealtTo", seat: null, cardId: enemy.id, subject: enemy.id, other: id });
}

// Whether the cancel being made answers a When Revealed effect: a Response window on a reveal is open, or a When Revealed effect that cancels itself is running (a shadow effect is not one).
function cancelsWhenRevealed(state: ScenarioState): boolean {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const frame = state.stack[index];
    if (frame?.data.kind !== "responses") continue;
    const trigger = frame.data.event.trigger;
    return trigger === "whenRevealedPending" || trigger === "encounterRevealed";
  }
  return state.stack.at(-1)?.frame === "whenRevealed";
}

/** The cancel of a When Revealed effect while a card that says "when a 'when revealed' effect would be canceled, discard ~ instead" is in play (51320:A:2): the cancel does not happen and that card is discarded. Null when the cancel is not one. */
export function bonesCancel(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  if (!cancelsWhenRevealed(state)) return null;
  const bones = Object.values(state.cards).find((card) => inPlay(card.zone) && effectsOf(ctx, card.code).some((effect) => effect.instructions.some((instruction) => instruction.verb === "ReplacesRevealCancel")));
  return bones ? destroyCard(state, bones.id, ctx.cards, steps) : null;
}

/** The condition `exploredPending`: a copy of the card with this code was explored and the Forced effect that hears it has not finished: its `locationExplored` or `activeExplored` event waits in the queue, or the effect (the record id the condition names) is running on the stack. The stage bar of Dark Pit reads it for the window before the flip (51301:B:2). Null for any other condition. */
export function exploredPendingHolds(state: ScenarioState, condition: Condition): boolean | null {
  if (condition.kind !== "exploredPending") return null;
  const waiting = (state.pendingEvents ?? []).some((event) => (event.trigger === "locationExplored" || event.trigger === "activeExplored") && event.subject != null && state.cards[event.subject]?.code === condition.code);
  return waiting || state.stack.some((frame) => frame.data.kind === "effect" && frame.data.effectId === condition.effect);
}
