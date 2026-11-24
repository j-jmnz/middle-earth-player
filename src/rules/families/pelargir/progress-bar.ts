// Rules: rr.staging-area, rr.cannot, rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 06091:B:1.
// "Player card effects cannot place progress tokens on locations in the staging area": the table holds `noProgressInStagingByPlayer` while the stage is in play, and the progress a player card's effect would place on a location that lies in the staging area is not placed. A location that is
// active or in a player's play area is not in the staging area, and an encounter card's or a location's own effect is no player card effect.
import type { Instruction } from "../../../catalog/boundary.ts";
import { isPlayerType, printedOf, type PrintedCard } from "../../core/printed.ts";
import type { EngineStep } from "../../core/intents.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";

/** A player card's effect may not place progress on this location: the bar holds and the location is in the staging area. False for an effect of any other card. */
export function playerProgressBarredOn(state: ScenarioState, id: string, byPlayerCard: boolean): boolean {
  return byPlayerCard && state.modifiers.length > 0 && state.cards[id]?.zone === "staging" && flagged(state, "table", "noProgressInStagingByPlayer");
}

/** Whether the instruction after a Pick places progress on the card the Pick chose (PlaceProgressOn picked): the pick of a player card leaves out the locations the bar covers, so the ability is not offered with no target left (rr.triggered-ability). */
export function placesPicked(instruction: Instruction | undefined): boolean {
  return instruction?.verb === "PlaceProgressOn" && instruction.target === "picked";
}

/** Whether a Pick that feeds a progress placement may not choose this location: a player card is the source and the bar holds on it. False in every game without the flag. */
export function pickBarred(state: ScenarioState, id: string, sourceId: string | null, cards: ReadonlyMap<string, PrintedCard>): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  return state.modifiers.length > 0 && source != null && playerProgressBarredOn(state, id, isPlayerType(printedOf(cards, source.code)));
}

/** The log's line for progress the bar kept: a progress step of 0 on the location (no other effect places 0). */
export function noteBarred(steps: EngineStep[], id: string): void {
  steps.push({ kind: "progress", targetId: id, amount: 0, cause: currentCause(steps, UNATTRIBUTED) });
}
