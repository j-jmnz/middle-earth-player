// Rules: rr.explored, rr.active-location, rr.staging (data/rules/entries.json); ledger line 901402:B:2. A location that holds `exploredWhenFull` (Goblin Gate under Ambush in the Night, whose quest points grow with the enemies engaged) is explored as soon as its progress
// equals its quest points as they stand, whatever changed them: an enemy that leaves its engagement lowers the quest points under the progress already there. Only a game with a card that sets the flag looks.
import type { EngineStep } from "../../core/intents.ts";
import { syncConstants } from "../../interpret/constants.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { destroyCard } from "../../core/keywords.ts";
import { inPlay, modifierActive, type ScenarioState } from "../../core/state.ts";
import { questPointsOf } from "../../quest/quest.ts";

/** The settle sweep: each location in play holding `exploredWhenFull` whose progress has reached its quest points is explored (it leaves play with the explored mark, as a full location does when progress is placed). */
export function exploreFull(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.lost || state.failure || !state.modifiers.some((modifier) => modifier.stat === "exploredWhenFull" && modifierActive(state, modifier))) return state;
  // The quest points are read with the constants as they are now.
  const synced = syncConstants(state, ctx);
  if (synced !== state) return synced;
  let next = state;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== "exploredWhenFull" || !modifierActive(state, modifier)) continue;
    const card = next.cards[modifier.instanceId];
    if (!card || !inPlay(card.zone) || card.progress <= 0) continue;
    const points = questPointsOf(next, card, ctx.cards);
    if (points != null && card.progress >= points) next = destroyCard(next, card.id, ctx.cards, steps, true);
  }
  return next;
}
