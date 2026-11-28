// Rules: rr.attachment-cards, rr.treachery-cards, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger lines 21017:A:1, 21021:A:1, 21021:A:2, 21024:A:2.
// AttachTreachery: a treachery of the encounter discard pile lies attached to an enemy as an attachment, its When Revealed and Surge not resolved.
import type { Instruction } from "../../../catalog/boundary.ts";

import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import { attachSelf } from "../../interpret/effect-targeted.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { attachBlocked } from "../../interpret/restrictions.ts";
import { topOfEncounterDiscard } from "../nightmare/index.ts";
import type { Focus } from "../index.ts";

/** AttachTreachery: the card is the topmost treachery with the Trait in the discard pile (`discardTop`), or the card the effect picked last when it lies there (`picked`: the card DiscardUntil found; with none found nothing attaches). The host is the enemy `to` names. */
export function attachTreachery(state: ScenarioState, instruction: Extract<Instruction, { verb: "AttachTreachery" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const card = instruction.from === "picked" ? lastPicked(state) : topOfEncounterDiscard(state, ["treachery"], ctx, instruction.trait);
  const host = refCard(state, instruction.to, frameScope(state, focus.seat, focus.sourceId));
  const found = card ? state.cards[card] : undefined;
  if (!card || !found || !host || !state.encounterDiscard.includes(card) || printedOf(ctx.cards, found.code).type !== "treachery") return state;
  if (state.cards[host]?.zone !== "staging" && state.cards[host]?.zone !== "engaged") return state;
  return attachBlocked(state, ctx, host, found.code) ? state : attachSelf(state, card, host, ctx);
}
