// Rules: rr.step-3-4, rr.threat-threat-dial, rr.initial-threat-level, rr.threat-elimination-level, rr.player-elimination,
// rr.response (data/rules/entries.json).
// Threat for the quest family: a player card effect that reduces threat (Saruman's cap, the event Hobbit Pipe hears), the threat
// a failed quest raises (waived by Doom Hangs Still and Ever Onward, and held back while a Response to the failed quest could
// still waive it), threat raised by encounter and quest cards (Elfhelm), the starting threat level (Aragorn) and a card that
// keeps its player in the game at the threat elimination level (Favor of the Valar).
import type { Cause } from "../cause.ts";
import { currentCause, ruleCause, UNATTRIBUTED } from "../cause.ts";
import { holds } from "../conditions.ts";
import { pushEffectFrame } from "../effect-frames.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { eliminateEmpties, lowerThreat, raiseThreat } from "../keywords.ts";
import { effectsOf } from "../listen.ts";
import { isPlayerType, printedOf } from "../printed.ts";
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";
import { flagged, heldAmount, inPlay, livingSeats } from "../state.ts";
import { heard, queueHeard } from "./quest-events.ts";

const QUEST_FAILURE: Cause = ruleCause("rr.step-3-4");

function playerSource(state: ScenarioState, sourceId: string | null, ctx: ReduceContext): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  return source != null && isPlayerType(printedOf(ctx.cards, source.code));
}

// A player card effect lowers the seat's threat: by at most 1 while the seat holds threatReductionToOne (22054:A:1). When the
// dial moved, the seat hears which card lowered it (141015:A:2).
export function lowerThreatByEffect(state: ScenarioState, seat: number, amount: number, sourceId: string | null, ctx: ReduceContext, steps: EngineStep[], cause: Cause): ScenarioState {
  const player = playerSource(state, sourceId, ctx);
  // A contract bars the player's threat from being reduced by player card effects (1) or by those of cards other than contracts (2)
  // (A Perilous Voyage, 40047).
  const barred = player ? heldAmount(state, `seat:${seat}`, "noThreatReduction") : 0;
  const fromContract = sourceId != null && state.cards[sourceId] != null && printedOf(ctx.cards, state.cards[sourceId]?.code ?? "").type === "contract";
  const reduced = barred === 1 || (barred > 1 && !fromContract) ? 0 : amount;
  const once = player && heldAmount(state, `seat:${seat}`, "threatReductionToOne") > 0 ? Math.min(reduced, 1) : reduced;
  // "Cannot be reduced by more than 1 each round" (11217:A:1, dcce.hard-expert): what the round has already taken off counts.
  const roundCap = player ? heldAmount(state, `seat:${seat}`, "threatReductionCap") : 0;
  const capped = roundCap > 0 ? Math.max(0, Math.min(once, roundCap - (state.threatLoweredBy?.[seat] ?? 0))) : once;
  const before = state.seats[seat]?.threat ?? 0;
  const moved = lowerThreat(state, seat, capped, steps, cause);
  const lowered = roundCap > 0 ? { ...moved, threatLoweredBy: { ...moved.threatLoweredBy, [seat]: (moved.threatLoweredBy?.[seat] ?? 0) + (before - (moved.seats[seat]?.threat ?? 0)) } } : moved;
  if ((lowered.seats[seat]?.threat ?? 0) >= before || !sourceId) return lowered;
  return queueHeard(lowered, ctx, { trigger: "threatLowered", seat, subject: sourceId });
}

// The seat does not raise its threat from questing unsuccessfully (10117:A:1, 03005:A:1).
export function questThreatWaived(state: ScenarioState, seat: number): boolean {
  return flagged(state, `seat:${seat}`, "noQuestThreat");
}

// The threat a failed quest raises for one seat (rr.step-3-4), unless it is waived. While some card could answer the failed
// quest ("After players quest unsuccessfully, choose a player. That player does not raise his threat", 03005:A:1), the raise
// waits in a frame under those Responses: the questFailed events are announced first, so their Responses resolve first.
export function questFailureRaise(ctx: ReduceContext, steps: EngineStep[]): (state: ScenarioState, seat: number, amount: number) => ScenarioState {
  return (state, seat, amount) => {
    if (questThreatWaived(state, seat)) return state;
    if (!heard(state, ctx, "questFailed")) return raiseQuestThreat(state, seat, amount, ctx, steps);
    return pushEffectFrame(
      state,
      { frame: "ResolveEffect", sourceId: null, actor: seat, peril: false, effectId: "rr.step-3-4", instructions: [{ verb: "RaiseQuestThreat", amount }], cancel: null, blockCancel: null, cause: QUEST_FAILURE },
      steps,
    );
  };
}

// The quest failure raise itself. The seat hears that its threat was raised by questing unsuccessfully (02100:A:1).
export function raiseQuestThreat(state: ScenarioState, seat: number, amount: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (questThreatWaived(state, seat)) return state;
  const raised = raiseThreat(state, seat, amount, steps, QUEST_FAILURE);
  return queueHeard(raised, ctx, { trigger: "threatRaisedByEncounter", seat });
}

// An encounter or quest card's effect raised these seats' threat (02100:A:1). A player card's raise is not announced.
export function encounterRaised(state: ScenarioState, seats: readonly number[], sourceId: string | null, ctx: ReduceContext): ScenarioState {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source || isPlayerType(printedOf(ctx.cards, source.code))) return state;
  let next = state;
  for (const seat of seats) next = queueHeard(next, ctx, { trigger: "threatRaisedByEncounter", seat });
  return next;
}

// The starting threat level: the threat set at setup, kept when a card of the game reads it (recordStartingThreat), or else the
// combined threat cost of the seat's heroes (rr.initial-threat-level).
export function startingThreat(state: ScenarioState, seat: number, ctx: ReduceContext): number {
  const kept = state.startingThreat?.[seat];
  if (kept != null) return kept;
  return (state.seats[seat]?.heroes ?? []).reduce((sum, id) => sum + (printedOf(ctx.cards, state.cards[id]?.code ?? "").threat ?? 0), 0);
}

// "Reduce your threat to your starting threat level" (04053:A:2): a reduction by a player card effect, so the cap applies.
export function resetThreat(state: ScenarioState, seat: number, sourceId: string | null, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const over = (state.seats[seat]?.threat ?? 0) - startingThreat(state, seat, ctx);
  return over > 0 ? lowerThreatByEffect(state, seat, over, sourceId, ctx, steps, currentCause(steps, UNATTRIBUTED)) : state;
}

// Setup: each seat's threat is its starting threat level. It is kept only when some card of the game resets threat to it.
export function recordStartingThreat(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const reads = Object.values(state.cards).some((card) => effectsOf(ctx, card.code).some((effect) => effect.instructions.some((instruction) => instruction.verb === "ResetThreat")));
  return reads ? { ...state, startingThreat: state.seats.slice(0, state.seatCount).map((seat) => seat.threat) } : state;
}

// The seats a card in play would keep in the game when their threat reaches the elimination level: a card its seat controls
// with a Forced effect on wouldBeEliminated (10124:A:2). settle keeps the list current; eliminateEmpties reads it.
function savingSeats(state: ScenarioState, ctx: ReduceContext): number[] {
  if (!heard(state, ctx, "wouldBeEliminated")) return [];
  return livingSeats(state).filter((seat) =>
    Object.values(state.cards).some(
      (card) =>
        card.controller === seat &&
        inPlay(card.zone) &&
        effectsOf(ctx, card.code).some((effect) => effect.timing === "forced" && effect.trigger === "wouldBeEliminated" && (!effect.condition || holds(state, effect.condition, { actor: seat, sourceId: card.id, returned: 0 }, ctx))),
    ),
  );
}

export function syncThreatSaves(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const seats = savingSeats(state, ctx);
  const current = state.threatSaves ?? [];
  if (seats.length === current.length && seats.every((seat, at) => current[at] === seat)) return state;
  // A save that is gone while effects still resolve waits for them: the card that saved the seat may have flipped to a side that
  // lowers its threat (A Perilous Voyage, 40047:B:2).
  if (current.some((seat) => !seats.includes(seat)) && (state.stack.length > 0 || (state.pendingEvents?.length ?? 0) > 0)) return state;
  const { threatSaves: _old, ...rest } = state;
  const next: ScenarioState = seats.length > 0 ? { ...rest, threatSaves: seats } : rest;
  // A seat that lost its save while at the elimination level is eliminated now.
  return current.some((seat) => !seats.includes(seat)) ? eliminateEmpties(next, steps) : next;
}

// Instead of eliminating the seat, its saving card is asked: the Forced effect resolves (an ask that arrives after the card
// has gone is heard by no one), or the seat is eliminated once the card is gone (syncThreatSaves). Null: no card saves it.
export function threatSaved(state: ScenarioState, seat: number): ScenarioState | null {
  if (!state.threatSaves?.includes(seat)) return null;
  const asked = (state.pendingEvents ?? []).some((event) => event.trigger === "wouldBeEliminated" && event.seat === seat);
  return asked ? state : queueEvent(state, { trigger: "wouldBeEliminated", seat });
}
