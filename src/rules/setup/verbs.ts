import type { Instruction } from "../../catalog/boundary.ts";

import type { ReduceContext } from "../interpret/interpret.ts";
import { printedOf } from "../core/printed.ts";
import { updateCard, type ScenarioState } from "../core/state.ts";
import { attachTo, moveCard, spawn, type Destination } from "../core/zones.ts";

export type SetupInstruction = Extract<
  Instruction,
  { verb: "AddToStaging" | "MakeActiveLocation" | "SetAside" | "AttachToRingBearer" }
>;

// Quest-card setup puts out-of-deck cards where the booklet says. None of these reveals a card:
// no Hide test, no When Revealed, no surge. A card's own Setup line, run for the copy the Setup search found in a deck
// (mec109.setup: "Add Gandalf's Delay to the staging area" on a pool card shuffled into the encounter deck), places that
// copy: `sourceId` is the found card, set aside while its Setup resolves, and no second copy is made.
export function runSetupVerb(state: ScenarioState, instruction: SetupInstruction, ctx: ReduceContext, sourceId: string | null = null): ScenarioState {
  const found = sourceId ? state.cards[sourceId] : undefined;
  const own = found != null && found.zone === "setAside" && found.code === instruction.code ? found.id : null;
  const place = (dest: Destination, face?: "down"): ScenarioState => (own ? updateCard(moveCard(state, own, dest), own, { face: "up" }) : spawn(state, instruction.code, dest, face).state);
  switch (instruction.verb) {
    case "AddToStaging":
      return place({ zone: "staging" });
    case "MakeActiveLocation":
      return place({ zone: "activeLocation" });
    case "SetAside":
      return own ? state : spawn(state, instruction.code, { zone: "setAside" }, "down").state;
    case "AttachToRingBearer":
      return attachToRingBearer(state, instruction.code, ctx, own);
  }
}

// The first player's hero is searched first, then the other seats in order.
function ringBearer(state: ScenarioState, ctx: ReduceContext): string | null {
  const order = [state.firstPlayer, ...state.seats.map((_, index) => index).filter((index) => index !== state.firstPlayer)];
  for (const seatIndex of order) {
    for (const id of state.seats[seatIndex]?.heroes ?? []) {
      const code = state.cards[id]?.code;
      if (code && printedOf(ctx.cards, code).traits.includes("Ring-bearer")) return id;
    }
  }
  return null;
}

function attachToRingBearer(state: ScenarioState, code: string, ctx: ReduceContext, own: string | null): ScenarioState {
  const hostId = ringBearer(state, ctx);
  const host = hostId ? state.cards[hostId] : undefined;
  if (!hostId || !host || host.controller == null) {
    return { ...state, failure: `No Ring-bearer hero to attach ${code} to` };
  }
  if (own) return attachTo(moveCard(state, own, { zone: "play", seat: host.controller }), own, hostId);
  const spawned = spawn(state, code, { zone: "play", seat: host.controller });
  return attachTo(spawned.state, spawned.id, hostId);
}
