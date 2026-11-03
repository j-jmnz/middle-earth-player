// Rules: rr.framework-steps, rr.step-3-3, rr.step-3-4, rr.step-5-3, rr.engagement-check, rr.resources (data/rules/entries.json).
// The conditions the quest family adds (src/catalog/effect-schema-conditions.ts): where the round is in its framework steps,
// whether an enemy was engaged this encounter phase, and the current quest card's keywords.
import type { Condition } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret.ts";
import { printedOf } from "../../printed.ts";
import type { ScenarioState } from "../../state.ts";
import { flagged, reached } from "../../state.ts";

type Step = Extract<Condition, { kind: "step" }>["is"];

// The quest phase before the staging step is the commitment window (3.2); after it, the windows of 3.3 and 3.4. The quest is
// resolved once the resolution's first pass has run (questResolved) or the phase has stopped. In the encounter phase the
// engagement checks are made once the window after them (5.3) has been reached.
export function stepHolds(state: ScenarioState, step: Step): boolean {
  switch (step) {
    case "beforeStaging":
      return state.phase === "Quest" && state.mode === "questCommit";
    case "afterStaging":
      return state.phase === "Quest" && state.mode === "resolution";
    case "beforeResolution":
      return state.phase === "Quest" && state.mode !== "stopped" && !(state.mode === "resolution" && state.questResolved);
    case "canTravel":
      return state.phase === "Travel" && state.activeLocation == null;
    case "afterEngagementChecks":
      return state.phase === "Encounter" && state.mode === "engagement" && reached(state, "5.3");
  }
}

// An enemy engaged a player during this encounter phase: noteEngaged (quest/engage.ts) leaves a mark on the table until the
// phase ends.
export function engagedThisPhase(state: ScenarioState): boolean {
  return flagged(state, "table", "engagedThisPhase");
}

// A keyword printed on the current quest card (its keywords record, any flag set or number given).
export function questHasKeywords(state: ScenarioState, ctx: ReduceContext): boolean {
  const stage = state.questStage ? state.cards[state.questStage] : undefined;
  if (!stage) return false;
  return Object.values(printedOf(ctx.cards, stage.code).keywords).some((value) => value === true || typeof value === "number");
}

// The current quest card has this keyword, printed (Hall of Beorn's keywords) or gained from an effect (a flag on the card):
// Battle and Siege change what the committed characters count (hon.battle, hon.siege; quest.ts questStatOf).
export function currentQuestHas(state: ScenarioState, keyword: "battle" | "siege", cards: ReduceContext["cards"]): boolean {
  const stage = state.questStage ? state.cards[state.questStage] : undefined;
  if (!stage) return false;
  return printedOf(cards, stage.code).keywords[keyword] || flagged(state, stage.id, keyword);
}
