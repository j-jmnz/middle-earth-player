// Rules: rr.resources, rr.qualifiers (data/rules/entries.json).
//
// The Pick filters the costs family adds: `minResources` ("Discard 2 resources from your hero's resource pool"), `valour`
// ("an event that has a Valour trigger"), `lowerThreatCost` ("each hero with lower threat cost than the chosen hero") and
// `paidFor` ("if you paid all of its cost from a single hero's resource pool, that hero ...").
import type { PickSpec } from "../../catalog/boundary.ts";

import type { ReduceContext } from "../interpret.ts";
import { effectsOf } from "../listen.ts";
import type { ScenarioState } from "../state.ts";
import { topFrame } from "../windows.ts";
import { threatCostOf } from "./costs-stats.ts";

const VALOUR = new WeakMap<readonly unknown[], Map<string, boolean>>();

// A card with a Valour ability: one of its records asks for a threat of 40 or more (a Valour Action or Response).
export function hasValour(ctx: ReduceContext, code: string): boolean {
  let known = VALOUR.get(ctx.effects);
  if (!known) {
    known = new Map();
    VALOUR.set(ctx.effects, known);
  }
  const cached = known.get(code);
  if (cached != null) return cached;
  const found = effectsOf(ctx, code).some((effect) => /"kind":"threat","min":40[,}]/.test(JSON.stringify(effect)));
  known.set(code, found);
  return found;
}

export function costsPickMatches(state: ScenarioState, id: string, spec: PickSpec, picked: readonly string[] | undefined, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  if (!instance) return false;
  if (spec.minResources != null && instance.resources < spec.minResources) return false;
  if (spec.valour && !hasValour(ctx, instance.code)) return false;
  const data = topFrame(state)?.data;
  const frame = data?.kind === "effect" ? data : undefined;
  if (spec.lowerThreatCost) {
    // The first card the running effect picked ("the chosen hero").
    const first = (picked && picked.length > 0 ? picked : (frame?.picked ?? []))[0];
    if (!first || !state.cards[first] || threatCostOf(state, id, ctx) >= threatCostOf(state, first, ctx)) return false;
  }
  if (spec.paidFor === "subject") {
    const subject = frame?.subject;
    const entry = (state.played ?? []).find((play) => play.id === subject && play.round === state.round);
    if (!entry?.paid?.some((payment) => payment.heroId === id && payment.amount > 0)) return false;
  }
  return true;
}
