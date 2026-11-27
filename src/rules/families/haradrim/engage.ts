// Rules: rr.engaged, rr.first-player, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 16061:A:3, 17123:A:2.
//
// EngageSeatWithMost: "Uruk Chieftain engages the player engaged with the most non-unique Orc enemies". Each living player is counted for the enemies that match the filter and are engaged with them (the source never counts); the players with the most tie, and at 0 every
// living player ties. The first player chooses among tied players (a target choice of "seat:N", as EngageSeatWith in the nightmare family). A source already engaged with the chosen player stays as it is, with no new engagement; one engaged with another player moves to the chosen one.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { flagged, inPlay, livingSeats, type ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { matchesPick } from "../../interpret/pick.ts";
import { askTarget } from "../../windows/choices.ts";
import { engageEnemy, engageWith } from "../../quest/quest.ts";
import { attackNowFromStaging } from "../south/watcher.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { orcsOf } from "./orcs-zone.ts";
import { chosenOf } from "./staged.ts";

export function engageSeatWithMost(state: ScenarioState, instruction: Extract<Instruction, { verb: "EngageSeatWithMost" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = focus.sourceId;
  const enemy = id ? state.cards[id] : undefined;
  if (!id || !enemy || !inPlay(enemy.zone)) return state;
  // A card of the Orcs' area cannot leave it while the players are at another stage (hrd.orcs-area-different-stage), nor a member that holds `cannotLeaveOrcsArea` (17051:B:1).
  if (enemy.zone === "orcsArea" || (flagged(state, id, "cannotLeaveOrcsArea") && orcsOf(state)?.members.includes(id))) return state;
  const counts = livingSeats(state).map((seat) => ({ seat, count: (state.seats[seat]?.engaged ?? []).filter((other) => other !== id && matchesPick(state, other, instruction.pick, { seat, sourceId: id }, ctx)).length }));
  const most = Math.max(...counts.map((entry) => entry.count));
  const seats = counts.filter((entry) => entry.count === most).map((entry) => entry.seat);
  if (seats.length === 0) return state;
  const options = seats.map((seat) => `seat:${seat}`);
  const chosen = chosenOf(options, focus);
  if (!chosen) return effectData(state) ? askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options) : { ...state, failure: `${instruction.verb} needs a choice, and no effect is asking` };
  const seat = Number(chosen.slice("seat:".length));
  if (enemy.zone === "engaged" && enemy.controller === seat) return state;
  if (enemy.zone === "engaged") return flagged(state, id, "cannotBeEngaged") ? state : engageWith(state, seat, id, steps);
  return engageEnemy(state, seat, id, steps);
}

// "The player who controls the most allies": the living seats counted by the cards that match the pick and sit in their play area, the seats with the most tied (all tie at 0); the first player chooses among them. A string when the choice is asked.
function seatWithMost(state: ScenarioState, instruction: Extract<Instruction, { verb: "AttackSeatWithMost" }>, id: string, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): number | ScenarioState | null {
  const counts = livingSeats(state).map((seat) => ({ seat, count: (state.seats[seat]?.play ?? []).filter((other) => matchesPick(state, other, instruction.pick, { seat, sourceId: id }, ctx)).length }));
  const most = Math.max(...counts.map((entry) => entry.count));
  const options = counts.filter((entry) => entry.count === most).map((entry) => `seat:${entry.seat}`);
  if (options.length === 0) return null;
  const chosen = chosenOf(options, focus);
  if (chosen) return Number(chosen.slice("seat:".length));
  return effectData(state) ? askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options) : { ...state, failure: `${instruction.verb} needs a choice, and no effect is asking` };
}

/** AttackSeatWithMost: the source enemy, in the staging area, makes an immediate attack against the player who controls the most cards matching the pick (a shadow card is dealt; it does not engage). The first player chooses among players that tie. */
export function attackSeatWithMost(state: ScenarioState, instruction: Extract<Instruction, { verb: "AttackSeatWithMost" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = focus.sourceId;
  if (!id || state.cards[id]?.zone !== "staging") return state;
  const seat = seatWithMost(state, instruction, id, focus, ctx, steps);
  if (seat == null) return state;
  return typeof seat === "number" ? attackNowFromStaging(state, id, seat, ctx, steps, { shadow: true }) : seat;
}
