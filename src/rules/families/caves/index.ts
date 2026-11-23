// Rules: rr.encounter-deck, rr.reveal, rr.removed-from-game, rr.setup (data/rules/entries.json); ledger lines 41006:A:1, 41034:A:2, 41048:A:2, 41049:A:2.
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, moveCard } from "../../core/zones.ts";
import { updateCard } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { moveOtherLooked } from "../encounter/items.ts";
import { leavePlay } from "../encounter/moves.ts";

// The verbs src/catalog/families/caves.ts adds. The progress rules of the quest card (families/caves/progress.ts), the engagement cost 0 and the
// damage flags are read where they apply (rules/core/keywords.ts, rules/quest/quest.ts); only the verbs run here. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "BottomOtherLooked":
      return moveOtherLooked(state, "bottom");
    case "RemoveSourceFromGame":
      return focus.sourceId && state.cards[focus.sourceId] ? moveCard(state, focus.sourceId, { zone: "removed" }) : state;
    case "SetAsideInPlay":
      return setAsideInPlay(state, instruction, ctx, steps);
    default:
      return null;
  }
}

// The card with this code in play goes out of play, set aside facedown, as the Setup puts out the cards it names. With `keepDamage` the damage stays on it
// ("Do not remove damage tokens from it", Cold-Drake 19024:A:1); its attachments are discarded and its other tokens go either way.
export function setAsideInPlay(state: ScenarioState, instruction: Extract<Instruction, { verb: "SetAsideInPlay" }>, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = Object.values(state.cards).find((entry) => entry.code === instruction.code && inPlay(entry.zone));
  if (!card) return state;
  const away = updateCard(moveCard(leavePlay(state, card.id, ctx, steps), card.id, { zone: "setAside" }, instruction.byQuest === true ? { supersedes: true } : {}), card.id, { face: "down", controller: null });
  return instruction.keepDamage === true ? updateCard(away, card.id, { damage: card.damage, keepsDamage: true }) : away;
}

export const manifest: RulesFamily = { name: "caves", verbs: ["BottomOtherLooked", "RemoveSourceFromGame", "SetAsideInPlay"], run };
