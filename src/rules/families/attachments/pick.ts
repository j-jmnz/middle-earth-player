// Rules: rr.attachment-cards (data/rules/entries.json).
//
// The attachments family's Pick filters (effect-schema-pick.ts): a card attached to a card in play or to nothing ("If
// unattached"), a card with the Guarded keyword, a card with or without progress tokens, a card the source can attach to.
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";
import { attachBlocked } from "../../interpret/restrictions.ts";
import { guardedRule } from "./play.ts";

export function attachmentsPickMatches(state: ScenarioState, id: string, spec: PickSpec, ctx: ReduceContext, sourceId: string | null): boolean {
  const instance = state.cards[id];
  if (!instance) return false;
  if (spec.attached != null && (instance.host != null && inPlay(instance.zone)) !== spec.attached) return false;
  if (spec.guarded != null && (guardedRule(ctx, instance.code) != null) !== spec.guarded) return false;
  if (spec.progress != null && instance.progress > 0 !== spec.progress) return false;
  // A card the source may attach to: one that cannot have attachments is not offered (Hired Muscle on a Suspect, 50726:A:2).
  if (spec.takesSource === true && sourceId != null && attachBlocked(state, ctx, id, state.cards[sourceId]?.code ?? "")) return false;
  return true;
}
