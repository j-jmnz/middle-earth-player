// Rules: rr.search, rr.reveal, rr.encounter-deck (data/rules/entries.json); ledger lines 51241:A:1, 51203:B:1 (docs/scenarios/standalone-scenarios.md, The Mines of Moria, readings 9 and 11).
// The two ways the kit's "opposing team" handles the top of the encounter deck without a prompt: Hidden Threat lays a card facedown under the main quest until the players next quest successfully, and A Presence in the Dark puts the weaker of the top two cards on the bottom.
import type { Instruction } from "../../../catalog/boundary.ts";

import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { searchable } from "../../interpret/search.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { shuffleEncounterDeck } from "../../interpret/verbs.ts";
import { startReveal } from "../../windows/frames.ts";
import { stageNumber } from "../caves/progress.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** HideUnderQuest: the card nearest the top of the top cards that costs no more than the stage number lies facedown under the main quest, marked with its place in the order; the deck is shuffled. With none, only the shuffle. */
export function hideUnderQuest(state: ScenarioState, instruction: Verb<"HideUnderQuest">, ctx: ReduceContext): ScenarioState {
  const id = searchable(state, { top: instruction.top, maxCost: stageNumber(state) }, ctx)[0];
  const quest = state.questStage;
  if (!id || !quest) return shuffleEncounterDeck(state);
  const placed = Math.max(0, ...Object.values(state.cards).map((card) => card.hiddenAt ?? 0)) + 1;
  return shuffleEncounterDeck(updateCard(moveCard(state, id, { zone: "under", locationId: quest }), id, { hiddenAt: placed }));
}

/** The players quested successfully (afterQuestOutcome): each card Hidden Threat hid is revealed in full, the first one placed first. A game with no HideUnderQuest does none of this work. */
export function revealHidden(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!gameReads(state, ctx, '"HideUnderQuest"')) return state;
  const hidden = Object.values(state.cards)
    .filter((card) => card.hiddenAt != null && card.zone === "under")
    .sort((left, right) => (left.hiddenAt ?? 0) - (right.hiddenAt ?? 0));
  let next = state;
  // Each frame goes on top of the one before it, so the card placed first resolves first.
  for (const card of [...hidden].reverse()) {
    const out = updateCard(moveCard(next, card.id, { zone: "setAside" }), card.id, { face: "down", hiddenAt: undefined });
    next = startReveal(out, state.firstPlayer, ctx, steps, card.id);
  }
  return next;
}

// How hard a card hits the players when it is revealed: an enemy before a treachery before a location, then the higher Threat, then the higher Attack.
function strength(state: ScenarioState, id: string, ctx: ReduceContext): readonly number[] {
  const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
  if (printed.type === "enemy") return [3, printed.threat ?? 0, printed.attack ?? 0];
  if (printed.type === "treachery") return [2, 0, 0];
  return printed.type === "location" ? [1, printed.threat ?? 0, 0] : [0, 0, 0];
}

/** ArrangeTopByChallenge: the stronger of the top two cards stays on top, the weaker goes to the bottom; level, the top card stays. */
export function arrangeTopByChallenge(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const [first, second, ...rest] = state.encounterDeck;
  if (!first || !second) return state;
  const one = strength(state, first, ctx);
  const two = strength(state, second, ctx);
  const differs = two.findIndex((value, at) => value !== one[at]);
  const secondStronger = differs >= 0 && (two[differs] ?? 0) > (one[differs] ?? 0);
  const [top, bottom] = secondStronger ? [second, first] : [first, second];
  return { ...state, encounterDeck: [top, ...rest, bottom] };
}
