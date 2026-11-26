// Rules: hrd.orcs-area, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage (data/rules/entries.json); ledger lines 17040:A:1, 17046:A:1, 17053:B:1. What a record reads of the Orcs' area: whether the players are at the Orcs' stage, the total Threat in the area, the
// cards of the area for a pick, and the raise of the staging area's total Threat that Howling at their Heels makes.
import type { Condition, PickSpec } from "../../../catalog/boundary.ts";

import { membersStanding } from "../../core/area-members.ts";
import { modifiedStat } from "../../core/modified-stat.ts";
import type { PrintedCard } from "../../core/printed.ts";
import { flagged, livingSeats, type ScenarioState } from "../../core/state.ts";
import { stageNumber } from "../caves/progress.ts";
import { orcsOf } from "./orcs-zone.ts";

/** The players' main quest stage's number and the Orcs' current stage's number match (hrd.orcs-area-different-stage: "2B-Racing North" and "2D-Racing North"). A side quest as the current quest changes nothing: the main quest card decides. */
export function atOrcsStage(state: ScenarioState): boolean {
  const area = orcsOf(state);
  return area != null && state.questStage != null && stageNumber(state) === area.number;
}

/** The condition `orcsStage`: the players are at the Orcs' stage, or not (`is`), and the Orcs' stage has this number (`at`). False in a game with no Orcs' area. */
export function orcsCondition(state: ScenarioState, condition: Condition): boolean | null {
  if (condition.kind !== "orcsStage") return null;
  const area = orcsOf(state);
  if (area == null || (condition.at != null && area.number !== condition.at)) return false;
  return condition.is == null || (condition.is === "sameStage") === atOrcsStage(state);
}

/** The cards of the area wherever they stand now: in the area zone while the players are at another stage, in the staging area at the Orcs' stage. */
export function orcsMembers(state: ScenarioState): readonly string[] {
  return membersStanding(state, orcsOf(state)?.members ?? [], "orcsArea");
}

/** The total of the current Threat of the cards in the Orcs' area, the Chieftain included, engaged enemies not (hrd.orcs-area: "the total Threat in the Orcs' area"). */
export function orcsAreaThreat(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): number {
  let total = 0;
  for (const id of orcsMembers(state)) {
    const card = state.cards[id];
    if (card) total += modifiedStat(state, card, "threat", cards);
  }
  return total;
}

/** The total of the current Threat of every enemy engaged with a player (17054:B:2). */
export function engagedThreatTotal(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): number {
  let total = 0;
  for (const seat of livingSeats(state)) {
    for (const id of state.seats[seat]?.engaged ?? []) {
      const card = state.cards[id];
      if (card) total += modifiedStat(state, card, "threat", cards);
    }
  }
  return total;
}

/** The pick filter `inOrcsArea`: false for a card that is no member of the area when the pick asks for one; true leaves the other filters to decide. */
export function orcsPickMatches(state: ScenarioState, id: string, spec: PickSpec): boolean {
  return spec.inOrcsArea !== true || orcsMembers(state).includes(id);
}

/** What Howling at their Heels adds to the staging area's total Threat while the table holds `orcsInStagingThreat`: the total Threat of the area, read live. At the Orcs' stage the cards of the area stand in the staging area and count already (hrd.orcs-area-same-stage). */
export function orcsStagingRaise(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): number {
  if (state.orcs == null || state.modifiers.length === 0 || !flagged(state, "table", "orcsInStagingThreat") || atOrcsStage(state)) return 0;
  return orcsAreaThreat(state, cards);
}
