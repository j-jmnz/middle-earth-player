// Rules: rr.action, rr.initiating-abilities-playing-cards, rr.resource-match (data/rules/entries.json).
import type { Effect } from "../../catalog/boundary.ts";

import type { ReduceContext } from "../interpret/interpret.ts";
import type { Sphere } from "../core/printed.ts";
import type { ScenarioState } from "../core/state.ts";

// A hero whose constant record is PlayFromDeckTop (Gandalf, 142002): once per phase its controller may play the top card of
// their deck as if it were in their hand, and the hero counts as having these resource icons while it pays for that card.
export type DeckPlay = { heroId: string; effect: Effect; icons: readonly Sphere[] };

function record(ctx: ReduceContext, code: string): { effect: Effect; icons: readonly Sphere[] } | undefined {
  for (const effect of ctx.effects) {
    if (effect.cardCode !== code || effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "PlayFromDeckTop") return { effect, icons: instruction.icons };
  }
  return undefined;
}

// The hero that lets the seat play its top card now: in play, with the permission unspent this phase.
export function deckPlayHero(state: ScenarioState, seat: number, ctx: ReduceContext): DeckPlay | undefined {
  for (const heroId of state.seats[seat]?.heroes ?? []) {
    const hero = state.cards[heroId];
    const found = hero ? record(ctx, hero.code) : undefined;
    if (!hero || !found) continue;
    const spent = state.uses.some((use) => use.effectId === found.effect.id && use.sourceId === heroId && use.round === state.round && use.phase === state.phase);
    if (!spent) return { heroId, effect: found.effect, icons: found.icons };
  }
  return undefined;
}

// The icons the hero is considered to have while it pays for this card: all of them when the card is the top of the deck of
// the hero's controller and the hero carries the permission, none otherwise.
export function deckPlayIcons(state: ScenarioState, heroId: string, cardId: string, ctx: ReduceContext): readonly Sphere[] {
  const hero = state.cards[heroId];
  const card = state.cards[cardId];
  if (!hero || !card || card.zone !== "deck" || hero.controller == null || state.seats[hero.controller]?.deck[0] !== cardId) return [];
  return record(ctx, hero.code)?.icons ?? [];
}

export function markDeckPlay(state: ScenarioState, deckPlay: DeckPlay): ScenarioState {
  return { ...state, uses: [...state.uses, { effectId: deckPlay.effect.id, sourceId: deckPlay.heroId, round: state.round, phase: state.phase }] };
}

// Whether the card is the one the seat may play from the top of its deck now.
export function playableFromDeck(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): boolean {
  return state.seats[seat]?.deck[0] === cardId && deckPlayHero(state, seat, ctx) !== undefined;
}
