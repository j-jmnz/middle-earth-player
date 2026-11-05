// Rules: emce.treasure (data/rules/entries.json); ledger line 18025:A:2. What a Choose branch of the Wilderland scenarios warns before the second tap: the allies a damage branch would destroy.
import type { Instruction } from "../../catalog/boundary.ts";
import { pickCandidates } from "../../rules/interpret/pick.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { damageOutcome } from "../store/foresight.ts";

/** "Tap again: Beorn is destroyed" for a branch that deals damage to each card its filter finds, when that destroys one; null otherwise. The game is lost when the card's leaving loses it (damageOutcome). */
export function branchCaution(game: ScenarioState, ctx: ReduceContext, choose: Extract<Instruction, { verb: "Choose" }>, optionId: string, seat: number, sourceId: string | null, name: (id: string) => string): string | null {
  const step = choose.options.find((option) => option.id === optionId)?.instructions.find((instruction) => instruction.verb === "DamageEach");
  if (step?.verb !== "DamageEach" || typeof step.amount !== "number" || !step.pick || step.pick.control !== "you") return null;
  const outcomes = pickCandidates(game, step.pick, seat, [], sourceId, ctx).map((id) => ({ id, outcome: damageOutcome(game, ctx, id, step.amount as number) }));
  const lost = outcomes.find((entry) => entry.outcome.loss);
  if (lost) return `Tap again: ${name(lost.id)} falls and the game is lost`;
  const gone = outcomes.filter((entry) => entry.outcome.destroyed).map((entry) => name(entry.id));
  if (gone.length === 0) return null;
  return `Tap again: ${gone.length === 1 ? `${gone[0]} is` : `${gone.slice(0, -1).join(", ")} and ${gone.at(-1)} are`} destroyed`;
}
