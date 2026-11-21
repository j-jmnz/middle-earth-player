// Rules: dwd.lost-effects, rr.in-play-and-out-of-play, rr.shadow-effects, rr.first-player, faq.simultaneous-effects, rr.forced (data/rules/entries.json); ledger lines 04086:B:2, 04087:B:1, 04099:A:2, 901604:A:2, 901607:A:1.
//
// A Lost line's record answers the trigger `lost`, which only a card effect raises (TriggerLost). Every faceup card in play hears it: locations in the staging area and the active location, engaged and staged enemies, attachments, the Nightmare setup card; a shadow card is not in
// play, so its Lost line is not heard (rr.shadow-effects). `all` raises it for every card in the set fixed as it is raised, each effect resolving in full before the next, and the first player orders them (rr.first-player, faq.simultaneous-effects: he picks the next Lost effect one at a time; one effect, or effects that are all the same card, need no choice and go oldest first); `chooseOne` and `eachDifferent`
// raise it for the cards the players choose, one card at a time.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { QueueItem, ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats } from "../../core/state.ts";
import { askTarget } from "../../windows/choices.ts";
import { textBlank } from "../attachments/hold.ts";
import { effectsOfCard } from "../misc/text.ts";
import { effectData } from "../encounter/moves.ts";
import { fireForced } from "../../windows/triggers.ts";
import { patchTop } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";

type Verb = Extract<Instruction, { verb: "TriggerLost" }>;

/** The cards in play with a Lost line, oldest first: each copy is its own Lost effect (dwd.lost-effects). A card whose printed text box is blank has none. */
export function lostCards(state: ScenarioState, ctx: ReduceContext): string[] {
  return Object.values(state.cards)
    .filter((card) => inPlay(card.zone) && card.face !== "down" && !textBlank(state, card.id, ctx.cards) && effectsOfCard(state, ctx, card).some((effect) => effect.trigger === "lost"))
    .sort((left, right) => left.enteredPlay - right.enteredPlay || left.id.localeCompare(right.id, undefined, { numeric: true }))
    .map((card) => card.id);
}

// The Lost effect of one card, resolved in a frame of its own.
function raise(state: ScenarioState, id: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  return fireForced(state, { trigger: "lost", seat: null, cardId: id }, ctx, steps);
}

// "Trigger all Lost: effects in play": the set was fixed when the verb first ran (`rest` holds what is left of it). The first player picks the effect that resolves next; it resolves in full and the verb comes back for the rest.
function lostInOrder(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = effectData(state);
  const left = instruction.rest ?? lostCards(state, ctx);
  if (!data || left.length === 0) return state;
  // The order matters only between different cards: one effect, or copies of one card, resolve oldest first.
  const alike = left.every((id) => state.cards[id]?.code === state.cards[left[0] ?? ""]?.code);
  const chosen = focus.chosen != null && left.includes(focus.chosen) ? focus.chosen : alike ? left[0] : undefined;
  if (chosen == null) return askTarget(state, { instruction: { ...instruction, rest: left }, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, left);
  const rest = left.filter((id) => id !== chosen);
  let next = state;
  if (rest.length > 0) {
    const again: QueueItem = { instruction: { ...instruction, rest }, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) };
    next = patchTop(next, { data: { ...data, queue: [again, ...data.queue] } });
  }
  return raise(next, chosen, ctx, steps);
}

/** TriggerLost: see src/catalog/families/long-dark.ts. */
export function triggerLost(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = effectData(state);
  if (instruction.mode === "all") return data ? lostInOrder(state, instruction, focus, ctx, steps) : fireForced(state, { trigger: "lost", seat: null }, ctx, steps);
  if (!data) return state;
  const eachDifferent = instruction.mode === "eachDifferent";
  const taken = instruction.taken ?? [];
  // The seats still to choose: with `left` the ones the earlier runs left, else every living player, the first player first.
  const seats = instruction.left ?? (eachDifferent ? livingSeats(state) : [focus.seat]);
  const seat = seats[0];
  if (seat == null) return state;
  const options = lostCards(state, ctx).filter((id) => !taken.includes(id));
  // With none left to choose nobody after him has one either: the rest do nothing (rr.effects).
  if (options.length === 0) return state;
  const chosen = focus.chosen != null && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (chosen == null) return askTarget(state, { instruction, seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
  const rest = seats.slice(1);
  let next = state;
  // The next player chooses once this effect has resolved: the verb waits in the running effect's queue, under the frame the raise pushes.
  if (eachDifferent && rest.length > 0) {
    const again: QueueItem = { instruction: { ...instruction, taken: [...taken, chosen], left: rest }, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) };
    next = patchTop(next, { data: { ...data, queue: [again, ...data.queue] } });
  }
  return raise(next, chosen, ctx, steps);
}
