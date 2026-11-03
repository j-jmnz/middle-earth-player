// Rules: mec109.multiple-staging-areas, rr.quest-advancement (data/rules/entries.json); stage 3B of Breaking of the Fellowship (142063:B:1 to 142066:B:1) and Frodo's
// Choice (142068:A:1).
import type { EngineStep } from "../../intents.ts";
import type { ReduceContext } from "../../interpret.ts";
import { effectsOf } from "../../listen.ts";
import type { ScenarioState } from "../../state.ts";
import { updateCard } from "../../state.ts";
import { startReveal } from "../../frames.ts";
import { moveCard } from "../../zones.ts";

// Progress that would be placed on a stage 3B is owed as cards discarded from the encounter deck instead ("any time players would place progress on this quest,
// discard an equal number of cards from the encounter deck instead"): the seat whose stage it is and how many. quest.ts notes it, `payOwed` discards the cards once
// the progress step is over.
export function oweDiscards(state: ScenarioState, amount: number): ScenarioState {
  if (amount <= 0) return state;
  return { ...state, progressOwed: [...(state.progressOwed ?? []), { seat: state.viewSeat ?? state.firstPlayer, amount }] };
}

// The owed cards come off the top of the encounter deck, in order, into its discard pile. A card that is revealed instead of discarded (Frodo's Choice,
// `RevealIfDiscarded`) is revealed by that seat after the discards, and counts as one of them.
export function payOwed(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const owed = state.progressOwed;
  if (!owed || owed.length === 0) return state;
  const { progressOwed: _owed, ...rest } = state;
  let next: ScenarioState = rest;
  const revealed: { seat: number; id: string }[] = [];
  for (const debt of owed) {
    const top = next.encounterDeck.filter((id) => !revealed.some((entry) => entry.id === id)).slice(0, debt.amount);
    for (const id of top) {
      const code = next.cards[id]?.code;
      if (code && effectsOf(ctx, code).some((effect) => effect.instructions.some((instruction) => instruction.verb === "RevealIfDiscarded"))) revealed.push({ seat: debt.seat, id });
      else next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
    }
  }
  for (const entry of revealed) next = startReveal(next, entry.seat, ctx, steps, entry.id);
  return next;
}
