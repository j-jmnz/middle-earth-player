// Rules: rm.scour (data/rules/entries.json); ledger lines 08122:B:2, 08123:A:1, 08123:B:2, 08133:A:1, 08134:A:1. The Scour keyword does nothing alone: a card tells the players to trigger a scour effect, and each card in the scope resolves the effect that follows its keyword, the record that hears `scour`.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { distinctChoices, inPlay } from "../../core/state.ts";
import { pushCardEffects, pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import { effectsOfCard } from "../misc/text.ts";
import type { Focus } from "../index.ts";

type Scour = Extract<Instruction, { verb: "TriggerScour" }>;

/** The records of a card that are its scour effect (the effect that follows the Scour keyword). */
function scourEffects(state: ScenarioState, id: string, ctx: ReduceContext): readonly Effect[] {
  const card = state.cards[id];
  return card ? effectsOfCard(state, ctx, card).filter((effect) => effect.trigger === "scour") : [];
}

/** The cards that have a scour effect in the scope, in the order they entered play (`inPlay`), or the one nearest the top of the encounter discard pile (`topmostDiscard`, the card discarded last). */
export function scourCards(state: ScenarioState, scope: Scour["scope"], ctx: ReduceContext): string[] {
  if (scope === "topmostDiscard") {
    const top = [...state.encounterDiscard].reverse().find((id) => scourEffects(state, id, ctx).length > 0);
    return top ? [top] : [];
  }
  return Object.values(state.cards)
    .filter((card) => inPlay(card.zone) && scourEffects(state, card.id, ctx).length > 0)
    .sort((left, right) => left.enteredPlay - right.enteredPlay || left.id.localeCompare(right.id, undefined, { numeric: true }))
    .map((card) => card.id);
}

/** A card that left its scope since the set was fixed no longer resolves: out of play (under another card, in a discard pile) for `inPlay`, out of the encounter discard pile for `topmostDiscard`. A card that moved inside play stays. */
function stillInScope(state: ScenarioState, id: string, scope: Scour["scope"]): boolean {
  const zone = state.cards[id]?.zone;
  return zone != null && (scope === "inPlay" ? inPlay(zone) : zone === "encounterDiscard");
}

/**
 * TriggerScour: the set of Scour cards is fixed when the trigger starts (`remaining` carries what is left). The first player chooses which resolves next: one pick for each card in play (asked whenever two or more cards are left: each card in play is its own choice, even a copy of the same title). The chosen card's scour effect runs in a frame of its own with the card
 * as its source, wherever the card lies (a card in the discard pile resolves from there and stays); a frame under it carries on with the cards left, so the effects resolve one after the other, each before the effect that follows the trigger.
 */
export function triggerScour(state: ScenarioState, instruction: Scour, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const left = (instruction.remaining ?? scourCards(state, instruction.scope, ctx)).filter((id) => stillInScope(state, id, instruction.scope) && scourEffects(state, id, ctx).length > 0);
  if (left.length === 0) return state;
  const options = distinctChoices(state, left);
  const chosen = focus.chosen != null && left.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (chosen == null) return askTarget(state, { instruction: { ...instruction, remaining: left }, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
  const rest = left.filter((id) => id !== chosen);
  let next = state;
  if (rest.length > 0) {
    const effectId = effectData(state)?.effectId ?? "scour";
    next = pushEffectFrame(next, { frame: "forced", sourceId: focus.sourceId, actor: state.firstPlayer, peril: false, effectId, instructions: [{ ...instruction, remaining: rest }], cancel: null, blockCancel: null, cause: currentCause(steps, UNATTRIBUTED) }, steps);
  }
  return pushCardEffects(next, "forced", chosen, state.firstPlayer, false, scourEffects(next, chosen, ctx), ctx, steps);
}
