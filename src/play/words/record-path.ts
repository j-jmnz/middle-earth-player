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

/** How a record holds the instruction: 1 the same object, 2 one equal to it, 3 one whose every field the instruction repeats (the engine added `taken`, `kept`, `bottom`), 4 one whose fields the instruction repeats but for at most two the engine filled in. */
export type PathMatch = { rank: 1 | 2 | 3 | 4; path: string };

/**
 * Where the record holds `wanted`, and how closely. The engine asks with copies of an instruction it has filled in ({ ...instruction, taken } in families/sea/skirmisher.ts, `kept` and `bottom` in families/wilderland/heath.ts,
 * an enemy or a seat), so a copy is found by the fields it repeats: ranks 3 and 4 need one instruction of the verb that fits better than all the others, else the match is null (a guess would word another instruction).
 */
export function matchOf(instructions: readonly Instruction[], wanted: Instruction): PathMatch | null {
  let same: string | null = null;
  let equal: string | null = null;
  const text = JSON.stringify(wanted);
  const near: { path: string; kept: number; total: number }[] = [];
  const copy = wanted as Record<string, unknown>;
  walk(instructions, (instruction, _next, _after, path) => {
    if (same === null && instruction === wanted) same = path;
    else if (equal === null && JSON.stringify(instruction) === text) equal = path;
    else if (instruction.verb === wanted.verb) {
      const fields = Object.entries(instruction as Record<string, unknown>);
      near.push({ path, kept: fields.filter(([key, value]) => JSON.stringify(value) === JSON.stringify(copy[key])).length, total: fields.length });
    }
  });
  if (same !== null) return { rank: 1, path: same };
  if (equal !== null) return { rank: 2, path: equal };
  const subset = near.filter((item) => item.kept === item.total);
  if (subset.length > 0) return subset.length === 1 ? { rank: 3, path: subset[0]!.path } : null;
  const fits = near.filter((item) => item.total - item.kept <= 2);
  const best = Math.max(0, ...fits.map((item) => item.kept));
  const top = fits.filter((item) => item.kept === best);
  return top.length === 1 ? { rank: 4, path: top[0]!.path } : null;
}

/** The path of `wanted` in the record's instructions (matchOf), null when the record holds none. */
export function pathOf(instructions: readonly Instruction[], wanted: Instruction): string | null {
  return matchOf(instructions, wanted)?.path ?? null;
}
