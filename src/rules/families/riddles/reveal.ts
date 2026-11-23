// Rules: hob.riddles, rr.encounter-deck (data/rules/entries.json); ledger lines 131081:A:1, 131084:A:1. The riddle cards as they are revealed: the first player's choice between resolving the card and answering its riddle, the discards of It Likes Riddles? and Not Fair! Not Fair!.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { holds } from "../../interpret/conditions.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { askTarget } from "../../windows/choices.ts";
import { patchTop } from "../../windows/windows.ts";
import { effectData, pushPicked, shuffleDiscardIn } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { areaStage } from "./area.ts";
import { riddleOf } from "./conditions.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// The record that offers the choice: its top-level Choose has an option that answers the riddle.
const offers = (effect: Effect): boolean => effect.instructions.some((instruction) => instruction.verb === "Choose" && instruction.options.some((option) => option.instructions.some((inner) => inner.verb === "AnswerRiddle")));

/** The When Revealed records the reveal of the card pushes: the riddle offer alone when it holds (the others wait for ResolveNormally), else every record but the offer (a card that is not revealed from the encounter deck, or while riddles are ignored). */
export function revealedEffects(state: ScenarioState, id: string, seat: number, effects: readonly Effect[], ctx: ReduceContext): readonly Effect[] {
  const offer = effects.find((effect) => offers(effect) && (!effect.condition || holds(state, effect.condition, { actor: seat, sourceId: id, returned: 0 }, ctx)));
  return offer ? [offer] : effects.filter((effect) => !offers(effect));
}

/** ResolveNormally: the card's When Revealed records, but the riddle offer, resolve for the first player as the reveal would have run them. */
export function resolveNormally(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = focus.sourceId;
  const code = id ? state.cards[id]?.code : undefined;
  if (!id || !code) return state;
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed" && !offers(effect));
  return pushCardEffects(state, "whenRevealed", id, focus.seat, false, effects, ctx, steps);
}

/** DiscardUntilRiddle: encounter cards go to the discard pile until one that prints a riddle is discarded; it is the picked card (empty when no such card is left in the deck or the discard pile). */
export function discardUntilRiddle(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const wanted = (id: string) => riddleOf(ctx, state.cards[id]?.code ?? "") != null;
  if (![...state.encounterDeck, ...state.encounterDiscard].some(wanted)) return pushPicked(state, null);
  let current = state;
  for (;;) {
    const top = current.encounterDeck[0];
    if (!top) {
      current = shuffleDiscardIn(current);
      continue;
    }
    current = updateCard(moveCard(current, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null });
    if (wanted(top)) return pushPicked(current, top);
  }
}

const TYPES = ["enemy", "location", "treachery", "objective"] as const;

/** NameEncounterType: the first player names one of the types; the effect keeps it. */
export function nameEncounterType(state: ScenarioState, instruction: Verb<"NameEncounterType">, focus: Focus, steps: EngineStep[]): ScenarioState {
  const data = effectData(state);
  if (!data) return state;
  const chosen = focus.chosen != null && instruction.types.includes(focus.chosen as (typeof TYPES)[number]) ? focus.chosen : undefined;
  if (chosen === undefined) return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, instruction.types);
  return patchTop(state, { data: { ...data, named: [...(data.named ?? []).filter((entry) => !entry.startsWith("riddle:encounterType:")), `riddle:encounterType:${chosen}`] } });
}

/** RemoveRiddleProgress: each card the effect discarded from the top of the encounter deck whose type is not the named one takes 1 progress off stage 2. */
export function removeRiddleProgress(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = effectData(state);
  const stage = areaStage(state);
  const name = (data?.named ?? []).findLast((entry) => entry.startsWith("riddle:encounterType:"))?.slice("riddle:encounterType:".length);
  if (!data || !stage || name == null) return state;
  const missed = (data.looked ?? []).filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type !== name).length;
  const removed = Math.min(stage.progress, missed);
  if (removed <= 0) return state;
  steps.push({ kind: "progress", targetId: stage.id, amount: -removed, cause: currentCause(steps, UNATTRIBUTED) });
  return updateCard(state, stage.id, { progress: stage.progress - removed });
}
