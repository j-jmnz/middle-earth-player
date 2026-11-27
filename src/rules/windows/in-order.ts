// Rules: rr.forced, rr.first-player, faq.simultaneous-effects (data/rules/entries.json). One step of an ordered set (the Forced effects of one moment, the Lost effects of TriggerLost): the first player picks the card that resolves next, and the verb comes back
// for the rest once it has resolved.
import type { ScenarioState, QueueItem } from "../core/state.ts";
import { queueFront } from "../families/play/refs.ts";
import { askTarget } from "./choices.ts";

/** The next card of an ordered set, or `chosen: null` with the question asked. */
export type InOrder = { chosen: string; state: ScenarioState } | { chosen: null; state: ScenarioState };

export type InOrderSpec = {
  /** The cards that may resolve next, one for each set of alike cards. */
  options: readonly string[];
  /** The card the player picked when the question was answered. */
  picked: string | null | undefined;
  /** The question: the verb with the set still to order, for the first player. */
  ask: QueueItem;
  /** What waits once `chosen` has resolved, or null when nothing is left. */
  rest: (chosen: string) => QueueItem | null;
};

/** One option is taken without a question; several are asked of the seat of `ask`. The rest wait at the front of the running effect's queue. */
export function nextInOrder(state: ScenarioState, spec: InOrderSpec): InOrder {
  const chosen = spec.picked != null && spec.options.includes(spec.picked) ? spec.picked : spec.options.length === 1 ? spec.options[0] : undefined;
  if (chosen == null) return { chosen: null, state: askTarget(state, spec.ask, spec.options) };
  const again = spec.rest(chosen);
  return { chosen, state: again ? queueFront(state, [again]) : state };
}
