// Rules: rr.initiating-abilities-playing-cards, rr.resource-match (data/rules/entries.json); ledger line 10165:A:4. Stalwart's Planning Action, "Play an attachment from your discard pile on attached hero": the Action puts the permission on the hero (`attachmentFromDiscard`, until the end of the phase),
// and the player then plays the attachment through the ordinary Play intent, paying its cost, onto that hero alone. The permission is used up by the play.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { modifierActive, type ScenarioState } from "../../core/state.ts";

/** The heroes the seat controls that hold the permission to be played an attachment from the seat's discard pile. */
export function discardGrantHosts(state: ScenarioState, seat: number): string[] {
  return state.modifiers.filter((modifier) => modifier.stat === "attachmentFromDiscard" && modifier.amount > 0 && modifierActive(state, modifier) && state.cards[modifier.instanceId]?.controller === seat).map((modifier) => modifier.instanceId);
}

/** The attachments in the seat's discard pile the permission lets it play. */
export function discardGranted(state: ScenarioState, seat: number, ctx: ReduceContext): string[] {
  if (discardGrantHosts(state, seat).length === 0) return [];
  return (state.seats[seat]?.discard ?? []).filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "attachment");
}

/** The state with the permission on this hero used up. */
export function spendDiscardGrant(state: ScenarioState, hostId: string): ScenarioState {
  const at = state.modifiers.findIndex((modifier) => modifier.stat === "attachmentFromDiscard" && modifier.instanceId === hostId);
  return at < 0 ? state : { ...state, modifiers: state.modifiers.filter((_, index) => index !== at) };
}
