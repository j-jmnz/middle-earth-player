// Rules: rr.quest-advancement, mec113.assault (data/rules/entries.json).
// The progress a quest stage turns into something else before it is placed on the stage (placeQuestProgress, quest/quest.ts): discards from the encounter deck, rescued captured cards, an event its record hears, or nothing.
import { flagged, type Modifier, type ScenarioState } from "../core/state.ts";
import { oweDiscards } from "../families/breaking/progress.ts";
import { rescueRandom } from "../families/captured/rescue.ts";
import { queueEvent } from "../windows/queue.ts";

// The flags of a quest stage that replace the progress placed on it, tried in this order: the removal of damage from locations in play (families/aflame.ts, 11037:B:1), progress the players place on a location in the staging area instead (families/island.ts, 12067:B:2) and,
// for progress from questing successfully only (a player card's is placed as usual), damage among the enemies in play (families/pelennor, 145076:B:1).
const PROGRESS_REPLACED: readonly { flag: Modifier["stat"]; questingOnly: boolean }[] = [
  { flag: "progressHeals", questingOnly: false },
  { flag: "progressToStaging", questingOnly: false },
  { flag: "progressAsDamage", questingOnly: true },
];

// What is left of `remaining` once the stage's flags have taken their share; the caller has checked that no side quest takes the progress instead (mec108.side-quests-in-play).
export function replaceStageProgress(state: ScenarioState, remaining: number, questing: boolean): { state: ScenarioState; remaining: number } {
  const stage = state.questStage;
  let next = state;
  // Progress a stage turns into discards from the encounter deck (families/breaking/progress.ts).
  if (remaining > 0 && stage && flagged(next, stage, "progressDiscards")) {
    next = oweDiscards(next, remaining);
    remaining = 0;
  }
  // Progress a stage turns into rescued captured cards, at random, instead of progress on it (families/captured/rescue.ts, 10039:B:1).
  if (remaining > 0 && stage && flagged(next, stage, "progressRescues")) {
    next = rescueRandom(next, stage, remaining);
    remaining = 0;
  }
  // Progress a stage turns into an event its record hears (progressReplaced, with the amount) instead of progress on it.
  if (remaining > 0 && stage && PROGRESS_REPLACED.some((one) => (!one.questingOnly || questing) && flagged(next, stage, one.flag))) {
    next = queueEvent(next, { trigger: "progressReplaced", seat: null, cardId: stage, amount: remaining });
    remaining = 0;
  }
  // Assault (mec113.assault): no progress is placed on the stage by questing or by a player card effect; the active location above took its share as usual.
  if (remaining > 0 && stage && flagged(next, stage, "assault")) remaining = 0;
  return { state: next, remaining };
}
