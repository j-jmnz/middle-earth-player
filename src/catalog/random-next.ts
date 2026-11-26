// The stage's own random set: the stages `AdvanceToRandomStage` lists (wilderland family), as the quest reads them (`stages[i].randomNext`). A record with `stageSet` is the stage's defeat set; one without it ("advance to a different stage 2A", 08095:B:2) runs the same set once, as an argument to the advance.
import type { Instruction } from "./boundary.ts";

export type RandomNext = { codes: string[]; otherwise?: string; remove?: true; different?: true };

export function randomNextOf(instruction: Extract<Instruction, { verb: "AdvanceToRandomStage" }>): RandomNext {
  return { codes: instruction.codes, ...(instruction.otherwise != null ? { otherwise: instruction.otherwise } : {}), ...(instruction.remove ? { remove: true as const } : {}), ...(instruction.different ? { different: true as const } : {}) };
}
