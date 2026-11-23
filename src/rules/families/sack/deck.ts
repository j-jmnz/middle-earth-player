// Rules: hob.sack-deck, hob.sack-x, hob.sack-x-example (data/rules/entries.json); ledger lines 131023:A:1, 131032:A:2, 131033:A:2, 131034:A:2, 131051:A:1. The Sack deck (the zone `sackDeck`, in `piles`) and Sack X: the first player draws the top X cards one at a time and each card's When Sacked
// effect resolves before the next is drawn. A Sack card that leaves play is shuffled into the deck by moveCard (zones.ts, with the `deck: "sack"` mark and DECKS.sack in core/piles.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pileOf, withPile } from "../../core/piles.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { queueFront } from "../play/refs.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** PrepareSackDeck: every set-aside card with the Sack trait joins the Sack deck, facedown; the deck is shuffled (hob.sack-deck). */
export function prepareSackDeck(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const ids = Object.values(state.cards)
    .filter((card) => card.zone === "setAside" && printedOf(ctx.cards, card.code).traits.includes("Sack"))
    .map((card) => card.id);
  const dealt = withPile(state, "sackDeck", pileOf(state, "sackDeck"));
  return ids.reduce((next, id) => updateCard(moveCard(next, id, { zone: "sackDeck" }), id, { face: "down", controller: null }), dealt);
}

/** Sack X: the top card of the Sack deck is sacked now, and the rest of the X wait in the running effect behind it. */
export function sack(state: ScenarioState, instruction: Verb<"Sack">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const times = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  const id = pileOf(state, "sackDeck")[0];
  const code = id ? state.cards[id]?.code : undefined;
  if (times <= 0 || !id || !code) return state;
  const rest: Instruction = { verb: "Sack", amount: times - 1 };
  const queued = times > 1 && effectData(state) ? queueFront(state, [{ instruction: rest, seat: focus.seat, chosen: null }]) : state;
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "triggered" && effect.trigger === "sacked");
  return pushCardEffects(queued, "whenRevealed", id, state.firstPlayer, false, effects, ctx, steps);
}
