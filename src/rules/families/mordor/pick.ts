// Rules: rr.first-player, rr.traits (data/rules/entries.json); ledger line 21060:A:2.
// "The Easterling enemy with the lowest Defense" (Fanaticism): the pick's cards are measured by the Defense the table shows, and the first player chooses among those tied.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { tiedExtreme } from "../../interpret/tied-extreme.ts";
import { askTarget } from "../../windows/choices.ts";
import { markPicked } from "../play/refs.ts";
import type { Focus } from "../index.ts";

/** PickLowestDefense: the card of the pick with the lowest Defense becomes the picked card; the first player chooses among the cards tied. Nothing is picked when none matches. */
export function pickLowestDefense(state: ScenarioState, instruction: Extract<Instruction, { verb: "PickLowestDefense" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const candidates = pickCandidates(state, instruction.pick, focus.seat, [], focus.sourceId, ctx);
  if (candidates.length === 0) return state;
  const tied = tiedExtreme(candidates, (id) => (state.cards[id] ? modifiedStat(state, state.cards[id], "defense", ctx.cards) : 0), "lowest");
  const chosen = focus.chosen && tied.includes(focus.chosen) ? focus.chosen : tied.length === 1 ? tied[0] : undefined;
  if (!chosen) return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, tied);
  return markPicked(state, chosen);
}
