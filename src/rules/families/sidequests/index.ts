import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { eliminateSeat } from "../../core/eliminate.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { flipCard } from "./contract.ts";
import { attachLoot, buildLootDeck } from "./loot.ts";
import { shuffleSetAside, takeRevealed } from "./encounter.ts";
import type { Focus } from "../index.ts";

// Rules: rr.player-elimination (data/rules/entries.json).
// The verbs src/catalog/families/sidequests.ts adds, for player side quests, contracts, encounter-keyword player cards and the victory display. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  void ctx;
  switch (instruction.verb) {
    case "EliminatePlayer":
      // "A player is eliminated from the game if ... a card effect forces their elimination" (rr.player-elimination).
      return eliminateSeat(state, focus.seat, steps);
    // "Setup: Attach to a hero in play." run by the Setup search (setup/search.ts), where nobody can be asked: the card found in a
    // player's deck goes on the first hero of that player that has no copy of it (effect frames attach an encounter card themselves).
    case "AttachSelf":
      return instruction.to.kind === "hero" ? attachSetupCard(state, focus) : null;
    case "ShuffleSetAsideIntoEncounterDeck":
      return shuffleSetAside(state, instruction, focus);
    case "FlipCard":
      return flipCard(state, focus.sourceId);
    case "BuildLootDeck":
      return buildLootDeck(state, instruction, focus, steps);
    case "AttachLoot":
      return attachLoot(state, focus);
    case "TakeRevealedCard":
      return takeRevealed(state, instruction, focus);
    case "RemoveFromCampaignPool": {
      const card = focus.sourceId ? state.cards[focus.sourceId] : undefined;
      return card ? { ...state, removedFromPool: [...(state.removedFromPool ?? []), { code: card.code, seat: card.controller ?? card.owner ?? focus.seat }] } : state;
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

export const manifest: RulesFamily = { name: "sidequests", verbs: ["EliminatePlayer", "AttachSelf", "ShuffleSetAsideIntoEncounterDeck", "FlipCard", "BuildLootDeck", "AttachLoot", "TakeRevealedCard", "RemoveFromCampaignPool"], run };
