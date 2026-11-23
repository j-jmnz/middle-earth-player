// Rules: hob.multiple-stages-in-play, hob.current-quest-stage, rr.quest-advancement, rr.reveal (data/rules/entries.json); ledger lines 132075:B:1, 132053:A:4, 132056:A:1, 132061:A:2, 132077:B:3.
// The verbs src/catalog/families/armies.ts adds: the stages of The Battle of Five Armies in play together (stages.ts), their joint advance (advance.ts, read by rules/quest/quest.ts advanceStage) and the reveal reads (reveal.ts).
import type { Amount, Condition, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { mostDamagedReason, mustDefendMostDamaged } from "./defender.ts";
import { noteFirstRevealed, stageTopmostFromDiscard } from "./reveal.ts";
import { putStagesIntoPlay, removeProgressFromStages, setCurrentStage, stageComplete, stageWithCode, stagesInPlay } from "./stages.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PutStagesIntoPlay":
      return putStagesIntoPlay(state, instruction, focus);
    case "SetCurrentStage":
      return setCurrentStage(state, instruction);
    case "RemoveProgressFromStages":
      return removeProgressFromStages(state, instruction, focus, ctx, steps);
    case "StageTopmostFromDiscard":
      return stageTopmostFromDiscard(state, instruction, focus, ctx, steps);
    case "MustDefendMostDamaged":
      return mustDefendMostDamaged(state);
    // A constant marker: the first card revealed each round is noted by the reveal hook below.
    case "FirstRevealedSurges":
      return state;
    default:
      return null;
  }
}

/** The conditions `stagesComplete` (every stage in play with these codes is full; none in play is not), `stageIsCurrent` and `stageNoProgress`; null for every other condition. */
function condition(state: ScenarioState, found: Condition, ctx: ReduceContext): boolean | null {
  if (found.kind === "stageIsCurrent") return state.questStage != null && state.cards[state.questStage]?.code === found.code;
  if (found.kind === "stageNoProgress") {
    const id = stageWithCode(state, found.code);
    return id != null && (state.cards[id]?.progress ?? 0) === 0;
  }
  if (found.kind !== "stagesComplete") return null;
  const all = found.codes.every((code) => {
    const id = stageWithCode(state, code);
    return id != null && stageComplete(state, id, ctx.cards);
  });
  return all === (found.is !== false);
}

/** The amount `stagesNoProgress`: the quest stages in play with no progress on them. */
function amount(state: ScenarioState, found: Exclude<Amount, number>): number | null {
  return found.stagesNoProgress ? stagesInPlay(state).filter((id) => (state.cards[id]?.progress ?? 0) === 0).length : null;
}

export const manifest: RulesFamily = {
  name: "armies",
  verbs: ["PutStagesIntoPlay", "SetCurrentStage", "RemoveProgressFromStages", "FirstRevealedSurges", "StageTopmostFromDiscard", "MustDefendMostDamaged"],
  run,
  condition: (state, found, _scope, ctx) => condition(state, found, ctx),
  amount: (state, found) => amount(state, found),
  revealed: noteFirstRevealed,
  combat: { defense: (state, _defender, cards, defenderId) => mostDamagedReason(state, defenderId, cards) },
};
