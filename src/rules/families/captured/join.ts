// Rules: mec108.joining-another-player, mec108.create-staging-area, mec109.multiple-staging-areas (data/rules/entries.json); ledger lines 10039:B:2, 10040:A:1.
//
// Joining. A player whose own stage has nothing captured underneath it joins another player at the beginning of the travel phase: its staging cards move to that player's area (enemies engaged with it stay engaged), its active location is discarded, its stage leaves play (set aside),
// and the player shares the joined player's staging area and stage from then on (`Seat.joined`; families/breaking/areas.ts resolves the seat to the area's head). When no other area exists every player advances together to the next stage and the one shared staging area is back.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { releaseAttachments } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard, withSeat } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";
import type { Restriction } from "../../interpret/restrictions.ts";
import { effectsOf } from "../../windows/listen.ts";
import { noteHostDefeated } from "../attachments/hold.ts";
import { areaSeats, stageSeat } from "../breaking/areas.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// The area the seat joins: the next player clockwise who has an area of their own; null when there is none.
function joinTarget(state: ScenarioState, seat: number): number | null {
  const others = areaSeats(state).filter((index) => index !== seat);
  return others.sort((left, right) => ((left - seat + state.seatCount) % state.seatCount) - ((right - seat + state.seatCount) % state.seatCount))[0] ?? null;
}

// The seat leaves its own area for the target's.
function join(state: ScenarioState, seat: number, target: number): ScenarioState {
  const owner = state.seats[seat];
  if (!owner) return state;
  let next = state;
  for (const id of owner.staging) next = moveCard(next, id, { zone: "staging", area: target });
  if (owner.active) next = updateCard(moveCard(next, owner.active, { zone: "encounterDiscard" }), owner.active, { face: "up", controller: null });
  if (owner.stage) next = moveCard(next, owner.stage, { zone: "setAside" });
  const left = next.seats[seat];
  if (!left) return next;
  const { stage: _stage, active: _active, ...rest } = left;
  return withSeat(next, seat, { ...rest, staging: [], joined: target });
}

// Every player advances together: each area's stage is defeated and the staging areas are the one shared area again; the next stage (the first card of the quest deck with the code) is the one shared stage, side B up, and its When Revealed effects are pushed.
function advanceTogether(state: ScenarioState, code: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const nextId = state.questDeck.find((id) => state.cards[id]?.code === code);
  if (!nextId) return state;
  const before = steps.length;
  let next = state;
  for (const seat of areaSeats(state)) {
    const owner = state.seats[seat];
    if (!owner) continue;
    // Each area's active location returns to the staging area, with the cards of the area, which `staging` already lists.
    if (owner.active) next = moveCard(next, owner.active, { zone: "staging" });
    if (owner.stage) next = moveCard(releaseAttachments(noteHostDefeated(next, owner.stage), owner.stage, ctx.cards, steps), owner.stage, { zone: "setAside" });
  }
  const seats: [typeof next.seats[0], typeof next.seats[1]] = [next.seats[0], next.seats[1]];
  for (const index of [0, 1] as const) {
    const { stage: _stage, active: _active, joined: _joined, ...rest } = seats[index];
    seats[index] = { ...rest, staging: [] };
  }
  const { separate: _separate, travelDone: _travel, ...plain } = next;
  const shared: ScenarioState = { ...plain, seats, activeLocation: null, secondActiveLocation: null };
  const placed = updateCard(moveCard(shared, nextId, { zone: "questStage" }), nextId, { face: "B" });
  steps.push({ kind: "advance", cardId: nextId });
  return afterProgress(placed, before, ctx, steps);
}

// JoinAnotherPlayer: see the schema entry. Runs on the whole state; the seat is the one whose stage the source is.
export function joinAnotherPlayer(state: ScenarioState, instruction: Verb<"JoinAnotherPlayer">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!state.separate) return state;
  const seat = (focus.sourceId ? stageSeat(state, focus.sourceId) : null) ?? focus.seat;
  const target = joinTarget(state, seat);
  return target == null ? advanceTogether(state, instruction.advanceTo, ctx, steps) : join(state, seat, target);
}

// The stages in play whose Forced effect joins another player with `holdsStage` (04114:B:2): they do not advance by the ordinary rule, so the quest holds them as a "cannot advance" does.
export function joiningStages(state: ScenarioState, ctx: Pick<ReduceContext, "effects">): Restriction[] {
  const held: Restriction[] = [];
  for (const card of Object.values(state.cards)) {
    if (card.zone !== "questStage") continue;
    if (effectsOf(ctx, card.code).some((effect) => effect.timing === "forced" && effect.instructions.some((instruction) => instruction.verb === "JoinAnotherPlayer" && instruction.holdsStage === true))) held.push({ sourceId: card.id, what: "advance" });
  }
  return held;
}
