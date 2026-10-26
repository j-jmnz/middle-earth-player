import type { Instruction } from "../../catalog/boundary.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";
import { livingSeats, withSeat } from "../state.ts";
import { attachTo, moveCard } from "../zones.ts";
import { flipCard } from "./sidequests-contract.ts";
import { shuffleSetAside, takeRevealed } from "./sidequests-encounter.ts";
import type { Focus } from "./index.ts";

// Rules: rr.player-elimination (data/rules/entries.json).
// The verbs src/catalog/families/sidequests.ts adds, for player side quests, contracts, encounter-keyword player cards and the victory display. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  void ctx;
  switch (instruction.verb) {
    case "EliminatePlayer":
      return eliminate(state, focus.seat, steps);
    // "Setup: Attach to a hero in play." run by the Setup search (setup-search.ts), where nobody can be asked: the card found in a
    // player's deck goes on the first hero of that player that has no copy of it (effect frames attach an encounter card themselves).
    case "AttachSelf":
      return instruction.to.kind === "hero" ? attachSetupCard(state, focus) : null;
    case "ShuffleSetAsideIntoEncounterDeck":
      return shuffleSetAside(state, instruction, focus);
    case "FlipCard":
      return flipCard(state, focus.sourceId);
    case "TakeRevealedCard":
      return takeRevealed(state, instruction, focus);
    case "RemoveFromCampaignPool": {
      const code = focus.sourceId ? state.cards[focus.sourceId]?.code : undefined;
      return code ? { ...state, removedFromPool: [...(state.removedFromPool ?? []), code] } : state;
    }
    default:
      return null;
  }
}

function attachSetupCard(state: ScenarioState, focus: Focus): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!source || source.zone !== "setAside") return state;
  const host = (state.seats[focus.seat]?.heroes ?? []).find((id) => !(state.cards[id]?.attachments ?? []).some((other) => state.cards[other]?.code === source.code));
  if (!host) return state;
  return attachTo(moveCard(state, source.id, { zone: "play", seat: focus.seat }), source.id, host);
}

// "A player is eliminated from the game if ... a card effect forces their elimination" (rr.player-elimination): the seat leaves
// the game, and settle puts its cards in their owners' discard piles and returns its enemies to the staging area (clearEliminated).
// With no player left, the game is lost.
function eliminate(state: ScenarioState, seatIndex: number, steps: EngineStep[]): ScenarioState {
  const seat = state.seats[seatIndex];
  if (!seat || seat.eliminated) return state;
  steps.push({ kind: "eliminate", seat: seatIndex });
  const next = withSeat(state, seatIndex, { ...seat, eliminated: true });
  return livingSeats(next).length === 0 && !next.lost ? { ...next, lost: true, lossReason: "No seats remain" } : next;
}
