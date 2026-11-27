// The log line of the two steps that move a quest stage or a card's control without a card effect telling it: a stage that left the quest (set aside, or removed from the game) and control of a card passing with the first player token.
import type { EngineStep } from "../../rules/core/intents.ts";

/** The line of a `stageLeaves` or a `controlPasses` step; `name` gives a card's name. */
export function stageStepLine(step: Extract<EngineStep, { kind: "stageLeaves" | "controlPasses" }>, name: (cardId: string) => string): string {
  return step.kind === "stageLeaves" ? `${name(step.cardId)} ${step.how === "removed" ? "leaves the game" : "is set aside"}` : `${name(step.cardId)} passes to Player ${step.seat + 1} with the first player token`;
}
