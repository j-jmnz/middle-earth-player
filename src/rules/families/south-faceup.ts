// Rules: rr.in-player-order, rr.first-player (data/rules/entries.json); the Council of Elrond (142020:B:1).
//
// AssignFaceup: each player places the top card of their deck faceup, in player order, until the right number of cards are faceup
// between them; the first player then assigns each to a different outcome, one choice at a time. A faceup card stays on top of
// its owner's deck until its outcome moves it (to its owner's hand or discard pile, shuffled into its deck, or played for no cost).
import type { Instruction } from "../../catalog/boundary.ts";

import { askTarget } from "../choices.ts";
import { currentCause, UNATTRIBUTED } from "../cause.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { putOnDeck } from "../player-verbs.ts";
import type { ScenarioState } from "../state.ts";
import { livingSeats, updateCard } from "../state.ts";
import { moveCard } from "../zones.ts";
import type { Focus } from "./index.ts";
import { runEncounterItem } from "./encounter-items.ts";
import { markPicked, queueFront } from "./play-refs.ts";

type Assign = Extract<Instruction, { verb: "AssignFaceup" }>;

// The top cards of the decks, in player order, a round at a time, until `count` are faceup or the decks run out.
function gather(state: ScenarioState, count: number): string[] {
  const found: string[] = [];
  const seats = livingSeats(state);
  for (let depth = 0; found.length < count; depth += 1) {
    let any = false;
    for (const seat of seats) {
      const id = state.seats[seat]?.deck[depth];
      if (!id || found.length >= count) continue;
      found.push(id);
      any = true;
    }
    if (!any) break;
  }
  return found;
}

function owner(state: ScenarioState, id: string): number {
  const card = state.cards[id];
  return card?.owner ?? card?.controller ?? state.firstPlayer;
}

// The card's outcome. A card that cannot be played goes to the bottom of its owner's deck (as Vilya's does).
function applyOutcome(state: ScenarioState, id: string, outcome: Assign["outcomes"][number], ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const seat = owner(state, id);
  switch (outcome) {
    case "hand": {
      steps.push({ kind: "draw", seat, cardId: id, cause: currentCause(steps, UNATTRIBUTED) });
      return moveCard(state, id, { zone: "hand", seat });
    }
    case "discard":
      return moveCard(state, id, { zone: "discard", seat });
    case "shuffle":
      return putOnDeck(state, id, "shuffle");
    case "play":
      return runEncounterItem(markPicked(state, id), { instruction: { verb: "PlayRevealedFree" }, seat, chosen: null }, { cardId: null }, ctx, steps) ?? state;
  }
}

export function assignFaceup(state: ScenarioState, instruction: Assign, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const cause = currentCause(steps, UNATTRIBUTED);
  let next = state;
  let faceup = instruction.faceup;
  if (!faceup) {
    faceup = gather(state, instruction.cards);
    for (const id of faceup) next = updateCard(next, id, { face: "up" });
  }
  const at = instruction.next ?? 0;
  if (faceup.length === 0 || at >= instruction.outcomes.length) return next;
  const chosen = focus.chosen && faceup.includes(focus.chosen) ? focus.chosen : faceup.length === 1 ? faceup[0] : undefined;
  if (!chosen) return askTarget(next, { instruction: { ...instruction, faceup, next: at }, seat: next.firstPlayer, chosen: null, cause }, faceup);
  const outcome = instruction.outcomes[at];
  if (!outcome) return next;
  // The next assignment is queued first: an outcome that plays a card may open a frame of its own over this one.
  const rest = faceup.filter((id) => id !== chosen);
  if (rest.length > 0 && at + 1 < instruction.outcomes.length) next = queueFront(next, [{ instruction: { ...instruction, faceup: rest, next: at + 1 }, seat: focus.seat, chosen: null, cause }]);
  return applyOutcome(next, chosen, outcome, ctx, steps);
}
