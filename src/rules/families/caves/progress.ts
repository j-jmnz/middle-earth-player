// Rules: rr.active-location, rr.quest-advancement, rr.lasting-effects (data/rules/entries.json); ledger lines 41035:A:1, 41039:A:1, 41027:A:1.
//
// What The Caves of Nibin-Dûm says about progress on the quest. `questProgressCap` (Collapsed Mine in the staging area) limits the progress that
// can be placed on the quest card each round, `noQuestProgress` (Lost in the Dark) stops it until the end of the phase: the active location still
// takes its progress first (rr.active-location), so only the share that would reach the quest card is held back. Both are flags the constant and
// lasting records hold on "table", read from the state alone. The progress placed on the quest this round is a `questProgressPlaced` modifier.
import type { Cause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, modifierActive, updateCard } from "../../core/state.ts";

// The stage number of the current quest card: its place in the quest deck, counting from 1 (0 with no quest card). It is the position in the quest definition's
// `stages`, not the number printed on the card: a quest whose stages come in another order (Voyage Across Belegaer's stage 2 cards) is counted by its definition.
export function stageNumber(state: ScenarioState): number {
  const stage = state.questStage ? state.cards[state.questStage] : undefined;
  return stage ? state.stages.findIndex((entry) => entry.code === stage.code) + 1 : 0;
}

// The smallest cap a card in play holds: two Collapsed Mines say "no more than 4" twice, not 8.
function cap(state: ScenarioState): number | null {
  const caps = state.modifiers.filter((modifier) => modifier.stat === "questProgressCap" && modifier.instanceId === "table" && modifierActive(state, modifier)).map((modifier) => modifier.amount);
  return caps.length > 0 ? Math.min(...caps) : null;
}

// How much more progress the quest card can take now; Number.MAX_SAFE_INTEGER when nothing limits it.
export function questRoom(state: ScenarioState): number {
  if (flagged(state, "table", "noQuestProgress")) return 0;
  const tally = questCapTally(state);
  return tally ? Math.max(0, tally.limit - tally.placed) : Number.MAX_SAFE_INTEGER;
}

// The progress placed on the quest card this round against the cap in force, for the table's readout (Shelob's Lair stage 2B); null when nothing caps it.
export function questCapTally(state: ScenarioState): { placed: number; limit: number } | null {
  const limit = cap(state);
  if (limit == null) return null;
  const placed = state.modifiers.filter((modifier) => modifier.stat === "questProgressPlaced" && modifier.instanceId === "table").reduce((sum, modifier) => sum + modifier.amount, 0);
  return { placed, limit };
}

// Notes progress placed on the quest card this round, for a cap.
export function noteQuestPlaced(state: ScenarioState, amount: number): ScenarioState {
  if (amount <= 0 || cap(state) == null) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: "table", stat: "questProgressPlaced", amount, until: "endOfRound" }] };
}

// Progress comes off the current quest card, no more than it holds (Great Cave-troll's excess damage, 41030:A:2). The step records it as a negative amount.
export function removeQuestProgress(state: ScenarioState, amount: number, steps: EngineStep[], cause: Cause): ScenarioState {
  const id = state.questStage;
  const stage = id ? state.cards[id] : undefined;
  const removed = stage ? Math.min(stage.progress, amount) : 0;
  if (!id || !stage || removed <= 0) return state;
  steps.push({ kind: "progress", targetId: id, amount: -removed, cause });
  return updateCard(state, id, { progress: stage.progress - removed });
}
