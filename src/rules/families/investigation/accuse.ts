// Rules: docs/brief.md (Murder at the Prancing Pony, readings 9 and 11), rr.in-play-and-out-of-play, rr.search; ledger lines 50702:B:2 and 50720:A:2, and the insert's Making the Accusation. The first player names 1 Suspect and 1 Hideout, the facedown out-of-play pair is turned up into the staging area,
// and for each name that is not the pair's the Investigation deck is searched for that card. The names are asked and kept on the effect; the pair is read from the set-aside cards, so the hidden cards are named by no step until they enter play.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pileOf } from "../../core/piles.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import { askTarget } from "../../windows/choices.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { Focus } from "../index.ts";

const DECK = "investigationDeck" as const;

/** The code the effect named for the kind (NameInvestigation), or undefined. */
function namedFor(state: ScenarioState, kind: "suspect" | "hideout"): string | undefined {
  const entry = (effectData(state)?.named ?? []).findLast((item) => item.startsWith(`${kind}:`));
  return entry?.slice(kind.length + 1);
}

/** NameInvestigation: the actor chooses one of the cards by title (a single card is taken without asking) and the effect keeps the code. */
export function nameInvestigation(state: ScenarioState, instruction: Extract<Instruction, { verb: "NameInvestigation" }>, focus: Focus, steps: EngineStep[]): ScenarioState {
  const data = effectData(state);
  if (!data) return state;
  const chosen = focus.chosen != null && instruction.codes.includes(focus.chosen) ? focus.chosen : instruction.codes.length === 1 ? instruction.codes[0] : undefined;
  if (chosen === undefined) return askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, instruction.codes);
  const frame = topFrame(state)?.data;
  return frame?.kind === "effect" ? patchTop(state, { data: { ...frame, named: [...(frame.named ?? []), `${instruction.kind}:${chosen}`] } }) : state;
}

/**
 * MakeAccusation: the set-aside Suspect and Hideout (the set-aside cards among the ten) are turned faceup into the staging area. A name that is not the one set aside is searched for in the Investigation deck, and a card found that is not in play is added to the staging area too.
 * The effect's X is 1 when either name was wrong and 0 when both were right: the record then raises each player's threat by 3 once (`x` condition).
 */
export function makeAccusation(state: ScenarioState, instruction: Extract<Instruction, { verb: "MakeAccusation" }>, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const codes = [...instruction.suspects, ...instruction.hideouts];
  const hidden = state.setAside.filter((id) => codes.includes(state.cards[id]?.code ?? ""));
  const names = [namedFor(state, "suspect"), namedFor(state, "hideout")].filter((code): code is string => code !== undefined);
  let next = state;
  for (const id of hidden) next = moveEncounter(next, id, "staging", state.firstPlayer, ctx, steps);
  const wrong = names.filter((code) => !hidden.some((id) => state.cards[id]?.code === code));
  for (const code of wrong) {
    const found = pileOf(next, DECK).find((id) => next.cards[id]?.code === code);
    if (found !== undefined && !inPlay(next.cards[found]?.zone ?? "removed")) next = moveEncounter(next, found, "staging", state.firstPlayer, ctx, steps);
  }
  const data = effectData(next);
  const frame = topFrame(next)?.data;
  const marked = data && frame?.kind === "effect" ? patchTop(next, { data: { ...frame, x: names.length > 0 && wrong.length > 0 ? 1 : 0 } }) : next;
  return marked;
}

/** AddLookedToStaging: the top card of the Investigation deck, which the keyword just showed, goes to the staging area faceup when it has one of the Traits. */
export function addLookedToStaging(state: ScenarioState, instruction: Extract<Instruction, { verb: "AddLookedToStaging" }>, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = pileOf(state, DECK)[0];
  if (id === undefined || !instruction.traits.some((trait) => hasTrait(state, id, trait, ctx))) return state;
  return moveEncounter(state, id, "staging", state.firstPlayer, ctx, steps);
}
