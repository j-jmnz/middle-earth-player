// Rules: mec108.day-and-night, faq.triggering-forced-effects (data/rules/entries.json); ledger lines 10011:A:1, 10011:A:2, 10011:A:3, 10012:A:1, 10012:A:2, 10012:A:3, 10015:A:1, 10026:A:1. Day and Night: the Time objective is one double-sided card, Daybreak (10011) faceup
// or Nightfall (10012) faceup; the side it shows is the state ("It is Day", "It is Night"), which has no effect of its own. The card is dealt Daybreak faceup with nothing announced; flipping it announces that it becomes the other time, which the cards in play hear
// (`becameDay`, `becameNight`). A flip to the side already up changes nothing and announces nothing.
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import { inPlay, updateCard, type CardInstance, type ScenarioState } from "../../core/state.ts";
import { queueEvent } from "../../windows/queue.ts";

/** Daybreak, the Time objective's Day side, and Nightfall, its Night side (one physical card: the flip swaps the two codes). */
export const DAYBREAK = "10011";
export const NIGHTFALL = "10012";

/** The Time objective in play, whichever side it shows. */
export function timeObjective(state: ScenarioState): CardInstance | undefined {
  return Object.values(state.cards).find((card) => (card.code === DAYBREAK || card.code === NIGHTFALL) && inPlay(card.zone));
}

/** The condition `timeOfDay`: the Time objective shows this side. False while none is in play. */
export function timeOfDayHolds(state: ScenarioState, condition: Condition): boolean | null {
  if (condition.kind !== "timeOfDay") return null;
  return timeObjective(state)?.code === (condition.is === "day" ? DAYBREAK : NIGHTFALL);
}

/** FlipTimeObjective: the Time objective shows `to` (`other`: its other side), and the cards hear that it became Day or Night. Nothing changes when it already shows that side or is not in play. */
export function flipTimeObjective(state: ScenarioState, instruction: Extract<Instruction, { verb: "FlipTimeObjective" }>): ScenarioState {
  const card = timeObjective(state);
  if (!card) return state;
  const shown = card.code === DAYBREAK ? "day" : "night";
  const to = instruction.to === "other" ? (shown === "day" ? "night" : "day") : instruction.to;
  if (to === shown) return state;
  const flipped = updateCard(state, card.id, { code: to === "day" ? DAYBREAK : NIGHTFALL, other: card.code });
  return queueEvent(flipped, { trigger: to === "day" ? "becameDay" : "becameNight", seat: null });
}
