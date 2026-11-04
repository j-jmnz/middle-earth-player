// Rules: rr.triggering-condition, rr.timing-of-ability-resolution (data/rules/entries.json).
// The events the quest family announces are queued only while some card in the game has a record that hears them, so a game
// without those cards keeps the same pending events and steps as before (the golden games pin them).
import type { Effect, Trigger } from "../../../catalog/boundary.ts";

import type { GameEvent } from "../../windows/frame-types.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";

// The codes of the cards with a record on each trigger, built once per effect list.
const LISTENERS = new WeakMap<readonly Effect[], ReadonlyMap<string, ReadonlySet<string>>>();

function listeners(effects: readonly Effect[], trigger: Trigger): ReadonlySet<string> | undefined {
  let index = LISTENERS.get(effects);
  if (!index) {
    const built = new Map<string, Set<string>>();
    for (const effect of effects) {
      if (!effect.trigger) continue;
      const codes = built.get(effect.trigger) ?? new Set<string>();
      codes.add(effect.cardCode);
      built.set(effect.trigger, codes);
    }
    index = built;
    LISTENERS.set(effects, index);
  }
  return index.get(trigger);
}

// Some card of the game, wherever it is, has a Response, Forced or triggered record on this trigger.
export function heard(state: ScenarioState, ctx: { effects: readonly Effect[] }, trigger: Trigger): boolean {
  const codes = listeners(ctx.effects, trigger);
  return codes != null && Object.values(state.cards).some((card) => codes.has(card.code));
}

export function queueHeard(state: ScenarioState, ctx: { effects: readonly Effect[] }, event: GameEvent): ScenarioState {
  return heard(state, ctx, event.trigger) ? queueEvent(state, event) : state;
}
