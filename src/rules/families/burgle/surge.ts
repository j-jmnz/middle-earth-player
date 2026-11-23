// Rules: rr.surge, rr.reveal, faq.lasting-effects (data/rules/entries.json); ledger line 132046:A:1. "The first treachery card revealed each round gains surge" while Desolation of Smaug is the active location: the engine notes each treachery as it is revealed, before its When Revealed effects; the round's first gains surge if a record holds the marker then.
import { gameReads } from "../../core/game-reads.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { constantInstructions } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { markSurge } from "../../interpret/verbs.ts";

/** The `revealed` hook: a treachery is revealed; in a game that deals a FirstTreacherySurge the round's first one is noted, and gains surge while a holder of the marker is in play with its condition holding. */
export function noteFirstTreachery(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  if (!card || printedOf(ctx.cards, card.code).type !== "treachery" || !gameReads(state, ctx, '"FirstTreacherySurge"') || flagged(state, "table", "firstTreacheryNoted")) return state;
  const noted = { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: "table", stat: "firstTreacheryNoted" as const, amount: 1, until: "endOfRound" as const }] };
  return constantInstructions(noted, ctx).some(({ instruction }) => instruction.verb === "FirstTreacherySurge") ? markSurge(noted, cardId) : noted;
}
