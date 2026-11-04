// Rules: mec109.setup (data/rules/entries.json).
import type { Effect } from "../../catalog/boundary.ts";

import type { EngineStep } from "../core/intents.ts";
import { runEffect, runInstruction, type ReduceContext } from "../interpret/interpret.ts";
import type { ScenarioState } from "../core/state.ts";
import { withFrame } from "../windows/windows.ts";
import { moveCard } from "../core/zones.ts";

export function searchSetup(
  state: ScenarioState,
  kind: "player" | "encounter",
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const effects = ctx.effects.filter((effect) => effect.timing === "setup");
  if (effects.length === 0) return state;
  let next = state;
  for (const effect of effects) {
    const found = setupIds(next, effect.cardCode, kind);
    for (const foundId of found) {
      const seat = next.cards[foundId]?.controller ?? next.firstPlayer;
      next = moveCard(next, foundId, { zone: "setAside" });
      next = runEffectBody(next, effect, foundId, seat, ctx, steps);
      if (next.failure || next.lost) return next;
    }
  }
  return next;
}

function runEffectBody(
  state: ScenarioState,
  effect: Effect,
  sourceId: string,
  seat: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  return withFrame(state, "setup", sourceId, false, (framed) => {
    return runEffect(framed, effect, sourceId, seat, ctx, steps);
  }, steps);
}

function setupIds(state: ScenarioState, code: string, kind: "player" | "encounter"): string[] {
  if (kind === "encounter") {
    return state.encounterDeck.filter((id) => state.cards[id]?.code === code);
  }
  const ids: string[] = [];
  for (let seat = 0; seat < state.seatCount; seat += 1) {
    for (const id of state.seats[seat]?.deck ?? []) {
      if (state.cards[id]?.code === code) ids.push(id);
    }
  }
  return ids;
}

// Setup text that changes the starting hand has to count before anyone draws. The booklet orders player
// Setup before the hand, and encounter Setup before the quest card's Setup; a card that the quest card's
// Setup puts out (so it is not in the encounter deck) still applies its hand sentence at this point,
// because the sentence cannot change a hand that was already drawn. Only the hand instructions run here;
// the card's placement stays with the quest card's Setup, so nothing is placed twice. A card that is in the encounter
// deck at the beginning of the game (Gandalf's Delay shuffled in from the campaign pool) applies its hand sentence here
// too, and is placed by the encounter search after the hands are drawn (mec109.setup).
export function handSetup(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const named = new Set(state.setup.flatMap((instruction) => ("code" in instruction ? [instruction.code] : [])));
  for (const id of state.encounterDeck) {
    const code = state.cards[id]?.code;
    if (code) named.add(code);
  }
  let next = state;
  for (const effect of ctx.effects) {
    if (effect.timing !== "setup") continue;
    const hand = effect.instructions.filter((instruction) => instruction.verb === "ReduceOpeningHand");
    if (hand.length === 0) continue;
    if (!named.has(effect.cardCode)) continue;
    for (const instruction of hand) {
      next = runInstruction(next, instruction, { seat: next.firstPlayer, sourceId: null }, ctx, steps);
    }
  }
  return next;
}
