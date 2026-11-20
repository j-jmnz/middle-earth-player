// Rules: rr.destroy, rr.explored, rr.the-word-choose (data/rules/entries.json); ledger lines 50907:A:1, 50931:B:2, 50903:B:2 to 50906:B:2 (docs/brief.md, Attack on Dol Guldur, readings 4, 5, 6 and 8).
//
// The Siege value an Attack on Dol Guldur card prints is added to a tally for the round when an enemy is destroyed or a location explored (TallySiege); Dol Guldur's Forced effect reads it at the end of the round (the amount `siegeTally`). The tally belongs to
// one round: it is read as 0 in any other. SelectRandomStage notes one of the other stage 3s as an option taken by the running effect, so the penalty records that follow it (`optionTaken`) apply it.
import type { Amount, Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { destroyCard } from "../../core/keywords.ts";
import { moveCard } from "../../core/zones.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import type { EngineStep } from "../../core/intents.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The Siege value the tally has taken in this round. */
export function siegeTallyOf(state: ScenarioState): number {
  return state.siegeTally?.round === state.round ? state.siegeTally.value : 0;
}

/** TallySiege: the Siege value printed on the card the event is about (a destroyed enemy, an explored location) joins this round's tally. A card with none adds 0. */
export function tallySiege(state: ScenarioState, id: string | null, ctx: ReduceContext): ScenarioState {
  const value = id ? (printedOf(ctx.cards, state.cards[id]?.code ?? "").keywords.siegeValue ?? 0) : 0;
  return value === 0 ? state : { ...state, siegeTally: { round: state.round, value: siegeTallyOf(state) + value } };
}

/** The amount `siegeTally`. */
export function siegeAmount(state: ScenarioState, amount: Exclude<Amount, number>): number | null {
  return amount.siegeTally ? siegeTallyOf(state) : null;
}

/** Notes `option` as taken by the running effect, as a `different` Choose does, for the condition `optionTaken`. */
export function noteTaken(state: ScenarioState, option: string): ScenarioState {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? patchTop(state, { data: { ...data, options: [...(data.options ?? []), option] } }) : state;
}

/** Whether the running effect took this option (a Choose with `different`, or SelectRandomStage). */
export function optionTaken(state: ScenarioState, option: string): boolean {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" && (data.options ?? []).includes(option);
}

/** SelectRandomStage: of the stages named, those but the current one (the stage 3 in play this round, a Standard game having one at a time), the game's seed picks one, noted as a taken option under its code. */
export function selectRandomStage(state: ScenarioState, instruction: Verb<"SelectRandomStage">): ScenarioState {
  const current = state.questStage ? state.cards[state.questStage]?.code : undefined;
  const others = instruction.codes.filter((code) => code !== current);
  if (others.length === 0) return state;
  const shuffled = shuffleIds(others, state.seed, state.seedCursor);
  const chosen = shuffled.ids[0];
  return chosen ? noteTaken({ ...state, seedCursor: shuffled.cursor }, chosen) : state;
}

/** TakeControlOfStaged: the card in the staging area with the code enters the first player's play area under his control, faceup and ready ("place it in his play area under his control", 50902:A:1). Nothing happens when it is not there. */
export function takeControlOfStaged(state: ScenarioState, instruction: Verb<"TakeControlOfStaged">): ScenarioState {
  const id = state.staging.find((candidate) => state.cards[candidate]?.code === instruction.code);
  if (!id) return state;
  return updateCard(moveCard(state, id, { zone: "play", seat: state.firstPlayer }), id, { face: "up", exhausted: false });
}

/** DiscardCopiesOfDiscarded: each card in play with the title of the card the running effect last discarded from a deck goes to its owner's discard pile ("Then, discard each copy of that card from play", 50911:A:2). */
export function discardCopiesOfDiscarded(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = topFrame(state)?.data;
  const last = data?.kind === "effect" ? data.discardedFromDecks?.at(-1) : undefined;
  const name = last ? printedOf(ctx.cards, state.cards[last]?.code ?? "").name : null;
  if (!name) return state;
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (card.id === last || !inPlay(card.zone) || printedOf(ctx.cards, card.code).name !== name) continue;
    next = destroyCard(next, card.id, ctx.cards, steps);
  }
  return next;
}
