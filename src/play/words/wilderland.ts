// Rules: emce.treasure, rr.guarded (data/rules/entries.json); ledger lines 12168:A:1, 12189:B:2. What the table says when the players look at random undiscovered treasures and choose one to attach as a
// guarded objective (AttachRandomTreasure). The sentence the choice sheet reads from. Pure.
import type { Instruction } from "../../catalog/boundary.ts";

import type { ChoiceNames, PickWords } from "./choice.ts";

/** The sentence and the verb of the choice AttachRandomTreasure asks, or null for another instruction. */
export function wilderlandAsk(instruction: Instruction, source: string | null, names: ChoiceNames): PickWords | null {
  if (instruction.verb !== "AttachRandomTreasure") return null;
  const host = source ? names.card(source) : "The card";
  return { verb: "Attach", prompt: `${host}: look at ${instruction.count ?? 3} random undiscovered treasures and choose 1 to attach to it as a guarded objective. The players claim it once it is free of encounters.` };
}

/** The label of an option of that choice: the treasure's title. Null for another instruction. */
export function wilderlandOptionLabel(instruction: Instruction, id: string, names: ChoiceNames): string | null {
  return instruction.verb === "AttachRandomTreasure" ? names.code(id) : null;
}
