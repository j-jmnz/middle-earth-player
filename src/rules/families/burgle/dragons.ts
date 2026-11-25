// Rules: rr.first-player, rr.then, faq.lasting-effects (data/rules/entries.json); ledger lines 132049:A:1, 132050:A:1. The Dragons' two treachery effects: the hand cards discarded at random that raise the Dragons' Threat, and the attack on the player with the most Willpower committed.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { addClassModifier, traitedEnemies } from "../../core/holder-classes.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { discardRandom } from "../../interpret/verbs.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";
import { askTarget } from "../../windows/choices.ts";
import { committedWillpower } from "../../quest/quest.ts";
import type { Focus } from "../index.ts";
import { lastPickedCard } from "../play/refs.ts";
import { attackNowFromStaging } from "../south/watcher.ts";

/** DiscardRandomRaiseThreat: each living player, the first player first, discards `amount` cards at random from his hand; each enemy in play with the Trait, and each that enters play later in the phase, gets +1 Threat until the end of the phase for each card of the type discarded, by all players together. */
export function discardRandomRaiseThreat(state: ScenarioState, instruction: Extract<Instruction, { verb: "DiscardRandomRaiseThreat" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const living = livingSeats(state);
  const at = Math.max(0, living.indexOf(state.firstPlayer));
  let discarded = 0;
  let next = state;
  for (const seat of [...living.slice(at), ...living.slice(0, at)]) {
    const before = next.seats[seat]?.discard.length ?? 0;
    next = discardRandom(next, seat, instruction.amount, focus.sourceId, ctx);
    // The cards that joined the discard pile are the ones this effect discarded.
    discarded += (next.seats[seat]?.discard ?? []).slice(before).filter((id) => printedOf(ctx.cards, next.cards[id]?.code ?? "").type === instruction.cardType).length;
  }
  if (discarded === 0) return next;
  // The class of the enemies with the Trait, so that a Dragon that enters play later in the phase has the Threat too (faq.lasting-effects).
  return addClassModifier(next, traitedEnemies(instruction.trait), focus.sourceId ?? "table", "threat", discarded, "endOfPhase");
}

/** The seats whose committed characters have the highest total Willpower, among the living. */
export function highestWillpowerSeats(state: ScenarioState, ctx: ReduceContext): number[] {
  const living = livingSeats(state);
  const totals = living.map((seat) => committedWillpower(state, ctx.cards, seat));
  const most = Math.max(...totals);
  return living.filter((_seat, index) => totals[index] === most);
}

/** AttackHighestWillpower: the picked enemy in the staging area attacks the player with the highest total Willpower committed, no shadow card dealt. Among tied players the first player chooses (his choice comes back as `focus.chosen`, `seat:<n>`). */
export function attackHighestWillpower(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[], instruction: Instruction): ScenarioState {
  const id = lastPickedCard(state);
  if (!id || state.cards[id]?.zone !== "staging") return state;
  const tied = highestWillpowerSeats(state, ctx);
  if (tied.length > 1 && focus.chosen == null) return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, tied.map((seat) => `seat:${seat}`));
  const seat = focus.chosen != null && focus.chosen.startsWith("seat:") ? Number(focus.chosen.slice("seat:".length)) : tied[0];
  return seat == null ? state : attackNowFromStaging(state, id, seat, ctx, steps, { shadow: false });
}
