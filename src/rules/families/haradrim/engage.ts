// Rules: rr.engaged, rr.first-player (data/rules/entries.json); ledger line 16061:A:3.
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
