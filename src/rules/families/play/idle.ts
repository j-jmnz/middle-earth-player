// Rules: rr.triggered-ability, rr.cost (data/rules/entries.json).
// The idle check of the play family's verbs (src/rules/player/potential.ts, Whether an ability could change the game): DiscardSameTitle changes nothing when no card in the
// staging area shares the title of the card the answered event is about.
import type { IdleHook } from "../../interpret/family-manifest.ts";
import { printedOf } from "../../core/printed.ts";

export const playIdle: IdleHook = (state, instruction, _sourceId, frame, ctx) => {
  if (instruction.verb !== "DiscardSameTitle") return null;
  const subject = frame.scope.subject != null ? state.cards[frame.scope.subject] : undefined;
  if (!subject) return false;
  const name = printedOf(ctx.cards, subject.code).name;
  return !state.staging.some((id) => id !== subject.id && printedOf(ctx.cards, state.cards[id]?.code ?? "").name === name);
};
