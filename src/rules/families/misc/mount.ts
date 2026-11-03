// Rules: rr.attachment-cards, rr.restricted, rr.ally-cards (data/rules/entries.json).
//
// An ally that attaches itself to another ally (Wild Stallion, 19033:A:2). It stays among its player's cards in play but, being
// attached, it is an attachment and no character: combat.ts and pick.ts read a hosted ally that way. It counts as a Restricted
// Mount attachment through the flags its constant record gives it.
import { enforceRestricted } from "../../attach.ts";
import { syncConstants } from "../../constants.ts";
import type { EngineStep } from "../../intents.ts";
import type { ReduceContext } from "../../interpret.ts";
import type { ScenarioState } from "../../state.ts";
import { attachSourceTo } from "../attachments/play.ts";
import type { Focus } from "../index.ts";
import { lastPickedCard } from "../play/refs.ts";

export function attachAsMount(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const targetId = lastPickedCard(state);
  const target = targetId ? state.cards[targetId] : undefined;
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  // "Limit 1 per ally": a copy of the card is on the ally already.
  if (!target || !source || target.attachments.some((id) => state.cards[id]?.code === source.code)) return state;
  const attached = attachSourceTo(state, { verb: "AttachSourceTo", card: "picked" }, focus, ctx);
  if (attached === state) return state;
  // The flags it gains as an attachment count before the Restricted limit is checked.
  return enforceRestricted(syncConstants(attached, ctx), target.id, ctx, steps);
}
