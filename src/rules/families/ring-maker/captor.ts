// Rules: rr.engaged, rr.attachment-cards (data/rules/entries.json); ledger line 07025:A:1.
// Mugash's Guard: "While a player controls a hero with Mugash attached, Mugash's Guard engages that player." A Guard in the staging area whose constant record holds `EngageCaptiveHolder` (family ring-maker; the record names the captive) engages the seat that controls a hero with that
// captive attached at once, whatever its engagement cost, as the settle sweep sees it (not at the engagement check). The sweep runs only in a game with such a record. Pure.
import type { Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { holds } from "../../interpret/conditions.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { returnAttachedEnemy } from "../angmar/reanimate/attached.ts";
import { effectsOfCard } from "../misc/text.ts";
import { engageEnemies } from "./engage.ts";

/** The title a card's `EngageCaptiveHolder` record names, or null for a card without one (a card that shows no such text, or any card of another game). */
function captiveOf(state: ScenarioState, ctx: ReduceContext, card: CardInstance): string | null {
  const scope = { actor: card.controller ?? 0, sourceId: card.id, returned: 0 };
  for (const effect of effectsOfCard(state, ctx, card)) {
    // The record's own condition says where the Guard works (staging or engaged).
    if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
    for (const instruction of effect.instructions) if (instruction.verb === "EngageCaptiveHolder") return instruction.captive;
  }
  return null;
}

/** The seat that controls a hero with the Guard's captive attached (the first player's seat first), or null: the Guard's own record names the captive. A seat that is eliminated holds nothing. Used by the settle sweep and by the card preview. */
export function captorSeat(state: ScenarioState, ctx: ReduceContext, guardId: string): number | null {
  const guard = state.cards[guardId];
  const captive = guard == null ? null : captiveOf(state, ctx, guard);
  if (captive == null) return null;
  const holder: PickSpec = { type: "hero", control: "you", hasAttachment: { names: [captive] } };
  for (let step = 0; step < state.seatCount; step += 1) {
    const seat = (state.firstPlayer + step) % state.seatCount;
    if (!state.seats[seat]?.eliminated && pickCandidates(state, holder, seat, [], guardId, ctx, undefined, undefined, true).length > 0) return seat;
  }
  return null;
}

/** The settle sweep: each Guard with the record, in the staging area or engaged with another seat, engages the seat that holds its captive on a hero. */
export function engageCaptiveHolders(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.stack.length > 0 || state.lost || state.failure || !gameReads(state, ctx, '"EngageCaptiveHolder"')) return state;
  // A Guard engaged with another player moves to the holder too (agent recommendation, docs/scenarios/the-ring-maker/to-catch-an-orc.md, 07025:A:1): the text engages "that player" for as long as it holds, and an enemy is engaged with one player only.
  return engageEnemies(state, steps, (next, id) => captorSeat(next, ctx, id));
}

/** ReturnAttachedEnemy: each enemy with the title that lies attached to a card as an attachment goes back to the staging area as an enemy (the angmar family's `returnAttachedEnemy`, which clears its host). One that lies elsewhere stays. */
export function returnAttachedByName(state: ScenarioState, instruction: Extract<Instruction, { verb: "ReturnAttachedEnemy" }>, ctx: ReduceContext): ScenarioState {
  return Object.values(state.cards).reduce((next, card) => (card.asAttachment === true && card.zone === "attached" && printedOf(ctx.cards, card.code).name === instruction.name ? (returnAttachedEnemy(next, card.id) ?? next) : next), state);
}
