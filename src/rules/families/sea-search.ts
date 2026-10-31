// Rules: rr.search, dcce.ship-enemies (data/rules/entries.json); ledger line 11021:A:1. "Search the encounter deck and discard pile for the Ship enemy with the
// highest Threat and add it to the staging area (2 Ship enemies with the highest Threat instead if there are 3 or more players)": the Ship enemies found
// there are taken from the highest Threat down, one after the other. Of cards tied that are not copies of one card the first player chooses.
import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../amounts.ts";
import { askTarget } from "../choices.ts";
import { currentCause, UNATTRIBUTED } from "../cause.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { effectData, moveEncounter } from "./encounter-moves.ts";
import type { Focus } from "./index.ts";
import { queueFront } from "./play-refs.ts";

type Search = Extract<Instruction, { verb: "SearchShips" }>;

/** SearchShips: the Ship enemy with the highest printed Threat among the encounter deck and its discard pile joins the staging area; with `count` above 1 the
 * next highest follows, a card at a time. */
export function searchShips(state: ScenarioState, instruction: Search, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const count = resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx);
  if (count <= 0) return state;
  const found = [...state.encounterDeck, ...state.encounterDiscard].filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").ship === "enemy");
  const threat = (id: string): number => printedOf(ctx.cards, state.cards[id]?.code ?? "").threat ?? 0;
  const highest = Math.max(-1, ...found.map(threat));
  const tied = found.filter((id) => threat(id) === highest);
  if (tied.length === 0) return state;
  // One option for each distinct card among those tied: copies of one card are the same choice.
  const options = tied.filter((id, at) => tied.findIndex((other) => state.cards[other]?.code === state.cards[id]?.code) === at);
  const chosen = focus.chosen && tied.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (!chosen) return effectData(state) ? askTarget(state, { instruction: { ...instruction, count }, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options) : state;
  const moved = moveEncounter(state, chosen, "staging", focus.seat, ctx, steps);
  if (count <= 1) return moved;
  return queueFront(moved, [{ instruction: { ...instruction, count: count - 1 }, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }]);
}
