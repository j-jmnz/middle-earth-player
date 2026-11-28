// Rules: rr.destroy, rr.damage, rr.attachment-cards (data/rules/entries.json); ledger line 22019:A:2.
// "Forced: When attached enemy would be destroyed, heal all damage from it and discard Fury instead": the enemy that holds the flag `healsInsteadOfDestroyed` (granted by a constant record of the attachment, target host) is not destroyed; all damage comes off it and the attachment is discarded.
import type { EngineStep } from "../../core/intents.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { modifierActive, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

/** The state after the enemy healed instead of being destroyed, or null when it holds no such flag (every other game: one flag test). The destruction is replaced whole: no victory display, no `characterDestroyed` or `enemyDestroyed` event, no attachment released but the one that did it. */
export function healedInsteadOfDestroyed(state: ScenarioState, instance: CardInstance, steps: EngineStep[]): ScenarioState | null {
  if (state.modifiers.length === 0) return null;
  const grant = state.modifiers.find((modifier) => modifier.stat === "healsInsteadOfDestroyed" && modifier.instanceId === instance.id && modifierActive(state, modifier));
  const source = grant ? state.cards[grant.sourceId] : undefined;
  if (!source) return null;
  steps.push({ kind: "destroy", targetId: source.id });
  const healed = updateCard(state, instance.id, { damage: 0 });
  return updateCard(moveCard(healed, source.id, { zone: "encounterDiscard" }), source.id, { face: "up", controller: null, host: null });
}
