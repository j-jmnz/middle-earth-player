// Rules: rr.engaged, rr.attachment-cards (data/rules/entries.json); ledger line 07025:A:1.
// Mugash's Guard: "While a player controls a hero with Mugash attached, Mugash's Guard engages that player." A Guard in the staging area that holds `engagesCaptiveHolder` (a constant record, family ring-maker) engages the seat that controls such a hero at once, whatever its engagement cost,
// as the settle sweep sees it (not at the engagement check). The sweep does nothing in a game with no card that holds the flag. Pure.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { engageWith } from "../../quest/quest.ts";
import { returnAttachedEnemy } from "../angmar/reanimate/attached.ts";

const CAPTIVE_NAME = "Mugash";

/** The seat that controls a hero with Mugash attached (the first player's seat first), or null. */
function captorSeat(state: ScenarioState, ctx: ReduceContext): number | null {
  for (let step = 0; step < state.seatCount; step += 1) {
    const seat = (state.firstPlayer + step) % state.seatCount;
    const held = (state.seats[seat]?.heroes ?? []).some((hero) => (state.cards[hero]?.attachments ?? []).some((id) => state.cards[id]?.asAttachment === true && printedOf(ctx.cards, state.cards[id]?.code ?? "").name === CAPTIVE_NAME));
    if (held && !state.seats[seat]?.eliminated) return seat;
  }
  return null;
}

/** The settle sweep: each Guard in the staging area with the flag engages the seat that holds Mugash on a hero. */
export function engageCaptiveHolders(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.stack.length > 0 || state.lost || state.failure || state.modifiers.length === 0) return state;
  const guards = state.staging.filter((id) => state.cards[id]?.zone === "staging" && flagged(state, id, "engagesCaptiveHolder"));
  if (guards.length === 0) return state;
  const seat = captorSeat(state, ctx);
  if (seat == null) return state;
  return guards.reduce((next, id) => engageWith(next, seat, id, steps), state);
}

/** ReturnAttachedEnemy: each enemy with the title that lies attached to a card as an attachment goes back to the staging area as an enemy (the angmar family's `returnAttachedEnemy`, which clears its host). One that lies elsewhere stays. */
export function returnAttachedByName(state: ScenarioState, instruction: Extract<Instruction, { verb: "ReturnAttachedEnemy" }>, ctx: ReduceContext): ScenarioState {
  return Object.values(state.cards).reduce((next, card) => (card.asAttachment === true && card.zone === "attached" && printedOf(ctx.cards, card.code).name === instruction.name ? (returnAttachedEnemy(next, card.id) ?? next) : next), state);
}
