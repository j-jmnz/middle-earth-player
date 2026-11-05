// Rules: rr.search, rr.the-word-choose, rr.play-and-put-into-play (data/rules/entries.json).
//
// "Search the top 10 cards of your deck for up to 4 Rohan allies and put them into play", "any number of Gondor allies",
// "Put up to 2 allies discarded by this effect into play ... The total cost ... cannot exceed ...", "discard any number of
// cards from your hand": an Each with `upTo`. The actor chooses the cards one at a time (nothing moves while they choose, so
// the searched cards stay the same) and may stop with "done"; then the instructions run for each chosen card, and the
// effect's X becomes how many were chosen.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { askTarget } from "../../windows/choices.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { feedsDiscard, pickCandidates } from "../../interpret/pick.ts";
import { printedOf } from "../../core/printed.ts";
import type { Frame, QueueItem, ScenarioState } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

type EachInstruction = Extract<Instruction, { verb: "Each" }>;

/** The option that stops choosing. */
export const DONE = "done";

function distinctByCode(state: ScenarioState, ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const code = state.cards[id]?.code ?? id;
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

function costOf(state: ScenarioState, id: string, ctx: ReduceContext): number {
  return printedOf(ctx.cards, state.cards[id]?.code ?? "").cost ?? 0;
}

// The cards still to choose from: they match, are not chosen yet, would not be a second copy of a unique card put into play,
// and keep the chosen cards' total cost within the budget.
function remaining(state: ScenarioState, instruction: EachInstruction, taken: readonly string[], seat: number, sourceId: string | null, ctx: ReduceContext): string[] {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect") return [];
  const found = pickCandidates(state, instruction.pick, seat, data.picked ?? [], sourceId, ctx, data.x, data.participants, false, { discards: feedsDiscard(instruction.instructions) });
  const names = new Set(taken.map((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "")).filter((printed) => printed.isUnique).map((printed) => printed.name));
  const budget = instruction.totalCost == null ? null : resolveAmount(state, instruction.totalCost, frameScope(state, seat, sourceId), ctx);
  const spent = taken.reduce((sum, id) => sum + costOf(state, id, ctx), 0);
  return found.filter((id) => {
    if (taken.includes(id)) return false;
    const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
    if (instruction.pick.intoPlay && printed.isUnique && names.has(printed.name)) return false;
    return budget == null || spent + costOf(state, id, ctx) <= budget;
  });
}

/** Runs an Each with `upTo` for the queue item: asks for the next card, or, once the actor stops (or no card or no choice is
 * left), queues the instructions for each chosen card. */
export function chooseEach(state: ScenarioState, item: QueueItem, frame: Pick<Frame, "cardId">, ctx: ReduceContext): ScenarioState {
  const instruction = item.instruction;
  const data = topFrame(state)?.data;
  if (instruction.verb !== "Each" || instruction.upTo == null || data?.kind !== "effect") return state;
  const taken = item.chosen && item.chosen !== DONE ? [...(instruction.taken ?? []), item.chosen] : [...(instruction.taken ?? [])];
  const limit = instruction.upTo === "any" ? Number.POSITIVE_INFINITY : typeof instruction.upTo === "number" ? instruction.upTo : resolveAmount(state, instruction.upTo, frameScope(state, item.seat, frame.cardId), ctx);
  const options = item.chosen === DONE || taken.length >= limit ? [] : remaining(state, instruction, taken, item.seat, frame.cardId, ctx);
  if (options.length > 0) return askTarget(state, { ...item, instruction: { ...instruction, taken }, chosen: null }, [...distinctByCode(state, options), DONE]);
  const cause = item.cause ? { cause: item.cause } : {};
  const pick = { verb: "Pick" as const, pick: instruction.pick };
  const expanded = taken.flatMap((id): QueueItem[] => [
    { instruction: pick, seat: item.seat, chosen: id, ...cause },
    ...instruction.instructions.map((entry): QueueItem => ({ instruction: entry, seat: item.seat, chosen: null, ...cause })),
  ]);
  return patchTop(state, { data: { ...data, x: taken.length, queue: [...expanded, ...data.queue] } });
}
