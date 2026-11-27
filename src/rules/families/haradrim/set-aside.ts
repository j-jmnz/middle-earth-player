// Rules: hrd.multiple-encounter-sets, hrd.removed-from-the-game, rr.in-play-and-out-of-play, rr.reveal, rr.the-word-choose (data/rules/entries.json); ledger lines 17147:A:1, 17148:A:1, 17149:A:1, 17150:A:2, 17151:A:1, 17152:A:2, 17152:A:3, 17160:A:1 to 17162:A:1, 17163:A:1.
//
// The Crossings of Poros: encounter sets set aside at Setup. A card of a set aside set that is revealed, placed in the encounter discard pile or shuffled in is part of the encounter deck from then on (hrd.multiple-encounter-sets). The cards still
// in the set-aside zone are what these verbs count and draw from; a set removed from the game has none left there, so it can no longer be named (hrd.removed-from-the-game).
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { byId, drawRandomSetAside } from "../../core/set-aside-draw.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { startReveal } from "../../windows/frames.ts";
import { moveEncounter, pushPicked } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { markShort } from "../../interpret/effect-verbs.ts";
import { ask, chosenOf } from "./staged.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The ids set aside that belong to the encounter set, in id order (a boon or burden of the campaign is no card of the set). */
export function asideOf(state: ScenarioState, set: string, ctx: ReduceContext): string[] {
  return state.setAside.filter((id) => {
    const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
    return printed.encounterSet === set && printed.campaignKind == null;
  }).sort(byId);
}

/**
 * The set the instruction draws from: its only set, or of several the one with the most cards still set aside. Tied sets are the first player's choice: the options are the first card of each, and the set of the card chosen is taken.
 * Null when no named set has a card left; a state when the first player is asked.
 */
function chosenSet(state: ScenarioState, instruction: Verb<"RandomSetAside">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): string | null | ScenarioState {
  const [only, ...others] = instruction.sets;
  if (only != null && others.length === 0) return only;
  const counts = instruction.sets.map((set) => ({ set, ids: asideOf(state, set, ctx) })).filter(({ ids }) => ids.length > 0);
  const most = Math.max(0, ...counts.map(({ ids }) => ids.length));
  const tied = counts.filter(({ ids }) => ids.length === most);
  if (tied.length === 0) return null;
  const options = tied.map(({ ids }) => ids[0] ?? "");
  const chosen = chosenOf(options, focus);
  if (!chosen) return ask(state, instruction, state.firstPlayer, options, steps);
  return tied.find(({ ids }) => ids[0] === chosen)?.set ?? null;
}

/**
 * RandomSetAside: one card of the set aside set (the cards with the type, when `cardType` names one) is drawn by the game seed, the ids in order, one step of the seed. With several `sets` it is the set with the most cards left, the first player choosing among
 * tied sets. `to` says what happens to it: `pick` makes it the last picked card (the card stays set aside, and the effect's later instructions read it), `reveal` has the actor reveal it as a card of the encounter deck (rr.reveal), `discard` places it in the encounter
 * discard pile. With no card left nothing happens; `pick` then leaves "" as the picked card.
 */
export function randomSetAside(state: ScenarioState, instruction: Verb<"RandomSetAside">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const set = chosenSet(state, instruction, focus, ctx, steps);
  // With no card left a `discard` is not resolved in full, so the text after "Then" is not attempted (thenResolves, rr.then).
  const none = (at: ScenarioState): ScenarioState => (instruction.to === "pick" ? pushPicked(at, undefined) : instruction.to === "discard" ? markShort(at, ctx) : at);
  if (typeof set !== "string") return set ?? none(state);
  const of = new Set(asideOf(state, set, ctx).filter((id) => instruction.cardType == null || printedOf(ctx.cards, state.cards[id]?.code ?? "").type === instruction.cardType));
  const drawn = drawRandomSetAside(state, (id) => of.has(id));
  if (!drawn) return none(state);
  const next = { ...state, seedCursor: state.seedCursor + 1 };
  if (instruction.to === "pick") return pushPicked(next, drawn);
  if (instruction.to === "discard") return moveEncounter(next, drawn, "discard", state.firstPlayer, ctx, steps);
  return startReveal(next, focus.seat, ctx, steps, drawn);
}

/** SetStagesAside: each stage with one of these codes that is still in the quest deck leaves the quest deck for the set-aside zone (`state.setAside`) and is marked `removedStage` (never played, as RemoveStage marks it), so the quest no longer reaches it and SearchAsideStageSets can tell it from the stage 3 the players played. Each is told in the log. */
export function setStagesAside(state: ScenarioState, instruction: Verb<"SetStagesAside">, steps: EngineStep[]): ScenarioState {
  let next = state;
  const cause = currentCause(steps, UNATTRIBUTED);
  for (const code of instruction.codes) {
    const id = next.questDeck.find((candidate) => next.cards[candidate]?.code === code);
    if (!id) continue;
    steps.push({ kind: "stageLeaves", cardId: id, how: "setAside", cause });
    next = moveCard(updateCard(next, id, { removedStage: true }), id, { zone: "setAside" });
  }
  return next;
}

/**
 * SearchAsideStageSets: "Search the encounter deck and discard pile for each enemy that belongs to an encounter set denoted by the first icon on each set aside stage 3 and add them to the staging area" (17163:A:1). `stages` pairs each stage 3 with the set of its first icon;
 * a stage 3 counts when it was set aside and never played (`removedStage`, SetStagesAside; the stage 3 the players defeated is set aside too, but it was played), and every enemy of its set goes from the encounter deck or its discard pile to the staging area, not revealed. The deck is shuffled by the record's next instruction.
 */
export function searchAsideStageSets(state: ScenarioState, instruction: Verb<"SearchAsideStageSets">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const sets = new Set(instruction.stages.filter((stage) => state.setAside.some((id) => state.cards[id]?.code === stage.code && state.cards[id]?.removedStage === true)).map((stage) => stage.set));
  let next = state;
  for (const id of [...state.encounterDeck, ...state.encounterDiscard]) {
    const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
    if (printed.type === "enemy" && printed.encounterSet != null && sets.has(printed.encounterSet)) next = moveEncounter(next, id, "staging", focus.seat, ctx, steps);
  }
  return next;
}
