// Rules: rr.forced, rr.active-location (data/rules/entries.json); ledger line 04092:A:1. Progress that would be placed on a location whose Forced effect hears `progressWouldBePlaced` (Twisting Passage) waits for that effect: the placement is not made and the event is queued with the amount
// (progress.ts places it once the locate test is passed). One placement is one event: a quest phase's progress, a Cave Torch Action, any other effect each make their own test. The cards that hold progress are noted at the start of a game that deals one (`progressHeldBy`); every other game is unchanged.
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { queueEvent } from "../../windows/queue.ts";

/** The start of a game with a card that holds progress notes its code; every other game is left as it is. */
export function markProgressHeld(state: ScenarioState, ctx: Pick<ReduceContext, "effects">): ScenarioState {
  const dealt = new Set(Object.values(state.cards).map((card) => card.code));
  const codes = [...new Set(ctx.effects.filter((effect) => effect.trigger === "progressWouldBePlaced" && dealt.has(effect.cardCode)).map((effect) => effect.cardCode))];
  return codes.length === 0 ? state : { ...state, progressHeldBy: codes };
}

/** The location is in play and its Forced effect hears `progressWouldBePlaced`: what would be placed on it is held back. */
export function holdsProgress(state: ScenarioState, id: string): boolean {
  const codes = state.progressHeldBy;
  return codes != null && codes.includes(state.cards[id]?.code ?? "");
}

/** The placement of `amount` progress on the location is held: its record hears it with the amount. */
export function holdPlacement(state: ScenarioState, id: string, amount: number): ScenarioState {
  return amount > 0 ? queueEvent(state, { trigger: "progressWouldBePlaced", seat: null, cardId: id, amount }) : state;
}
