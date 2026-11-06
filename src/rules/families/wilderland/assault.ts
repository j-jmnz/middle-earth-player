// Rules: rr.search, rr.engaged, rr.immune, rr.explored, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 19155:A:1, 19161:A:3, 19162:A:2, 19163:A:2.
// The cards of The Fate of Wilderland (part 9) that move cards about or read the combat phase: the Goblin Troop searched out of the encounter deck, its discard pile or the victory display, the enemies a Hilltop discards that join the staging area, progress taken off and resource tokens put on a card by its title, and whether
// Urdug has resolved an attack in this combat phase. A game that deals none of these cards never reaches the code.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { searchable } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import { addResourceTokens } from "../nightmare/dungeon.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** SearchStageCard: the card with the code, found in the encounter deck, its discard pile or the victory display, is added to the staging area, entering play there. The encounter deck is shuffled by the record's next instruction. */
export function searchStageCard(state: ScenarioState, instruction: Verb<"SearchStageCard">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const found = [...searchable(state, { code: instruction.code }, ctx), ...state.victory.filter((id) => state.cards[id]?.code === instruction.code)];
  const id = found[0];
  return id == null ? state : moveEncounter(state, id, "staging", focus.seat, ctx, steps);
}

/** StageDiscarded: each card of the type among those the effect's DiscardEncounterTop discarded, still in the encounter discard pile, is added to the staging area in the order discarded. */
export function stageDiscarded(state: ScenarioState, instruction: Verb<"StageDiscarded">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of effectData(state)?.looked ?? []) {
    if (next.cards[id]?.zone === "encounterDiscard" && printedOf(ctx.cards, next.cards[id]?.code ?? "").type === instruction.type) next = moveEncounter(next, id, "staging", focus.seat, ctx, steps);
  }
  return next;
}

/** The card in play with this title (an objective in the staging area, a card of a player's), or nothing. */
function inPlayNamed(state: ScenarioState, name: string, ctx: ReduceContext): string | undefined {
  return Object.values(state.cards).find((card) => inPlay(card.zone) && printedOf(ctx.cards, card.code).name === name)?.id;
}

/** RemoveProgressFrom: up to `amount` progress comes off the card with the title; the step log records the loss as it records progress, with a negative amount. */
export function removeProgressFrom(state: ScenarioState, instruction: Verb<"RemoveProgressFrom">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = inPlayNamed(state, instruction.named, ctx);
  const card = id ? state.cards[id] : undefined;
  const removed = card ? Math.min(card.progress, resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx)) : 0;
  if (!id || !card || removed <= 0) return state;
  steps.push({ kind: "progress", targetId: id, amount: -removed, cause: currentCause(steps, UNATTRIBUTED) });
  return updateCard(state, id, { progress: card.progress - removed });
}

/** PlaceResourcesOnNamed: resource tokens on the card with the title, as PlaceResourceTokens places them. */
export function placeResourcesOnNamed(state: ScenarioState, instruction: Verb<"PlaceResourcesOnNamed">, focus: Focus, ctx: ReduceContext): ScenarioState {
  return addResourceTokens(state, inPlayNamed(state, instruction.named, ctx), resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx));
}

/** The enemy with this title has resolved an attack in the combat phase now under way: its entry (`id`, or `id@seat` when it attacks each player) is in the attacks this phase resolved. In any other phase it has resolved none. */
export function attackedThisPhase(state: ScenarioState, name: string, ctx: ReduceContext): boolean {
  if (state.phase !== "Combat") return false;
  const ids = new Set(Object.values(state.cards).filter((card) => printedOf(ctx.cards, card.code).name === name).map((card) => card.id));
  return state.resolvedAttacks.some((key) => ids.has(key.split("@")[0] ?? key));
}
