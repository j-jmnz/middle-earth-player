// Rules: rr.search, rr.encounter-deck, rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 41041:A:1.
//
// "Search the encounter deck, discard pile, and your collection (in that order) for a Goblin Sniper and add it to the staging area."
// The app tracks no collection (docs/brief.md), so the collection is every card the game knows (families/misc-collection.ts takes the same
// view for the heroes): a copy of the card is made when the deck and the pile hold none.
import type { Instruction } from "../../catalog/boundary.ts";

import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { spawn } from "../zones.ts";
import type { Focus } from "./index.ts";
import { moveEncounter } from "./encounter-moves.ts";

export function searchCollection(state: ScenarioState, instruction: Extract<Instruction, { verb: "SearchCollection" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const title = printedOf(ctx.cards, instruction.code).name;
  const named = (id: string): boolean => printedOf(ctx.cards, state.cards[id]?.code ?? "").name === title;
  // The deck first, then the discard pile: the first copy found, as the copies of one card are one choice (rr.search).
  const found = state.encounterDeck.find(named) ?? state.encounterDiscard.find(named);
  if (found) return moveEncounter(state, found, instruction.to, focus.seat, ctx, steps);
  const made = spawn(state, instruction.code, { zone: "encounterDiscard" });
  return moveEncounter(made.state, made.id, instruction.to, focus.seat, ctx, steps);
}
