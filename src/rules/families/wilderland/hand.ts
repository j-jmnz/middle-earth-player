// Rules: rr.first-player (data/rules/entries.json); ledger lines 18026:A:1 (Lost in the Wild). A card that is revealed and goes to a player's hand: the player chosen by the cards they hold.
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { printedOf } from "../../core/printed.ts";
import { livingSeats, updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Instruction = Parameters<typeof askTarget>[1]["instruction"];

/** The players with no card of the source's title in hand, of whom the ones holding the most cards (`seat:N`). */
function holders(state: ScenarioState, sourceId: string, ctx: ReduceContext): string[] {
  const title = printedOf(ctx.cards, state.cards[sourceId]?.code ?? "").name;
  const eligible = livingSeats(state).filter((seat) => !(state.seats[seat]?.hand ?? []).some((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").name === title));
  const most = Math.max(...eligible.map((seat) => state.seats[seat]?.hand.length ?? 0));
  return eligible.filter((seat) => (state.seats[seat]?.hand.length ?? 0) === most).map((seat) => `seat:${seat}`);
}

/**
 * AddSourceToHandOfMost: the source card joins the hand of the player with the most cards in hand among those holding no copy of it; the first player chooses among players tied. Run outside an effect frame, which cannot ask, it
 * goes to the first of them.
 */
export function addSourceToHandOfMost(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const sourceId = focus.sourceId;
  if (sourceId == null || state.cards[sourceId] == null) return state;
  const tied = holders(state, sourceId, ctx);
  const chosen = focus.chosen ?? (tied.length === 1 || !effectData(state) ? tied[0] : undefined);
  if (chosen == null) return tied.length === 0 ? state : askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, tied);
  const seat = Number(chosen.slice("seat:".length));
  if (!tied.includes(chosen)) return state;
  return updateCard(moveCard(state, sourceId, { zone: "hand", seat }), sourceId, { face: "up", controller: seat });
}
