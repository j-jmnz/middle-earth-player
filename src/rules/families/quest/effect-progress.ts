// Rules: rr.step-3-4, rr.active-location, rr.cannot (data/rules/entries.json); ledger line 00018:B:1. "Progress tokens from card effects cannot be placed on this quest card or the active location": the flag `noEffectProgress` on the current quest stage bars every
// card effect, a player card's or an encounter card's, from placing progress on the stage and on an active location; the progress a successful quest places (placeQuestingProgress) is not an effect and goes on the active location first as usual.
// A location in the staging area can still take progress from an effect.
import type { EngineStep } from "../../core/intents.ts";
import type { PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { placeQuestProgress } from "../../quest/quest.ts";
import { flagged } from "../../core/state.ts";

type Cards = ReadonlyMap<string, PrintedCard>;
type Gate = (state: ScenarioState) => boolean;

/** The current quest stage holds the bar on progress from card effects (the flag `noEffectProgress`). */
export function effectProgressBarred(state: ScenarioState): boolean {
  return state.modifiers.length > 0 && state.questStage != null && flagged(state, state.questStage, "noEffectProgress");
}

/** A card effect cannot place progress on this card: the bar holds and the card is the current quest card or an active location. */
export function effectProgressBarredOn(state: ScenarioState, id: string): boolean {
  return effectProgressBarred(state) && (id === state.questStage || id === state.activeLocation || id === state.secondActiveLocation);
}

/** A card effect places progress on the current quest (the active location takes it first): nothing is placed while the stage bars it, otherwise it is placeQuestProgress. */
export function placeEffectProgress(state: ScenarioState, amount: number, cards: Cards, steps: EngineStep[], canAdvance: Gate): ScenarioState {
  return effectProgressBarred(state) ? state : placeQuestProgress(state, amount, cards, steps, canAdvance);
}
