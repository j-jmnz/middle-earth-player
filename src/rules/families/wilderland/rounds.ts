// Rules: rr.initiating-abilities-playing-cards, rr.cancel, rr.reveal (data/rules/entries.json); ledger lines 19137:B:1, 19140:B:1.
// What Mount Gundabad's stages say about a round or a phase: the first treachery revealed each round (its When Revealed effects cannot be canceled) and a limit on the cards a player plays in a phase. A game with no card that reads them does none of this work (`gameReads`).
import { gameReads } from "../../core/game-reads.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay } from "../../core/state.ts";
import { constantInstructions } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

/** A treachery was revealed: the first of the round is marked (`firstTreachery`, on the card until the round ends), in a game with an UncancelableWhenRevealed `firstRevealedEachRound`. */
export function noteTreacheryReveal(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  if (!card || printedOf(ctx.cards, card.code).type !== "treachery" || flagged(state, "table", "treacheryRevealed") || !gameReads(state, ctx, '"firstRevealedEachRound"')) return state;
  const mark = (instanceId: string, stat: "treacheryRevealed" | "firstTreachery") => ({ instanceId, sourceId: instanceId, stat, amount: 1, until: "endOfRound" as const });
  return { ...state, modifiers: [...state.modifiers, mark("table", "treacheryRevealed"), mark(cardId, "firstTreachery")] };
}

/**
 * Whether a LimitPlaysPerPhase in force bars the card from being played: the active player has played as many cards this phase as it allows (`state.played`, whose entries leave the phase out for the Planning phase). A card put into play is not played, so `putting`
 * is never barred.
 */
export function phasePlaysBarred(state: ScenarioState, cardId: string, ctx: ReduceContext, putting: boolean): boolean {
  const card = state.cards[cardId];
  if (putting || !card || inPlay(card.zone) || !gameReads(state, ctx, '"LimitPlaysPerPhase"')) return false;
  const played = (state.played ?? []).filter((entry) => entry.round === state.round && entry.seat === state.activeSeat && (entry.phase ?? "Planning") === state.phase && entry.id !== cardId).length;
  return constantInstructions(state, ctx).some(({ instruction }) => instruction.verb === "LimitPlaysPerPhase" && played >= instruction.max);
}
