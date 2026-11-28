// Rules: vom.the-one-ring, rr.first-player, rr.the-word-choose (data/rules/entries.json).
//
// KeepOneCopy: "If two or more players have The One Ring in their decks, the first player decides which player will put his copy of The One Ring into play.
// Each other copy is removed from the game." Each seat's copy has its own Setup frame; the verb leads each of them. With one copy set aside it does nothing. With
// two or more it asks the first player once, then removes every copy but the chosen one and ends the Setup frame of each copy removed, so the chosen
// player's Setup is the one that runs.
import type { Instruction } from "../../../catalog/boundary.ts";

import { askTarget } from "../../windows/choices.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";

type Verb = Extract<Instruction, { verb: "KeepOneCopy" }>;

// The copies of the source's card that lie set aside, in card order.
function copiesOf(state: ScenarioState, code: string): string[] {
  return Object.values(state.cards).filter((card) => card.code === code && card.zone === "setAside").map((card) => card.id);
}

// The running frame stops: the instructions after this one do not run.
function endFrame(state: ScenarioState): ScenarioState {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? patchTop(state, { data: { ...data, queue: [] } }) : state;
}

export function keepOneCopy(state: ScenarioState, instruction: Verb, focus: Focus): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!source) return state;
  // The copy was removed when another seat's copy was chosen: its Setup does not run.
  if (source.zone === "removed") return endFrame(state);
  const copies = copiesOf(state, source.code);
  if (copies.length < 2) return state;
  const chosen = focus.chosen && copies.includes(focus.chosen) ? focus.chosen : null;
  if (!chosen) {
    // Each copy says whose it is: the seat of the Setup frame that holds it (a card set aside has no controller).
    let named = state;
    for (const id of copies) {
      const seat = state.stack.find((frame) => frame.cardId === id)?.seat;
      if (seat != null) named = updateCard(named, id, { owner: seat });
    }
    return askTarget(named, { instruction, seat: state.firstPlayer, chosen: null }, copies);
  }
  let next = state;
  for (const id of copies) if (id !== chosen) next = moveCard(next, id, { zone: "removed" });
  return chosen === source.id ? next : endFrame(next);
}
