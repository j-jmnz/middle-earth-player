// Rules: rr.discard-pile-and-victory-display, rr.victory, rr.limits (data/rules/entries.json).
//
// The victory display: a card added to it by an effect (a side quest defeated, an event or attachment that adds itself, a
// card searched out of the encounter deck) goes there unless its own text limits the copies the display may hold.
import type { ReduceContext } from "../../interpret.ts";
import { effectsOf } from "../../listen.ts";
import { fromEncounterDeck, printedOf } from "../../printed.ts";
import type { ScenarioState } from "../../state.ts";
import { moveCard } from "../../zones.ts";

// "Limit 3 copies of ~ in the victory display": the most copies of the card's title the display holds, or null.
export function victoryLimit(ctx: Pick<ReduceContext, "effects">, code: string): number | null {
  let limit: number | null = null;
  for (const effect of effectsOf(ctx, code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "VictoryLimit") limit = Math.min(limit ?? instruction.copies, instruction.copies);
  }
  return limit;
}

// Whether the display already holds as many copies of the card as its limit allows.
export function victoryFull(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  if (!card) return false;
  const limit = victoryLimit(ctx, card.code);
  if (limit == null) return false;
  const name = printedOf(ctx.cards, card.code).name;
  return state.victory.filter((other) => other !== id && printedOf(ctx.cards, state.cards[other]?.code ?? card.code).name === name).length >= limit;
}

// Adds the card to the victory display. Beyond its limit it cannot be added: a player card goes to its owner's discard pile
// instead, an encounter card to the encounter discard pile (rr.discard-pile-and-victory-display).
export function addToVictory(state: ScenarioState, id: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[id];
  if (!card || card.zone === "victory") return state;
  if (!victoryFull(state, id, ctx)) return moveCard(state, id, { zone: "victory" });
  const seat = card.owner ?? card.controller;
  if (fromEncounterDeck(printedOf(ctx.cards, card.code)) || seat == null) return moveCard(state, id, { zone: "encounterDiscard" });
  return moveCard(state, id, { zone: "discard", seat });
}
