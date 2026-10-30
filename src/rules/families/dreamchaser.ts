// Rules: dcce.gaining-xp, dcce.hard-expert (data/rules/entries.json).
import type { Instruction } from "../../catalog/boundary.ts";
import type { XpCount } from "../../catalog/families/dreamchaser.ts";

import { livingSeats, type ScenarioState } from "../state.ts";
import { tokensOn } from "./campaign.ts";

// The verbs src/catalog/families/dreamchaser.ts adds. GainXp is a Resolution verb: rules/resolution.ts runs it (xpOf below), so it changes
// nothing here.
export function run(state: ScenarioState, instruction: Instruction): ScenarioState | null {
  return instruction.verb === "GainXp" ? state : null;
}

function countOf(state: ScenarioState, each: XpCount): number {
  if (each.kind === "survivingPlayer") return livingSeats(state).length;
  if (each.kind === "tokens") return tokensOn(state, each.code);
  return state.victory.filter((id) => each.codes.includes(state.cards[id]?.code ?? "")).length;
}

// The XP one GainXp line is worth in this game: its amount once, or for each of what it counts, never past `max` (a line that takes XP away,
// "-1 XP", has a negative amount; `max` caps what it can give).
export function xpOf(state: ScenarioState, instruction: Extract<Instruction, { verb: "GainXp" }>): number {
  const total = instruction.amount * (instruction.each ? countOf(state, instruction.each) : 1);
  return instruction.max != null ? Math.min(total, instruction.max) : total;
}
