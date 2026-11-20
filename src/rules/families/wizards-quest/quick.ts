// Rules: rr.in-play-and-out-of-play, rr.quest-cards-quest-deck, rr.first-player (data/rules/entries.json); ledger line 51001:A:1 (docs/brief.md, The Wizard's Quest, reading 2).
// The kit's Quick-build: 7 of the 14 encounter sets stay in the encounter deck (the game's seed picks them) and the other 7 lie set aside; the first player chooses one stage 2 and one stage 3 of the quest cards in the quest deck, and the rest lie set aside.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { shuffleIds } from "../../core/seed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

function setAside(state: ScenarioState, id: string): ScenarioState {
  return updateCard(moveCard(state, id, { zone: "setAside" }), id, { face: "down" });
}

/** BuildQuickDeck: `keep` of the sets the encounter deck holds, picked with the game's seed, stay; the cards of the others lie set aside. */
export function buildQuickDeck(state: ScenarioState, instruction: Verb<"BuildQuickDeck">, ctx: ReduceContext): ScenarioState {
  const present = instruction.sets.filter((name) => state.encounterDeck.some((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").encounterSet === name));
  if (present.length <= instruction.keep) return state;
  const rolled = shuffleIds(present, state.seed, state.seedCursor);
  const kept = new Set(rolled.ids.slice(0, instruction.keep));
  let next: ScenarioState = { ...state, seedCursor: rolled.cursor };
  for (const id of [...state.encounterDeck]) {
    const set = printedOf(ctx.cards, state.cards[id]?.code ?? "").encounterSet ?? "";
    if (instruction.sets.includes(set) && !kept.has(set)) next = setAside(next, id);
  }
  return next;
}

/** ChooseQuestStage: the first player chooses one of the quest cards of the quest deck with these codes (asked when there are several); the others lie set aside and leave the quest's order. */
export function chooseQuestStage(state: ScenarioState, instruction: Verb<"ChooseQuestStage">, focus: Focus, steps: EngineStep[]): ScenarioState {
  const options = state.questDeck.filter((id) => instruction.codes.includes(state.cards[id]?.code ?? ""));
  if (options.length === 0) return state;
  const chosen = focus.chosen != null && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (chosen == null) {
    if (!effectData(state)) return keepStage(state, options[0] ?? "", options);
    return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
  }
  return keepStage(state, chosen, options);
}

function keepStage(state: ScenarioState, chosen: string, options: readonly string[]): ScenarioState {
  let next = state;
  const dropped = new Set<string>();
  for (const id of options) {
    if (id === chosen) continue;
    dropped.add(state.cards[id]?.code ?? "");
    next = setAside(next, id);
  }
  return { ...next, stages: next.stages.filter((stage) => !dropped.has(stage.code)) };
}
