// Rules: mec109.burden-deck, rr.burdens, rr.reveal, rr.staging, rr.encounter-deck (data/rules/entries.json).
//
// The burden deck (Flight to the Ford): five burden cards shuffled into a deck beside the quest deck. A card of it is revealed as
// if it came from the encounter deck, or goes into the encounter deck; a burden that is discarded goes to the encounter discard
// pile (a revealed treachery does, once its staging is done). Burdens in the encounter deck and its discard pile are earned
// when the scenario is won (EarnAllBurdens, src/rules/resolution.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import { hasTrait } from "../../conditions.ts";
import { startReveal } from "../../frames.ts";
import type { EngineStep } from "../../intents.ts";
import type { ReduceContext } from "../../interpret.ts";
import { shuffleIds } from "../../seed.ts";
import type { ScenarioState } from "../../state.ts";
import { livingSeats, updateCard } from "../../state.ts";
import { attachTo, moveCard } from "../../zones.ts";
import type { Focus } from "../index.ts";
import { moveEncounter } from "../encounter/moves.ts";

// Setup: the burden deck is shuffled.
export function shuffleBurdenDeck(state: ScenarioState): ScenarioState {
  if (!state.burdenDeck || state.burdenDeck.length < 2) return state;
  const shuffled = shuffleIds(state.burdenDeck, state.seed, state.seedCursor);
  return { ...state, burdenDeck: shuffled.ids, seedCursor: shuffled.cursor };
}

// The top card of the burden deck, or null when it is empty.
export function topBurden(state: ScenarioState): string | null {
  return state.burdenDeck?.[0] ?? null;
}

// The actor reveals the top card of the burden deck as if it came from the encounter deck. The reveal is a frame of its own, so
// the effect that asked for it goes on once the card is resolved.
export function revealBurden(state: ScenarioState, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const top = topBurden(state);
  if (!top || state.seats[seat]?.eliminated) return state;
  return startReveal(state, seat, ctx, steps, top);
}

// The top card of the burden deck goes into the encounter deck, shuffled in or on top.
export function moveBurden(state: ScenarioState, to: Extract<Instruction, { verb: "MoveBurden" }>["to"], seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const top = topBurden(state);
  if (!top) return state;
  return moveEncounter(state, top, to === "encounterTop" ? "deckTop" : "shuffle", seat, ctx, steps);
}

// The Ring-bearer: the hero with the Ring-bearer trait, the first player's first (the one The One Ring is attached to at Setup).
export function ringBearerId(state: ScenarioState, ctx: ReduceContext): string | null {
  for (const seat of livingSeats(state)) {
    for (const id of state.seats[seat]?.heroes ?? []) if (hasTrait(state, id, "Ring-bearer", ctx)) return id;
  }
  return null;
}

// "Attach to the Ring-bearer": the source card leaves the staging area and goes on the Ring-bearer, face up.
export function attachSelfToRingBearer(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const hostId = ringBearerId(state, ctx);
  if (!focus.sourceId || !state.cards[focus.sourceId] || !hostId) return state;
  const attached = attachTo(moveCard(state, focus.sourceId, { zone: "attached" }), focus.sourceId, hostId);
  return updateCard(attached, focus.sourceId, { face: "up" });
}
