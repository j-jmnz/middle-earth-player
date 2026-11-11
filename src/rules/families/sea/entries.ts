// Rules: rr.play-and-put-into-play, rr.in-play-and-out-of-play, rr.cannot (data/rules/entries.json); ledger line 12155:A:1. "While Corsair Waters is the active location, no more than 1 ally can enter play each round" (LimitEntries):
// an ally enters play when it is played and when an effect puts it into play, so the count is of every ally that came into play this round, one that has left again included. The count is kept by the settle sweep
// (`ScenarioState.entries`) in a game whose cards read the limit; a card played or put into play is refused (sidequests/contract.ts playBlocked) once the limit is reached.
import { constantInstructions } from "../../interpret/constant-records.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { isAllyLike, printedOf } from "../../core/printed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";

const READS_LIMIT = '"verb":"LimitEntries"';
// A limit that counts each player's allies on their own (144071:B:2).
const READS_PER_PLAYER = '"perPlayer":true';

// The allies in play that came in after the clock reading `mark`.
function enteredCards(state: ScenarioState, mark: number, ctx: ReduceContext): CardInstance[] {
  return Object.values(state.cards).filter((card) => inPlay(card.zone) && card.enteredPlay > mark && isAllyLike(printedOf(ctx.cards, card.code)) && printedOf(ctx.cards, card.code).type !== "hero");
}

// This round's allies by the seat that controlled each as it entered (the controller it has now), in a game with a per-player limit.
function addBySeat(known: readonly number[], entered: readonly CardInstance[]): readonly number[] {
  const counts = [...known];
  for (const card of entered) {
    const seat = card.controller ?? 0;
    counts[seat] = (counts[seat] ?? 0) + 1;
  }
  return Array.from(counts, (count) => count ?? 0);
}

/** The settle sweep: allies that entered play since the last sweep are added to this round's count. The first sweep of a game starts counting from the clock it finds. */
export function noteEntries(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, READS_LIMIT)) return state;
  const known = state.entries;
  const mark = known?.mark ?? state.clock;
  const sameRound = known?.round === state.round;
  const count = sameRound ? known.count : 0;
  const entered = enteredCards(state, mark, ctx);
  const total = count + entered.length;
  if (gameReads(state, ctx, READS_PER_PLAYER)) {
    const bySeat = addBySeat(sameRound ? (known.bySeat ?? []) : [], entered);
    const same = known && sameRound && known.mark === state.clock && known.count === total && bySeat.length === (known.bySeat ?? []).length && bySeat.every((value, at) => value === known.bySeat?.[at]);
    return same ? state : { ...state, entries: { round: state.round, mark: state.clock, count: total, bySeat } };
  }
  return known && sameRound && known.mark === state.clock && known.count === total ? state : { ...state, entries: { round: state.round, mark: state.clock, count: total } };
}

/** Whether a limit in force says the card cannot be played or put into play now: it is an ally and this round's allies that entered play have reached `max` (a per-player limit: the allies the seat that plays it has brought in). */
export function entriesBarred(state: ScenarioState, cardId: string, ctx: ReduceContext, seat?: number): boolean {
  const card = state.cards[cardId];
  if (!card || inPlay(card.zone) || !gameReads(state, ctx, READS_LIMIT)) return false;
  const printed = printedOf(ctx.cards, card.code);
  if (!isAllyLike(printed) || printed.type === "hero") return false;
  const known = state.entries;
  const live = known?.round === state.round;
  const pending = live ? enteredCards(state, known.mark, ctx) : [];
  const entered = live ? known.count + pending.length : 0;
  const mine = live ? addBySeat(known.bySeat ?? [], pending)[seat ?? card.controller ?? card.owner ?? 0] ?? 0 : 0;
  return constantInstructions(state, ctx).some(({ instruction }) => instruction.verb === "LimitEntries" && (instruction.perPlayer ? mine : entered) >= instruction.max);
}
