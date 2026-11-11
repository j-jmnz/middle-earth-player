// Rules: rr.play-and-put-into-play, rr.in-play-and-out-of-play, rr.cannot (data/rules/entries.json); ledger line 12155:A:1. "While Corsair Waters is the active location, no more than 1 ally can enter play each round" (LimitEntries):
// an ally enters play when it is played and when an effect puts it into play, so the count is of every ally that came into play this round, one that has left again included. The count is kept by the settle sweep
// (`ScenarioState.entries`) in a game whose cards read the limit; a card played or put into play is refused (sidequests/contract.ts playBlocked) once the limit is reached.
import { constantInstructions, type ConstantInstruction } from "../../interpret/constant-records.ts";
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

// This round's allies by the controller each has now, in a game with a per-player limit.
function addBySeat(known: readonly number[], entered: readonly CardInstance[]): readonly number[] {
  const counts = [...known];
  for (const card of entered) {
    const seat = card.controller ?? 0;
    counts[seat] = (counts[seat] ?? 0) + 1;
  }
  return Array.from(counts, (count) => count ?? 0);
}

type Entries = NonNullable<ScenarioState["entries"]>;

// The count the sweep already holds is the one it would write now.
function sameEntries(known: Entries, next: Entries): boolean {
  const before = known.bySeat ?? [];
  const after = next.bySeat ?? [];
  return known.round === next.round && known.mark === next.mark && known.count === next.count && before.length === after.length && after.every((value, at) => value === before[at]);
}

/** The settle sweep: allies that entered play since the last sweep are added to this round's count. The first sweep of a game starts counting from the clock it finds. */
export function noteEntries(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, READS_LIMIT)) return state;
  const known = state.entries;
  const mark = known?.mark ?? state.clock;
  const sameRound = known?.round === state.round;
  const entered = enteredCards(state, mark, ctx);
  const bySeat = gameReads(state, ctx, READS_PER_PLAYER) ? addBySeat(sameRound ? (known.bySeat ?? []) : [], entered) : undefined;
  const next: Entries = { round: state.round, mark: state.clock, count: (sameRound ? known.count : 0) + entered.length, ...(bySeat ? { bySeat } : {}) };
  return known && sameEntries(known, next) ? state : { ...state, entries: next };
}

// The limit in force that the card runs into: it is an ally and this round's allies that entered play have reached `max` (a per-player limit: the allies the seat that plays it has brought in).
function limitReached(state: ScenarioState, cardId: string, ctx: ReduceContext, seat?: number): ConstantInstruction | undefined {
  const card = state.cards[cardId];
  if (!card || inPlay(card.zone) || !gameReads(state, ctx, READS_LIMIT)) return undefined;
  const printed = printedOf(ctx.cards, card.code);
  if (!isAllyLike(printed) || printed.type === "hero") return undefined;
  const known = state.entries;
  const live = known?.round === state.round;
  const pending = live ? enteredCards(state, known.mark, ctx) : [];
  const entered = live ? known.count + pending.length : 0;
  const mine = live ? addBySeat(known.bySeat ?? [], pending)[seat ?? card.controller ?? card.owner ?? 0] ?? 0 : 0;
  return constantInstructions(state, ctx).find(({ instruction }) => instruction.verb === "LimitEntries" && (instruction.perPlayer ? mine : entered) >= instruction.max);
}

/** Whether a limit in force says the card cannot be played or put into play now. */
export function entriesBarred(state: ScenarioState, cardId: string, ctx: ReduceContext, seat?: number): boolean {
  return limitReached(state, cardId, ctx, seat) != null;
}

/** Why the card cannot be played, naming the card that limits it and the limit, or null when no limit is reached (the active seat plays). */
export function entriesRefusal(state: ScenarioState, cardId: string, ctx: ReduceContext): string | null {
  const found = limitReached(state, cardId, ctx, state.activeSeat);
  if (found?.instruction.verb !== "LimitEntries") return null;
  const who = found.instruction.perPlayer ? "each player may" : "the players may";
  return `${printedOf(ctx.cards, found.source.code).name}: ${who} play or put into play only ${found.instruction.max} ${found.instruction.max === 1 ? "ally" : "allies"} each round.`;
}
