// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages (data/rules/entries.json). What a record reads of the Stormcaller's area: whether the players are at the Stormcaller's stage, its
// stage number, and whether defeating the current quest stage catches up to it.
import type { Condition } from "../../catalog/boundary.ts";

import type { ScenarioState } from "../state.ts";
import { stageNumber } from "./caves-progress.ts";
import { areaOf } from "./stormcaller-zone.ts";

/** The stage number of the Stormcaller's current quest stage (2 to 4), or 0 when the game has no Stormcaller's area. */
export function stormcallerStageNumber(state: Pick<ScenarioState, "sea">): number {
  return areaOf(state)?.number ?? 0;
}

/** The number of the Stormcaller's last stage (4): its current stage and the stages still in its quest deck. 0 when the game has no Stormcaller's area. */
export function stormcallerLastStage(state: Pick<ScenarioState, "sea">): number {
  const area = areaOf(state);
  return area ? area.number + area.deck.length : 0;
}

/** The players' main quest stage's number and the Stormcaller's current stage's number match (dcce.stormcallers-area-stages: "2B-Full Sail Ahead!" and "2D-Full Sail Ahead!"). */
export function atStormcallersStage(state: ScenarioState): boolean {
  const area = areaOf(state);
  return area != null && state.questStage != null && stageNumber(state) === area.number;
}

/** The condition `stormcaller`: the players are at the Stormcaller's stage, or the Stormcaller is ahead of them. False in a game with no Stormcaller's area. */
export function stormcallerHolds(state: ScenarioState, condition: Extract<Condition, { kind: "stormcaller" }>): boolean {
  if (areaOf(state) == null) return false;
  return condition.is === "sameStage" ? atStormcallersStage(state) : !atStormcallersStage(state);
}

/** The players have caught up to the Stormcaller by defeating this stage: the stage names the Stormcaller's stage number that makes it a win (CatchUpWins) and the Stormcaller is there. */
export function caughtUp(state: ScenarioState, stageCode: string): boolean {
  const need = state.stages.find((stage) => stage.code === stageCode)?.catchUp;
  return need != null && areaOf(state)?.number === need;
}

/** Where a card of the area (not its stage) stands: `apart` in the area zone while the players are at another stage, `together` in the staging area at the Stormcaller's stage, null for a card that is not
 * a member (or has left the area for another zone). The one owner of a card's place in the area; the table's role reads it. */
export function areaPlace(game: Pick<ScenarioState, "sea" | "cards">, id: string): "apart" | "together" | null {
  const area = areaOf(game);
  const card = game.cards[id];
  if (!area || !card || id === area.stage || !area.members.includes(id)) return null;
  return card.zone === "stormcallerArea" ? "apart" : card.zone === "staging" ? "together" : null;
}

/** Where a card stands in the Stormcaller's area, for its preview: `apart` (a card of the area while the players are at another stage), `together` (a card of the area in the staging area, the players being at the
 * Stormcaller's stage), `stage` (the Stormcaller's current quest stage once the players have reached it), `stageApart` (that stage while the players are at another), or null for any other card. */
export function areaStanding(state: ScenarioState, id: string): "apart" | "together" | "stage" | "stageApart" | null {
  const area = areaOf(state);
  if (!area || !state.cards[id]) return null;
  if (id === area.stage) return atStormcallersStage(state) ? "stage" : "stageApart";
  return areaPlace(state, id);
}
