// Rules: dwd.creating-the-quest-deck, dwd.bypassing-a-quest-card, rr.quest-cards-quest-deck, rr.first-player, rr.search (data/rules/entries.json); ledger lines 03070:A:1, 03070:B:1, 03026:A:1, 03074:B:1, 03075:B:3, 901209:A:3.
//
// Flight from Moria's quest deck beside Mount Gundabad's (gundabad.ts): the stage 2s arrive side A and are flipped at the beginning of the staging step, which resolves the side B's When Revealed (FlipCurrentQuest `resolve`); a stage can be revealed anew by New Devilry
// and Blocked by Shadow (RevealNewStage), Hasty Council flips the stage it chooses at once (ChooseStageToFlip), and Heading Up and Heading Down return each other from the victory display (ShuffleStageFromVictory).
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats, updateCard } from "../../core/state.ts";
import { eliminateSeat } from "../../core/eliminate.ts";
import { printedOf } from "../../core/printed.ts";
import { moveCard, shadowCards } from "../../core/zones.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { resetEncounterDeck } from "../../interpret/verbs.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import { addToVictory } from "../sidequests/victory.ts";
import { recordSide } from "../dreamchaser/faces.ts";
import { keepStage, lookedStages } from "../quest/order.ts";
import type { Focus } from "../index.ts";
import { replaceCurrent, shuffleDeck } from "./gundabad.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** FlipCurrentQuest `resolve`: the current stage shows side B and its side B's When Revealed effects resolve now, for the first player (dwd.creating-the-quest-deck: "the current quest card is revealed only at the beginning of the staging step"). A stage that shows side B changes nothing. */
export function flipAndReveal(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = state.questStage;
  const stage = id ? state.cards[id] : undefined;
  if (!id || !stage || stage.face !== "A") return state;
  const effects = ctx.effects.filter((effect) => effect.cardCode === stage.code && effect.timing === "whenRevealed" && recordSide(effect) === "B");
  return pushCardEffects(updateCard(state, id, { face: "B" }), "whenRevealed", id, state.firstPlayer, false, effects, ctx, steps);
}

/** RevealNewStage: the current stage returns to the quest deck with no progress (shuffled in, or at the bottom with `bottom`) and the top stage of the deck is revealed side A. With `bottom` and no other stage nothing happens. */
export function revealNewStage(state: ScenarioState, instruction: Verb<"RevealNewStage">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.questStage == null) return state;
  const top = state.questDeck[0];
  if (instruction.bottom) return top == null ? state : replaceCurrent(state, top, { flipped: false }, ctx, steps);
  return replaceCurrent(state, top ?? state.questStage, { flipped: false, shuffle: true }, ctx, steps);
}

/**
 * ChooseStageToFlip (03074:B:1): the actor chooses one of the top `count` stages of the quest deck; it takes the current stage's place, flipped at once so that its When Revealed effects resolve, and the others go to the bottom of the quest deck. The stage replaced is set aside, for the
 * record's next instruction to add to the victory display. Run where nobody can be asked, the top stage is taken.
 */
export function chooseStageToFlip(state: ScenarioState, instruction: Verb<"ChooseStageToFlip">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const looked = lookedStages(state, instruction.count);
  if (looked.length === 0 || state.questStage == null) return state;
  const chosen = focus.chosen ?? (looked.length === 1 ? looked[0] : undefined);
  if (chosen == null || !looked.includes(chosen)) {
    if (effectData(state)) return askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, looked);
    return replaceCurrent(keepStage(state, looked, looked[0] ?? ""), looked[0] ?? "", { flipped: true, leaves: "setAside" }, ctx, steps);
  }
  return replaceCurrent(keepStage(state, looked, chosen), chosen, { flipped: true, leaves: "setAside" }, ctx, steps);
}

/** DiscardTopEliminating (03075:B:2): each living player in turn order discards the top card of the encounter deck, which is eliminated with the card if it is a treachery. */
export function discardTopEliminating(state: ScenarioState, instruction: Verb<"DiscardTopEliminating">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const seat of livingSeats(state)) {
    if (next.encounterDeck.length === 0) next = resetEncounterDeck(next, steps, ctx);
    const id = next.encounterDeck[0];
    if (id === undefined) break;
    next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
    if (printedOf(ctx.cards, next.cards[id]?.code ?? "").type === instruction.type) next = eliminateSeat(next, seat, steps);
    if (next.lost || next.failure) return next;
  }
  return next;
}

/** AddShadowToVictory (901209:A:3): an AfterAttack's source is the attacking enemy, so the shadow card with this code is the one among the enemy's shadow cards. */
export function addShadowToVictory(state: ScenarioState, instruction: Verb<"AddShadowToVictory">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const enemy = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const id = shadowCards(enemy).find((held) => state.cards[held]?.code === instruction.code);
  return id ? addToVictory(state, id, ctx) : state;
}

/** ShuffleStageFromVictory (03070:B:1): the card with this code leaves the victory display for the quest deck, side A up, and the deck is shuffled. */
export function shuffleStageFromVictory(state: ScenarioState, instruction: Verb<"ShuffleStageFromVictory">): ScenarioState {
  const id = state.victory.find((cardId) => state.cards[cardId]?.code === instruction.code);
  if (!id) return state;
  return shuffleDeck(updateCard(moveCard(state, id, { zone: "questDeck" }), id, { face: "A" }));
}
