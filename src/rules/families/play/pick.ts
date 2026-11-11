// Rules: rr.traits (data/rules/entries.json).
//
// The Pick filter the play family adds: `sharesTrait` `self` and `host` ("if that character shares at least one Trait with the attached
// hero", 22035:A:2). A trait an attachment gives counts (hasTrait).
import type { PickSpec } from "../../../catalog/boundary.ts";

import { grantedTraits, hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";

// `heroSphere`: the card's printed sphere is one of the spheres of the heroes `seat` controls; a neutral card and a Fellowship hero match none.
function matchesHeroSphere(state: ScenarioState, id: string, seat: number, ctx: ReduceContext): boolean {
  const sphere = printedOf(ctx.cards, state.cards[id]?.code ?? "").sphere;
  if (sphere == null || sphere === "neutral" || sphere === "fellowship") return false;
  return (state.seats[seat]?.heroes ?? []).some((hero) => printedOf(ctx.cards, state.cards[hero]?.code ?? "").sphere === sphere);
}

export function playPickMatches(state: ScenarioState, id: string, spec: PickSpec, sourceId: string | null, ctx: ReduceContext, seat: number): boolean {
  if (spec.heroSphere && !matchesHeroSphere(state, id, seat, ctx)) return false;
  if (spec.sharesTrait !== "self" && spec.sharesTrait !== "host") return true;
  const source = sourceId ? state.cards[sourceId] : undefined;
  const other = spec.sharesTrait === "self" ? source : source?.host ? state.cards[source.host] : undefined;
  if (!other || other.id === id) return false;
  const traits = [...printedOf(ctx.cards, other.code).traits, ...grantedTraits(state, other.id, ctx)];
  return traits.some((trait) => hasTrait(state, id, trait, ctx));
}
