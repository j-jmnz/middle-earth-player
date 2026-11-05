// Rules: rr.play-and-put-into-play, rr.in-play-and-out-of-play, rr.cannot (data/rules/entries.json); ledger line 12155:A:1. "While Corsair Waters is the active location, no more than 1 ally can enter play each round" (LimitEntries):
// an ally enters play when it is played and when an effect puts it into play, so the count is of every ally that came into play this round, one that has left again included. The count is kept by the settle sweep
// (`ScenarioState.entries`) in a game whose cards read the limit; a card played or put into play is refused (sidequests/contract.ts playBlocked) once the limit is reached.
import { constantInstructions } from "../../interpret/constant-records.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { isAllyLike, printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";

const READS_LIMIT = '"verb":"LimitEntries"';

// The allies in play that came in after the clock reading `mark`.
function enteredSince(state: ScenarioState, mark: number, ctx: ReduceContext): number {
  return Object.values(state.cards).filter((card) => inPlay(card.zone) && card.enteredPlay > mark && isAllyLike(printedOf(ctx.cards, card.code)) && printedOf(ctx.cards, card.code).type !== "hero").length;
}

/** The settle sweep: allies that entered play since the last sweep are added to this round's count. The first sweep of a game starts counting from the clock it finds. */
export function noteEntries(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, READS_LIMIT)) return state;
  const known = state.entries;
  const mark = known?.mark ?? state.clock;
  const count = known?.round === state.round ? known.count : 0;
  const total = count + enteredSince(state, mark, ctx);
  return known && known.round === state.round && known.mark === state.clock && known.count === total ? state : { ...state, entries: { round: state.round, mark: state.clock, count: total } };
}

/** Whether a limit in force says the card cannot be played or put into play now: it is an ally and this round's allies that entered play have reached `max`. */
export function entriesBarred(state: ScenarioState, cardId: string, ctx: ReduceContext): boolean {
  const card = state.cards[cardId];
  if (!card || inPlay(card.zone)) return false;
  const printed = printedOf(ctx.cards, card.code);
  if (!isAllyLike(printed) || printed.type === "hero") return false;
  const known = state.entries;
  const entered = known?.round === state.round ? known.count + enteredSince(state, known.mark, ctx) : 0;
  return constantInstructions(state, ctx).some(({ instruction }) => instruction.verb === "LimitEntries" && entered >= instruction.max);
}
