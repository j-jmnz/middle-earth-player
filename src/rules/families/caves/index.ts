// Rules: rr.encounter-deck, rr.reveal, rr.removed-from-game, rr.setup (data/rules/entries.json); ledger lines 41006:A:1, 41034:A:2, 41048:A:2, 41049:A:2.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../intents.ts";
import type { ReduceContext } from "../../interpret.ts";
import { lastPicked } from "../../player-verbs.ts";
import type { ScenarioState } from "../../state.ts";
import { inPlay, moveCard } from "../../zones.ts";
import { updateCard } from "../../state.ts";
import type { Focus } from "../index.ts";
import { lookedOnTop } from "../encounter/items.ts";
import { leavePlay } from "../encounter/moves.ts";

// The verbs src/catalog/families/caves.ts adds. The progress rules of the quest card (families/caves/progress.ts), the engagement cost 0 and the
// damage flags are read where they apply (rules/keywords.ts, rules/quest.ts); only the verbs run here. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "BottomOtherLooked":
      return bottomOtherLooked(state);
    case "RemoveSourceFromGame":
      return focus.sourceId && state.cards[focus.sourceId] ? moveCard(state, focus.sourceId, { zone: "removed" }) : state;
    case "SetAsideInPlay":
      return setAsideInPlay(state, instruction.code, ctx, steps);
    default:
      return null;
  }
}

// The looked-at cards still on top, but the picked one, go to the bottom of the encounter deck in their order. The picked card is then on top.
function bottomOtherLooked(state: ScenarioState): ScenarioState {
  const picked = lastPicked(state);
  const others = lookedOnTop(state).filter((id) => id !== picked);
  if (others.length === 0) return state;
  return { ...state, encounterDeck: [...state.encounterDeck.filter((id) => !others.includes(id)), ...others] };
}

// The card with this code in play goes out of play, set aside facedown, as the Setup puts out the cards it names.
function setAsideInPlay(state: ScenarioState, code: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = Object.values(state.cards).find((entry) => entry.code === code && inPlay(entry.zone));
  if (!card) return state;
  return updateCard(moveCard(leavePlay(state, card.id, ctx, steps), card.id, { zone: "setAside" }), card.id, { face: "down", controller: null });
}
