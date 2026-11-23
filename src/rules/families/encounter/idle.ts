// Rules: rr.triggered-ability, rr.cost (data/rules/entries.json).
// The idle check of the encounter family's verbs (src/rules/player/potential.ts, Whether an ability could change the game): MoveEncounterCard of the top card of the encounter discard
// pile changes nothing when that pile is empty.
import type { IdleHook } from "../../interpret/family-manifest.ts";

export const encounterIdle: IdleHook = (state, instruction) => {
  if (instruction.verb !== "MoveEncounterCard") return null;
  if (instruction.card === "discardTop") return state.encounterDiscard.length === 0;
  return false;
};
