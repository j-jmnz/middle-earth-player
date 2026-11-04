// One walker over a record's instructions for the words tests: every instruction, nested ones too (`instructions` of Each,
// If, ...) and every branch of a Choose, each with the instruction that follows it in its list and the ones after that.
import type { Instruction } from "../../src/catalog/boundary.ts";

export function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined, after: readonly Instruction[]) => void): void {
  instructions.forEach((instruction, index) => {
    visit(instruction, instructions[index + 1], instructions.slice(index + 2));
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit);
  });
}

// The instructions that ask a player for a card: the sheet words them with pickWords (src/play/choice/sheets.ts).
export const ASKING_VERBS: ReadonlySet<string> = new Set(["Pick", "SearchMove", "AttachSelf", "ReturnToStaging", "DiscardFromHand", "DiscardAlliesForWillpower"]);
