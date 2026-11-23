// Rules: rr.forced, rr.running-out-of-cards (data/rules/entries.json); ledger line 131024:B:1 ("Forced: If there are no cards left in the encounter deck, advance"). The recorded reading (docs/scenarios/the-hobbit.md, We Must Away, Ere Break of Day):
// an empty encounter deck advances the stage the moment it is empty, before any reset of the deck. A record with the trigger `encounterDeckEmpty` hears the event this settle hook queues whenever the deck is empty and no effect is resolving (the
// event waits for the open frames, windows.ts canAnnounce); resetEncounterDeck holds back the quest phase reset while such a card is in play, so the Forced effect runs first.
import type { Effect } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";
import { queueEvent } from "../../windows/queue.ts";
import { effectsOfCard } from "../misc/text.ts";

// Whether any record of the list hears the event: read once for each effect list (a scenario without one skips the walk of the table).
const LISTENED = new WeakMap<readonly Effect[], boolean>();
const listened = (effects: readonly Effect[]): boolean => {
  const known = LISTENED.get(effects);
  if (known !== undefined) return known;
  const found = effects.some((effect) => effect.trigger === "encounterDeckEmpty");
  LISTENED.set(effects, found);
  return found;
};

/** A card in play has a record that hears `encounterDeckEmpty` (its current side's), and the encounter deck is empty now. */
export function hearsEmptyDeck(state: ScenarioState, ctx: ReduceContext): boolean {
  if (state.encounterDeck.length > 0 || !listened(ctx.effects)) return false;
  return Object.values(state.cards).some((card) => inPlay(card.zone) && effectsOfCard(state, ctx, card).some((effect) => effect.trigger === "encounterDeckEmpty"));
}

/** The settle hook: an empty deck that a card in play hears is announced when no frame is open (no effect is resolving), once: the Forced effect it opens is a frame, so the next pass does not announce it again. */
export function announceEmptyDeck(state: ScenarioState, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState {
  if (state.lost || state.stageCleared || state.failure || !hearsEmptyDeck(state, ctx)) return state;
  if (state.stack.length > 0 || state.pendingEvents?.some((event) => event.trigger === "encounterDeckEmpty")) return state;
  return queueEvent(state, { trigger: "encounterDeckEmpty", seat: null });
}
