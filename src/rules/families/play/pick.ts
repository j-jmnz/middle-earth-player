// Rules: rr.traits (data/rules/entries.json).
//
// The Pick filter the play family adds: `sharesTrait` `self` and `host` ("if that character shares at least one Trait with the attached
// hero", 22035:A:2). A trait an attachment gives counts (hasTrait).
import type { PickSpec } from "../../../catalog/boundary.ts";

import { grantedTraits, hasTrait } from "../../conditions.ts";
import type { ReduceContext } from "../../interpret.ts";
import { printedOf } from "../../printed.ts";
import type { ScenarioState } from "../../state.ts";

export function playPickMatches(state: ScenarioState, id: string, spec: PickSpec, sourceId: string | null, ctx: ReduceContext): boolean {
  if (spec.sharesTrait !== "self" && spec.sharesTrait !== "host") return true;
  const source = sourceId ? state.cards[sourceId] : undefined;
  const other = spec.sharesTrait === "self" ? source : source?.host ? state.cards[source.host] : undefined;
  if (!other || other.id === id) return false;
  const traits = [...printedOf(ctx.cards, other.code).traits, ...grantedTraits(state, other.id, ctx)];
  return traits.some((trait) => hasTrait(state, id, trait, ctx));
}
