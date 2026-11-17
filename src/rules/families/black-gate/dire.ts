// Rules: mec113.dire, bts.valour (data/rules/entries.json). While the main quest has the Dire keyword each player's threat elimination level is 99 and their threat cannot be reduced by more than 1 each round by non-boon player card effects.
// The keyword is a printed flag of the quest card (`dire`, catalog/keyword-line.ts); the table keeps it in `state.dire` so eliminateEmpties, which reads no card catalog, can ask for the level. The Valour threshold (80 under Dire, 40 otherwise) is read by the `threat` condition marked `valour` (interpret/conditions.ts).
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";

/** The threat elimination level of a Dire quest (mec113.dire). */
export const DIRE_ELIMINATION_LEVEL = 99;
/** The most non-boon player card effects lower a player's threat in a round while the main quest is Dire (mec113.dire). */
export const DIRE_REDUCTION_CAP = 1;

/** Valour's threshold is 80 while the main quest is Dire (mec113.dire): the 40 of a `valour` condition and the 39 of its complement move up by this. */
export const DIRE_VALOUR_SHIFT = 40;

/** The main quest card in play prints the Dire keyword. */
export function questIsDire(state: ScenarioState, ctx: ReduceContext): boolean {
  const quest = state.questStage ? state.cards[state.questStage] : undefined;
  return quest != null && printedOf(ctx.cards, quest.code).keywords.dire;
}

/** `state.dire` follows the main quest card: set while it prints Dire, absent otherwise. The same state comes back when nothing changed. */
export function syncDire(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const dire = questIsDire(state, ctx);
  if (dire === (state.dire === true)) return state;
  const { dire: _was, ...rest } = state;
  return dire ? { ...rest, dire: true } : rest;
}

/** A boon is a player card the campaign hands out (`campaignKind: "boon"`): Dire's cap does not hold against it. */
export function isBoon(state: ScenarioState, sourceId: string | null, ctx: ReduceContext): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  return source != null && printedOf(ctx.cards, source.code).campaignKind === "boon";
}
