// Rules: rr.attachment-cards (data/rules/entries.json).
//
// The attachments family's Pick filters (effect-schema-pick.ts): a card attached to a card in play or to nothing ("If
// unattached"), a card with the Guarded keyword, a card with or without progress tokens.
import type { PickSpec } from "../../catalog/boundary.ts";

import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";
import { inPlay } from "../state.ts";
import { guardedRule } from "./attachments-play.ts";

export function attachmentsPickMatches(state: ScenarioState, id: string, spec: PickSpec, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  if (!instance) return false;
  if (spec.attached != null && (instance.host != null && inPlay(instance.zone)) !== spec.attached) return false;
  if (spec.guarded != null && (guardedRule(ctx, instance.code) != null) !== spec.guarded) return false;
  if (spec.progress != null && instance.progress > 0 !== spec.progress) return false;
  return true;
}
