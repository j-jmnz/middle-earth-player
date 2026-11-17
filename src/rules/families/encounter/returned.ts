// Rules: rr.encounter-deck, rr.staging, rr.then (data/rules/entries.json); ledger lines 900810:A:1, 04020:A:1, 901308:A:1. Cards returned from the encounter discard pile to the staging area or the top of the encounter deck.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";
import { shuffleIds } from "../../core/seed.ts";
import { effectData, moveEncounter, typeOf } from "./moves.ts";

/**
 * ReturnFromDiscard: the topmost cards with the Trait in the encounter discard pile (the last placed first), up to `count` (all of them without one), go to the staging area and are counted as returned: enemies only, unless `anyType`.
 * With `to: "deckTop"` they go on top of the encounter deck instead, not revealed (the most recent one on top, or in a random order with `order: "random"`) and are the cards the effect's ArrangeEncounter may put in another order (04020:A:1, 901308:A:1).
 * `treacheries` counts only the treachery cards among them as returned.
 */
export function returnFromDiscard(state: ScenarioState, instruction: Extract<Instruction, { verb: "ReturnFromDiscard" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const count = instruction.count == null ? Infinity : Math.max(0, resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx));
  const ids = [...state.encounterDiscard].reverse().filter((id) => (instruction.anyType === true || typeOf(state, id, ctx) === "enemy") && hasTrait(state, id, instruction.trait, ctx)).slice(0, count);
  let next = state;
  let order = ids;
  if (instruction.to === "deckTop") {
    if (instruction.order === "random") {
      const shuffled = shuffleIds(ids, next.seed, next.seedCursor);
      order = shuffled.ids;
      next = { ...next, seedCursor: shuffled.cursor };
    }
    // The first of `order` ends on top: the cards go one after another onto the top.
    for (const id of [...order].reverse()) next = moveEncounter(next, id, "deckTop", focus.seat, ctx, steps);
    const data = effectData(next);
    if (data) next = patchTop(next, { data: { ...data, looked: order } });
  } else {
    for (const id of ids) next = moveEncounter(next, id, "staging", focus.seat, ctx, steps);
  }
  const counted = instruction.treacheries === true ? ids.filter((id) => typeOf(state, id, ctx) === "treachery").length : ids.length;
  const data = topFrame(next)?.data;
  return data?.kind === "effect" ? patchTop(next, { data: { ...data, returned: data.returned + counted } }) : next;
}
