import type { Instruction } from "../catalog/boundary.ts";

import type { ReduceContext } from "./interpret.ts";
import { printedOf } from "./printed.ts";
import { updateCard, type ScenarioState } from "./state.ts";
import { spawn } from "./zones.ts";

export type SetupInstruction = Extract<
  Instruction,
  { verb: "AddToStaging" | "MakeActiveLocation" | "SetAside" | "AttachToRingBearer" }
>;

// Quest-card setup puts out-of-deck cards where the booklet says. None of these reveals a card:
// no Hide test, no When Revealed, no surge.
export function runSetupVerb(state: ScenarioState, instruction: SetupInstruction, ctx: ReduceContext): ScenarioState {
  switch (instruction.verb) {
    case "AddToStaging":
      return spawn(state, instruction.code, { zone: "staging" }).state;
    case "MakeActiveLocation":
      return spawn(state, instruction.code, { zone: "activeLocation" }).state;
    case "SetAside":
      return spawn(state, instruction.code, { zone: "setAside" }, "down").state;
    case "AttachToRingBearer":
      return attachToRingBearer(state, instruction.code, ctx);
  }
}

// The first player's hero is searched first, then the other seats in order.
export function ringBearer(state: ScenarioState, ctx: ReduceContext): string | null {
  const order = [state.firstPlayer, ...state.seats.map((_, index) => index).filter((index) => index !== state.firstPlayer)];
  for (const seatIndex of order) {
    for (const id of state.seats[seatIndex]?.heroes ?? []) {
      const code = state.cards[id]?.code;
      if (code && printedOf(ctx.cards, code).traits.includes("Ring-bearer")) return id;
    }
  }
  return null;
}

function attachToRingBearer(state: ScenarioState, code: string, ctx: ReduceContext): ScenarioState {
  const hostId = ringBearer(state, ctx);
  const host = hostId ? state.cards[hostId] : undefined;
  if (!hostId || !host || host.controller == null) {
    return { ...state, failure: `No Ring-bearer hero to attach ${code} to` };
  }
  const spawned = spawn(state, code, { zone: "play", seat: host.controller });
  const attached = updateCard(spawned.state, spawned.id, { host: hostId });
  return updateCard(attached, hostId, { attachments: [...host.attachments, spawned.id] });
}
