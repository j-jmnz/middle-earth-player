// Rules: rr.traits (data/rules/entries.json).
//
// The Pick filter the play family adds: `sharesTrait` `self` and `host` ("if that character shares at least one Trait with the attached
// hero", 22035:A:2). A trait the card gains counts, from an attachment or a modifier (traitsOf: "Lothíriel gains the Rohan trait", 22027:A:2).
import type { PickSpec } from "../../../catalog/boundary.ts";

import { characters } from "../../combat/combat.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import { traitsOf } from "../misc/traits.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";

// `heroSphere`: the card's printed sphere is one of the spheres of the heroes `seat` controls; a neutral card and a Fellowship hero match none.
function matchesHeroSphere(state: ScenarioState, id: string, seat: number, ctx: ReduceContext): boolean {
  const sphere = printedOf(ctx.cards, state.cards[id]?.code ?? "").sphere;
  if (sphere == null || sphere === "neutral" || sphere === "fellowship") return false;
  return (state.seats[seat]?.heroes ?? []).some((hero) => printedOf(ctx.cards, state.cards[hero]?.code ?? "").sphere === sphere);
}

// `soleMostDamaged`: this character has damage on it and more than every other character of every player in play, Wilyador and the heroes and allies alike.
function hasMostDamage(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const own = state.cards[id]?.damage ?? 0;
  if (own <= 0) return false;
  for (let seat = 0; seat < state.seatCount; seat += 1) {
    for (const other of characters(state, seat, ctx.cards)) if (other !== id && (state.cards[other]?.damage ?? 0) >= own) return false;
  }
  return true;
}

export function playPickMatches(state: ScenarioState, id: string, spec: PickSpec, sourceId: string | null, ctx: ReduceContext, seat: number): boolean {
  if (spec.soleMostDamaged && !hasMostDamage(state, id, ctx)) return false;
  if (spec.heroSphere && !matchesHeroSphere(state, id, seat, ctx)) return false;
  if (spec.sharesTrait !== "self" && spec.sharesTrait !== "host") return true;
  const source = sourceId ? state.cards[sourceId] : undefined;
  const other = spec.sharesTrait === "self" ? source : source?.host ? state.cards[source.host] : undefined;
  if (!other || other.id === id) return false;
  return traitsOf(state, other.id, ctx).some((trait) => hasTrait(state, id, trait, ctx));
}
