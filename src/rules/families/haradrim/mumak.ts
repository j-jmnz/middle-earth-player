// Rules: hrd.immune-to-player-card-effects, rr.player-elimination, ltp.undefended-attack (data/rules/entries.json); ledger lines 17047:A:1, 17038:A:2, 17038:A:3. The Tamed Mûmak, an objective ally each player takes at Setup: the take, and the damage of an undefended attack
// that must be assigned to it. Its elimination of the controller is a record (`leftPlay`, EliminatePlayer).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { ask, chosenOf } from "./staged.ts";

/** TakeObjectiveAlly: the actor takes one of the set-aside objective allies with these codes into their play area, faceup and ready (the actor is asked when several different cards are left; copies of one card are one choice). It is an ally in play by its printed combat stats (an objective ally a player controls). */
export function takeObjectiveAlly(state: ScenarioState, instruction: Extract<Instruction, { verb: "TakeObjectiveAlly" }>, focus: Focus, steps: EngineStep[]): ScenarioState {
  const options = state.setAside.filter((id) => instruction.codes.includes(state.cards[id]?.code ?? ""));
  if (options.length === 0) return state;
  // Copies of one card are one choice: the first is taken without asking.
  const chosen = chosenOf(options, focus) ?? (new Set(options.map((id) => state.cards[id]?.code)).size === 1 ? options[0] : undefined);
  if (!chosen) return ask(state, instruction, focus.seat, options, steps);
  return updateCard(moveCard(state, chosen, { zone: "play", seat: focus.seat }), chosen, { face: "up", exhausted: false, committed: false });
}

/** The `combat.undefended` hook: the damage of an undefended attack against a seat goes to the Tamed Mûmak that seat controls while it holds `undefendedToMumak`, all of it, whatever its hit points left (it is then destroyed). None for another seat or attack. */
export function undefendedMumak(state: ScenarioState): readonly string[] {
  const seat = state.pendingAttack?.seat;
  if (seat == null || state.modifiers.length === 0) return [];
  const id = (state.seats[seat]?.play ?? []).find((card) => flagged(state, card, "undefendedToMumak"));
  return id ? [id] : [];
}
