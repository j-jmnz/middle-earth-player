// Rules: rr.search, rr.engaged, rr.immune, rr.explored, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 19155:A:1, 19161:A:3, 19162:A:2, 19163:A:2.
// The cards of The Fate of Wilderland (part 9) that move cards about or read the combat phase: the Goblin Troop searched out of the encounter deck, its discard pile or the victory display, the enemies a Hilltop discards that join the staging area, progress taken off a card by its title, and whether
// Urdug has resolved an attack in this combat phase. A game that deals none of these cards never reaches the code.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { takeProgressOff } from "../../core/progress.ts";
import type { Modifier, ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import { searchable } from "../../interpret/search.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import { namedInPlay } from "../misc/amounts.ts";
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

/** RemoveProgressFrom: up to `amount` progress comes off the card with the title; the step log records the loss as it records progress, with a negative amount. */
export function removeProgressFrom(state: ScenarioState, instruction: Verb<"RemoveProgressFrom">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const id = instruction.target ? refCard(state, instruction.target, scope) : instruction.named ? namedInPlay(state, instruction.named, ctx) : null;
  return takeProgressOff(state, id, resolveAmount(state, instruction.amount, scope, ctx), steps);
}

/** The card in play with this title holds the flag: "resources cannot be placed on The Heroes' Defense" read by the Watchtower's option. */
export function namedFlagHeld(state: ScenarioState, name: string, stat: string, ctx: ReduceContext): boolean {
  const id = namedInPlay(state, name, ctx);
  return id != null && flagged(state, id, stat as Modifier["stat"]);
}

/** The enemy with this title has resolved an attack in the phase now under way: in the combat phase its entry (`id`, or `id@seat` when it attacks each player) is in the attacks this phase resolved, and an immediate attack (from the staging area, by a card's effect) made in this phase of this round counts in any phase. */
export function attackedThisPhase(state: ScenarioState, name: string, ctx: ReduceContext): boolean {
  const ids = new Set(Object.values(state.cards).filter((card) => printedOf(ctx.cards, card.code).name === name).map((card) => card.id));
  const immediate = state.immediateAttacks;
  if (immediate && immediate.round === state.round && immediate.phase === state.phase && immediate.enemies.some((id) => ids.has(id))) return true;
  return state.phase === "Combat" && state.resolvedAttacks.some((key) => ids.has(key.split("@")[0] ?? key));
}
