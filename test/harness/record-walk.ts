// One walker over a record's instructions for the words tests: every instruction, nested ones too (`instructions` of Each,
// If, ...) and every branch of a Choose, each with the instruction that follows it in its list and the ones after that.
import type { Instruction } from "../../src/catalog/boundary.ts";

// `path` is where the instruction stands in the record: its index, with the index of each parent in front ("2.0" is the first instruction nested in the third),
// and the option id for a branch of a Choose ("1.trade.0").
export function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined, after: readonly Instruction[], path: string) => void, prefix = ""): void {
  instructions.forEach((instruction, index) => {
    const path = `${prefix}${index}`;
    visit(instruction, instructions[index + 1], instructions.slice(index + 2), path);
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit, `${path}.`);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit, `${path}.${option.id}.`);
  });
}

// The instructions that ask a player for a card: the sheet words them with pickWords (src/play/choice/sheets.ts).
export const ASKING_VERBS: ReadonlySet<string> = new Set(["Pick", "SearchMove", "AttachSelf", "ReturnToStaging", "DiscardFromHand", "DiscardAlliesForWillpower"]);
