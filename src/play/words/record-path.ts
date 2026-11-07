// Where an instruction stands in an effect record, the one path scheme the words allowlist (src/play/words/scenario-words.test.ts) and the asks files (src/play/words/asks.ts) key on.
import type { Instruction } from "../../catalog/boundary.ts";

/**
 * One walker over a record's instructions: every instruction, nested ones too (`instructions` of Each, If, ...) and every branch of a Choose, each with the instruction that follows it in its list and the ones after that.
 * `path` is where the instruction stands in the record: its index, with the index of each parent in front ("2.0" is the first instruction nested in the third), and the option id for a branch of a Choose ("1.trade.0").
 */
export function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined, after: readonly Instruction[], path: string) => void, prefix = ""): void {
  instructions.forEach((instruction, index) => {
    const path = `${prefix}${index}`;
    visit(instruction, instructions[index + 1], instructions.slice(index + 2), path);
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit, `${path}.`);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit, `${path}.${option.id}.`);
  });
}

/** The path of `wanted` in the record's instructions: the same object first, else one equal to it (the engine copies an instruction to fill in an enemy or a seat). Null when the record holds none. */
export function pathOf(instructions: readonly Instruction[], wanted: Instruction): string | null {
  let same: string | null = null;
  let equal: string | null = null;
  const text = JSON.stringify(wanted);
  walk(instructions, (instruction, _next, _after, path) => {
    if (same === null && instruction === wanted) same = path;
    else if (equal === null && JSON.stringify(instruction) === text) equal = path;
  });
  return same ?? equal;
}
