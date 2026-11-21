// Rules: rr.encounter-deck, rr.discard-pile-and-victory-display, rr.removed-from-game (data/rules/entries.json); ledger line 04113:B:1.
//
// Washed Away!: "Shuffle all enemy and treachery cards in the encounter discard pile together with the Foundations of Stone encounter set. This deck becomes the new encounter deck. Remove all other encounter deck cards from the game." The cards of the old encounter deck and
// the other cards of its discard pile leave the game; the discarded cards of the types named and the set-aside cards of the set (the Nightmare cards that bear its icon too) are the new deck, shuffled with the game's seed, facedown.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** Whether the printed encounter set is the set, or the Nightmare cards that bear its icon. */
function inSet(encounterSet: string | null, set: string): boolean {
  return encounterSet === set || encounterSet === `${set} Nightmare`;
}

export function replaceEncounterDeck(state: ScenarioState, instruction: Verb<"ReplaceEncounterDeck">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  const kept: string[] = [];
  for (const id of state.encounterDeck) next = moveCard(next, id, { zone: "removed" });
  for (const id of state.encounterDiscard) {
    const type = printedOf(ctx.cards, state.cards[id]?.code ?? "").type;
    if ((instruction.keep as readonly string[]).includes(type)) kept.push(id);
    else next = moveCard(next, id, { zone: "removed" });
  }
  const set = state.setAside.filter((id) => {
    const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
    return inSet(printed.encounterSet, instruction.set) && printed.campaignKind == null;
  });
  const shuffled = shuffleIds([...kept, ...set], state.seed, state.seedCursor);
  for (const id of shuffled.ids) next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down", controller: null });
  steps.push({ kind: "shuffleSet", set: instruction.set, count: set.length });
  return { ...next, seedCursor: shuffled.cursor };
}
