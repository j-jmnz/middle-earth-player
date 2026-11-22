// Rules: rr.triggered-ability, rr.damage (data/rules/entries.json).
// The idle check of DamageEach (src/rules/player/potential.ts, Whether an ability could change the game): it changes nothing when no card matches its pick, when no
// enemy is engaged with a player it names, or when the amount is 0.
import type { IdleHook } from "../../interpret/family-manifest.ts";
import { amountIdle, candidatesOf } from "../../player/idle-reads.ts";

export const questIdle: IdleHook = (state, instruction, sourceId, frame, ctx) => {
  if (instruction.verb !== "DamageEach") return null;
  // A damage to every card of a pick changes nothing when no card matches.
  if (instruction.pick != null && instruction.engagedWith == null && candidatesOf(state, instruction.pick, sourceId, frame, ctx, { counting: true, dependent: true }).length === 0) return true;
  // "Each enemy engaged with that player" of each chosen player with no enemy engaged.
  if (instruction.engagedWith === "picked" && frame.picked != null && frame.picked.every((id) => id.startsWith("seat:") && (state.seats[Number(id.slice(5))]?.engaged.length ?? 0) === 0)) return true;
  return amountIdle(state, instruction.amount, frame, ctx);
};
