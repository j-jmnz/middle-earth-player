// Rules: rr.initiating-abilities-playing-cards, rr.play-and-put-into-play, rr.cancel, rr.reveal (data/rules/entries.json); ledger lines 19137:B:1, 19140:B:1, 00017:B:2.
// What Mount Gundabad's stages say about a round or a phase: the first treachery revealed each round (its When Revealed effects cannot be canceled) and a limit on the cards a player plays in a phase or a round. A game with no card that reads them does none of this work (`gameReads`).
import { gameReads } from "../../core/game-reads.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay, modifierActive } from "../../core/state.ts";
import { constantInstructions } from "../../interpret/constant-records.ts";
import { markDoomed } from "../angmar/weather.ts";
import { stageName } from "./gundabad.ts";
import type { PlayHow } from "../../interpret/family-manifest.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

/** A treachery was revealed: the first of the round is marked (`firstTreachery`, on the card until the round ends), in a game with an UncancelableWhenRevealed `firstRevealedEachRound`. */
export function noteTreacheryReveal(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  if (!card || printedOf(ctx.cards, card.code).type !== "treachery" || flagged(state, "table", "treacheryRevealed") || !gameReads(state, ctx, '"firstRevealedEachRound"')) return state;
  const mark = (instanceId: string, stat: "treacheryRevealed" | "firstTreachery") => ({ instanceId, sourceId: instanceId, stat, amount: 1, until: "endOfRound" as const });
  const marked = { ...state, modifiers: [...state.modifiers, mark("table", "treacheryRevealed"), mark(cardId, "firstTreachery")] };
  // "The first treachery revealed each round gains doomed 1" (50721:A:2): it gains Doomed on top of its printed Doomed as it is revealed, while the card that says so is in play.
  const doomed = constantInstructions(marked, ctx).reduce((sum, { instruction }) => sum + (instruction.verb === "UncancelableWhenRevealed" && instruction.firstRevealedEachRound === true ? (instruction.doomed ?? 0) : 0), 0);
  return doomed > 0 ? markDoomed(marked, cardId, doomed) : marked;
}

/** A LimitPlaysPerPhase or LimitPlaysPerRound that bars the card: the name of the card that holds it, the most cards a player plays in the phase or the round and the number the active player has played. */
type PlayLimit = { source: string; max: number; played: number; per: "phase" | "round" };

/**
 * The LimitPlaysPerPhase or LimitPlaysPerRound in force that bars the card from being played: the active player has played as many cards this phase (or this round, any phase) as it allows (`state.played`, whose entries leave the phase out for the Planning phase).
 * A card put into play is not played, so `how.putting` is never barred. Null when nothing bars it.
 */
function playLimit(state: ScenarioState, cardId: string, ctx: ReduceContext, how: PlayHow): PlayLimit | null {
  const card = state.cards[cardId];
  if (how.putting === true || !card || inPlay(card.zone) || (!gameReads(state, ctx, '"LimitPlaysPerPhase"') && !gameReads(state, ctx, '"LimitPlaysPerRound"'))) return null;
  const mine = (state.played ?? []).filter((entry) => entry.round === state.round && entry.seat === state.activeSeat);
  const inPhase = mine.filter((entry) => (entry.phase ?? "Planning") === state.phase).length;
  const held = constantInstructions(state, ctx).find(({ instruction }) => (instruction.verb === "LimitPlaysPerPhase" && inPhase >= instruction.max) || (instruction.verb === "LimitPlaysPerRound" && mine.length >= instruction.max));
  if (!held) return null;
  const source = stageName(state, ctx, held.source.id, printedOf(ctx.cards, held.source.code).name);
  if (held.instruction.verb === "LimitPlaysPerPhase") return { source, max: held.instruction.max, played: inPhase, per: "phase" };
  return held.instruction.verb === "LimitPlaysPerRound" ? { source, max: held.instruction.max, played: mine.length, per: "round" } : null;
}

/** Whether a LimitPlaysPerPhase or LimitPlaysPerRound in force bars the card from being played (families/wilderland/index.ts, the `play` hook). */
export function playLimitBars(state: ScenarioState, cardId: string, ctx: ReduceContext, how: PlayHow): boolean {
  return playLimit(state, cardId, ctx, how) != null;
}

/** The words for a refused play (the `playReason` hook): "Exploring Gundabad (play limit): each player can play only 1 card per phase. You have played 1 this planning phase." Null when no limit bars the card. */
export function playLimitRefusal(state: ScenarioState, cardId: string, ctx: ReduceContext): string | null {
  const limit = playLimit(state, cardId, ctx, {});
  if (!limit) return null;
  const who = state.seatCount > 1 ? `Player ${state.activeSeat + 1} has` : "You have";
  const cards = limit.max === 1 ? "card" : "cards";
  return limit.per === "phase"
    ? `${limit.source}: each player can play only ${limit.max} ${cards} per phase. ${who} played ${limit.played} this ${state.phase.toLowerCase()} phase.`
    : `${limit.source}: each player can play only ${limit.max} ${cards} each round. ${who} played ${limit.played} this round.`;
}

// The cards this seat has played or put into play from its hand this round (`handPlays`, noted by noteHandPlay), and the LimitHandPlaysPerRound in force that the seat has used up, if any.
function handPlayLimit(state: ScenarioState, cardId: string, ctx: ReduceContext, seat: number): { source: string; max: number; played: number } | null {
  const card = state.cards[cardId];
  if (!card || card.zone !== "hand" || !gameReads(state, ctx, HAND_LIMIT)) return null;
  const played = state.modifiers.filter((modifier) => modifier.stat === "handPlays" && modifier.seat === seat && modifierActive(state, modifier)).length;
  const held = constantInstructions(state, ctx).find(({ instruction }) => instruction.verb === "LimitHandPlaysPerRound" && played >= instruction.max);
  return held && held.instruction.verb === "LimitHandPlaysPerRound" ? { source: stageName(state, ctx, held.source.id, printedOf(ctx.cards, held.source.code).name), max: held.instruction.max, played } : null;
}

const HAND_LIMIT = '"LimitHandPlaysPerRound"';

/** Whether a LimitHandPlaysPerRound in force bars the card, in the hand, from being played or put into play by the seat (`how.seat`, the active seat when it is not given). */
export function handPlaysBarred(state: ScenarioState, cardId: string, ctx: ReduceContext, how: PlayHow): boolean {
  return handPlayLimit(state, cardId, ctx, how.seat ?? state.activeSeat) != null;
}

/** The words for a refused play of a card in the hand: "Through the Ruins: each player can play or put into play only 1 card from his hand each round." Null when no limit bars it. */
export function handPlayRefusal(state: ScenarioState, cardId: string, ctx: ReduceContext): string | null {
  const limit = handPlayLimit(state, cardId, ctx, state.activeSeat);
  if (!limit) return null;
  return `${limit.source}: each player can play or put into play only ${limit.max} ${limit.max === 1 ? "card" : "cards"} from his hand each round.`;
}

/** A card left the hand of `seat` by being played or put into play: it counts toward the round's limit, in a game with a LimitHandPlaysPerRound. */
export function noteHandPlay(state: ScenarioState, ctx: ReduceContext, seat: number, cardId: string): ScenarioState {
  if (!gameReads(state, ctx, HAND_LIMIT)) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: cardId, stat: "handPlays", amount: 1, until: "endOfRound", seat }] };
}
