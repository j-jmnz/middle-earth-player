// Rules: rr.in-play-and-out-of-play, rr.reveal, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger lines 21033:A:2, 21047:A:2, 21047:A:3.
// The cards Bribes counts as events discarded from the players' decks and the encounter cards that lie facedown under Seedy Tavern (PlaceUnderSelf is the encounter family's).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { cardsUnder } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { addResourceTokens } from "../nightmare/dungeon.ts";
import { effectData } from "../encounter/moves.ts";
import { startReveal } from "../../windows/frames.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** PlaceResourcePerDiscarded: one resource on the source for each card of the type that the running effect discarded from the top of the decks of the players it acted for. */
export function placeResourcePerDiscarded(state: ScenarioState, instruction: Verb<"PlaceResourcePerDiscarded">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const found = (effectData(state)?.discardedFromDecks ?? []).filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === instruction.cardType);
  return addResourceTokens(state, focus.sourceId, found.length);
}

/** RevealFacedownUnder: each card facedown under the source is revealed by the actor as an encounter card that is not from the encounter deck. The frames stack, so the last one started resolves first. */
export function revealFacedownUnder(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const ids = focus.sourceId ? cardsUnder(state, focus.sourceId) : [];
  return [...ids].reverse().reduce((next, id) => startReveal(next, focus.seat, ctx, steps, id), state);
}
