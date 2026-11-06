// Rules: emce.treasure (data/rules/entries.json); ledger line 18025:A:2. What a Choose branch of the Wilderland scenarios warns before the second tap: the allies a damage branch would destroy.
import type { Instruction } from "../../catalog/boundary.ts";
import { pickCandidates } from "../../rules/interpret/pick.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { damageOutcome, discardLoss } from "../store/foresight.ts";
import { framsburgBranchCaution } from "../words/framsburg.ts";

/** "Tap again: Beorn is destroyed" for a branch that deals damage to each card its filter finds, when that destroys one; null otherwise. The game is lost when the card's leaving loses it (damageOutcome). Deadly Cold (19021:A:1) deals its damage to the one character `picked`. */
export function branchCaution(game: ScenarioState, ctx: ReduceContext, choose: Extract<Instruction, { verb: "Choose" }>, optionId: string, seat: number, sourceId: string | null, name: (id: string) => string, picked: string | null = null): string | null {
  const threat = framsburgBranchCaution(choose, optionId, game, seat);
  if (threat) return threat;
  const instructions = choose.options.find((option) => option.id === optionId)?.instructions ?? [];
  const hurt = instructions.find((instruction) => instruction.verb === "DamageCard");
  if (hurt?.verb === "DamageCard" && hurt.target === "picked" && typeof hurt.amount === "number" && picked != null) {
    const outcome = damageOutcome(game, ctx, picked, hurt.amount);
    return outcome.loss ? `Tap again: ${name(picked)} falls and the game is lost` : outcome.destroyed ? `Tap again: ${name(picked)} is destroyed` : null;
  }
  const step = instructions.find((instruction) => instruction.verb === "DamageEach");
  if (step?.verb !== "DamageEach" || typeof step.amount !== "number" || !step.pick || step.pick.control !== "you") return null;
  const outcomes = pickCandidates(game, step.pick, seat, [], sourceId, ctx).map((id) => ({ id, outcome: damageOutcome(game, ctx, id, step.amount as number) }));
  const lost = outcomes.find((entry) => entry.outcome.loss);
  if (lost) return `Tap again: ${name(lost.id)} falls and the game is lost`;
  const gone = outcomes.filter((entry) => entry.outcome.destroyed).map((entry) => name(entry.id));
  if (gone.length === 0) return null;
  return `Tap again: ${gone.length === 1 ? `${gone[0]} is` : `${gone.slice(0, -1).join(", ")} and ${gone.at(-1)} are`} destroyed`;
}

/** Eyes in the Dark (18057:A:2): "Tap again: Aragorn is discarded" on the row of a questing hero the player may discard, "... is discarded and the game is lost" when his leaving play loses it (damageOutcome's reading of the engine); undefined for a pick of any other card and for an ally. */
export function discardCaution(game: ScenarioState, ctx: ReduceContext, source: string | null, pick: Instruction, next: Instruction | undefined, id: string, name: (id: string) => string): string | undefined {
  if (source == null || game.cards[source]?.code !== "18057" || pick.verb !== "Pick" || next?.verb !== "Discard") return undefined;
  if (game.cards[id]?.zone !== "heroes") return undefined;
  return discardLoss(game, ctx, id) ? `Tap again: ${name(id)} is discarded and the game is lost` : `Tap again: ${name(id)} is discarded`;
}
