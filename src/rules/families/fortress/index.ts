// Rules: mec112.defense, rr.active-location, rr.step-3-4 (data/rules/entries.json); ledger lines 143073:B:1, 143074:B:2, 143045:A:2.
// The Defense keyword of Helm's Deep: while the current quest stage has it (the flag `defenseKeyword`), questing places no progress for the players, and the Threat that beats the committed Willpower
// becomes progress the first player places on the current quest instead of a threat raise. The core calls the hook (interpret/family-hooks.ts, familyQuestResult), not this file by name.
import type { Condition, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { QuestTotals, RulesFamily } from "../../interpret/family-manifest.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { PrintedCard } from "../../core/printed.ts";
import { placeQuestProgress } from "../../quest/quest.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay, livingSeats, updateCard } from "../../core/state.ts";
import type { PickContext } from "../../interpret/pick.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Focus } from "../index.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// Quest resolution under the Defense keyword. A tie or a success for the players places nothing; a staging Threat beyond the committed Willpower is placed as progress on the current quest, on the
// active location first (rr.active-location), and a quest that fills advances as usual. Whether the stage itself took progress is kept for 143074:B:2, and the stage hears that the quest resolved.
function questResult(state: ScenarioState, totals: QuestTotals, cards: Cards, steps: EngineStep[], canAdvance: (state: ScenarioState) => boolean): ScenarioState | null {
  const stageId = state.questStage;
  if (totals.only != null || !stageId || !flagged(state, stageId, "defenseKeyword")) return null;
  const before = state.cards[stageId]?.progress ?? 0;
  const placed = totals.threat > totals.willpower ? placeQuestProgress(state, totals.threat - totals.willpower, cards, steps, canAdvance, false) : state;
  const onStage = placed.questStage !== stageId || (placed.cards[stageId]?.progress ?? 0) > before;
  return queueEvent({ ...placed, defensePlaced: onStage }, { trigger: "questResolved", seat: null, subject: stageId });
}

// RemoveResourceTokens: up to `amount` tokens come off the card in play with this code.
function removeTokens(state: ScenarioState, instruction: Extract<Instruction, { verb: "RemoveResourceTokens" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const card = Object.values(state.cards).find((candidate) => candidate.code === instruction.code && inPlay(candidate.zone));
  if (!card) return state;
  const amount = Math.min(card.resources, resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx));
  return amount > 0 ? updateCard(state, card.id, { resources: card.resources - amount }) : state;
}

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState | null {
  return instruction.verb === "RemoveResourceTokens" ? removeTokens(state, instruction, focus, ctx) : null;
}

// "If the encounter deck did not place at least 1 progress on this stage as the result of questing" (143074:B:2); "if any player is not engaged with an enemy" (143041:A:1).
function condition(state: ScenarioState, found: Condition): boolean | null {
  if (found.kind === "encounterPlacedOnStage") return state.defensePlaced === true;
  if (found.kind === "playerUnengaged") return livingSeats(state).some((seat) => (state.seats[seat]?.engaged.length ?? 0) === 0);
  return null;
}

// `isSource`: only the card whose record is being read (the copy that attacked).
function pick(_state: ScenarioState, id: string, spec: PickSpec, at: PickContext): boolean {
  return !spec.isSource || id === at.sourceId;
}

// "Until the end of the round, players cannot declare attacks" (143040:A:2): no character is declared as an attacker while the table holds the flag.
function attackBarred(state: ScenarioState): string | null {
  return flagged(state, "table", "cannotDeclareAttacks") ? "Players cannot declare attacks this round." : null;
}

export const manifest: RulesFamily = {
  name: "fortress",
  verbs: ["RemoveResourceTokens"],
  run,
  questResult,
  condition: (state, found) => condition(state, found),
  pick,
  combat: { attack: (state) => attackBarred(state) },
};
