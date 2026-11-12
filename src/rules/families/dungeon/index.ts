// Rules: rr.engaged, rr.attachment-cards, rr.drawing-cards, rr.shadow-effects (data/rules/entries.json).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { attachToDeck } from "./deck.ts";
import { placeOrcGuard } from "./guard.ts";

// The verbs src/catalog/families/dungeon.ts adds, for Escape from Dol Guldur: the Orc Guard, Iron Shackles, the limit on allies. Null
// when the verb is not one of them. LimitPlays is a constant the engine reads when a card is played (dungeon/limit.ts): run alone
// it does nothing.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PlaceOrcGuard":
      return placeOrcGuard(state, focus.seat, steps);
    case "AttachToDeck":
      return attachToDeck(state, focus);
    case "RaiseStagingThreat": {
      if (instruction.live === "alliesInDiscard") return { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: focus.sourceId ?? "table", stat: "moreStagingThreat", amount: 0, until: instruction.until, allyDiscardSeat: focus.seat }] };
      const amount = resolveAmount(state, instruction.amount ?? 0, frameScope(state, focus.seat, focus.sourceId), ctx);
      return amount > 0 ? { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: focus.sourceId ?? "table", stat: "moreStagingThreat", amount, until: instruction.until }] } : state;
    }
    case "TurnFaceUp": {
      const id = state.setAside.find((cardId) => state.cards[cardId]?.code === instruction.code);
      return id ? updateCard(state, id, { face: "up" }) : state;
    }
    case "LimitPlays":
      return state;
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "dungeon", verbs: ["PlaceOrcGuard", "AttachToDeck", "RaiseStagingThreat", "TurnFaceUp", "LimitPlays"], run };
