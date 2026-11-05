// Rules: mec109.immune-to-player-card-effects, rr.cannot (data/rules/entries.json); ledger lines 12159:A:1 and 110129:A:1. "Each Raider enemy with at least 1 resource on it is immune to player events": a card holding the flag
// immuneToPlayerEvents is not offered to an event's Pick, the way a card that is immune to player card effects is not (a player card that is not an event still reaches it).
import type { PickContext } from "../../interpret/pick.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";

/** The family's pick hook: false when the candidate is immune to player events and the effect choosing it is a player event. */
export function immuneToEvents(state: ScenarioState, id: string, at: PickContext, ctx: ReduceContext): boolean {
  if (at.counting || at.sourceId == null || !flagged(state, id, "immuneToPlayerEvents")) return true;
  const source = state.cards[at.sourceId];
  if (!source) return true;
  const printed = printedOf(ctx.cards, source.code);
  return !(printed.type === "event" && printed.backType !== "encounter");
}
