// Rules: rr.encounter-deck, rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 11210:A:4. "Shuffle Gavin and 1 random set-aside Send for Help into the encounter deck": of the cards set aside with
// the title, one chosen with the game's seed goes into the encounter deck facedown, as every card in a deck is. The shuffle is the next instruction's (Gavin's own ShuffleSelfIntoEncounterDeck).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { nextUint } from "../../core/seed.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

export function shuffleRandomSetAside(state: ScenarioState, instruction: Extract<Instruction, { verb: "ShuffleRandomSetAside" }>, ctx: ReduceContext): ScenarioState {
  // In id order, so one seed always picks the same card.
  const set = state.setAside.filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").name === instruction.name).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const id = set[nextUint(state.seed, state.seedCursor) % Math.max(set.length, 1)];
  if (!id) return state;
  return updateCard(moveCard({ ...state, seedCursor: state.seedCursor + 1 }, id, { zone: "encounterDeck" }), id, { face: "down" });
}
