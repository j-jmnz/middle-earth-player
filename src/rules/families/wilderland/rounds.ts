// Rules: rr.initiating-abilities-playing-cards, rr.cancel, rr.reveal (data/rules/entries.json); ledger lines 19137:B:1, 19140:B:1.
// What Mount Gundabad's stages say about a round or a phase: the first treachery revealed each round (its When Revealed effects cannot be canceled) and a limit on the cards a player plays in a phase. A game with no card that reads them does none of this work (`gameReads`).
import { gameReads } from "../../core/game-reads.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay } from "../../core/state.ts";
import { constantInstructions } from "../../interpret/constant-records.ts";
import { stageName } from "./gundabad.ts";
import type { PlayHow } from "../../interpret/family-manifest.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

/** A treachery was revealed: the first of the round is marked (`firstTreachery`, on the card until the round ends), in a game with an UncancelableWhenRevealed `firstRevealedEachRound`. */
export function noteTreacheryReveal(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  if (!card || printedOf(ctx.cards, card.code).type !== "treachery" || flagged(state, "table", "treacheryRevealed") || !gameReads(state, ctx, '"firstRevealedEachRound"')) return state;
  const mark = (instanceId: string, stat: "treacheryRevealed" | "firstTreachery") => ({ instanceId, sourceId: instanceId, stat, amount: 1, until: "endOfRound" as const });
  return { ...state, modifiers: [...state.modifiers, mark("table", "treacheryRevealed"), mark(cardId, "firstTreachery")] };
}

/** A LimitPlaysPerPhase that bars the card: the name of the card that holds it, the most cards a player plays in a phase and the number the active player has played. */
type PhasePlayLimit = { source: string; max: number; played: number };

/**
 * The LimitPlaysPerPhase in force that bars the card from being played: the active player has played as many cards this phase as it allows (`state.played`, whose entries leave the phase out for the Planning phase). A card put into play is not played, so `how.putting`
 * is never barred. Null when nothing bars it.
 */
function phasePlayLimit(state: ScenarioState, cardId: string, ctx: ReduceContext, how: PlayHow): PhasePlayLimit | null {
  const card = state.cards[cardId];
  if (how.putting === true || !card || inPlay(card.zone) || !gameReads(state, ctx, '"LimitPlaysPerPhase"')) return null;
  const played = (state.played ?? []).filter((entry) => entry.round === state.round && entry.seat === state.activeSeat && (entry.phase ?? "Planning") === state.phase).length;
  const held = constantInstructions(state, ctx).find(({ instruction }) => instruction.verb === "LimitPlaysPerPhase" && played >= instruction.max);
  return held && held.instruction.verb === "LimitPlaysPerPhase" ? { source: stageName(state, ctx, held.source.id, printedOf(ctx.cards, held.source.code).name), max: held.instruction.max, played } : null;
}

/** Whether a LimitPlaysPerPhase in force bars the card from being played (families/wilderland/index.ts, the `play` hook). */
export function phasePlaysBarred(state: ScenarioState, cardId: string, ctx: ReduceContext, how: PlayHow): boolean {
  return phasePlayLimit(state, cardId, ctx, how) != null;
}

/** The words for a refused play (the `playReason` hook): "Exploring Gundabad (play limit): each player can play only 1 card per phase. You have played 1 this planning phase." Null when no limit bars the card. */
export function phasePlayRefusal(state: ScenarioState, cardId: string, ctx: ReduceContext): string | null {
  const limit = phasePlayLimit(state, cardId, ctx, {});
  if (!limit) return null;
  const who = state.seatCount > 1 ? `Player ${state.activeSeat + 1} has` : "You have";
  return `${limit.source}: each player can play only ${limit.max} ${limit.max === 1 ? "card" : "cards"} per phase. ${who} played ${limit.played} this ${state.phase.toLowerCase()} phase.`;
}
