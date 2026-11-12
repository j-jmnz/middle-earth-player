// Rules: rr.resources, rr.qualifiers (data/rules/entries.json).
//
// The Pick filters the costs family adds: `minResources` ("Discard 2 resources from your hero's resource pool"), `valour`
// ("an event that has a Valour trigger"), `lowerThreatCost` ("each hero with lower threat cost than the chosen hero") and
// `paidFor` ("if you paid all of its cost from a single hero's resource pool, that hero ...").
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectsOf } from "../../windows/listen.ts";
import type { ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";
import { printedOf } from "../../core/printed.ts";
import { tiedExtreme } from "../../interpret/tied-extreme.ts";
import { threatCostOf } from "./stats.ts";

const VALOUR = new WeakMap<readonly unknown[], Map<string, boolean>>();

// A record asks for the Valour threshold: a `threat` condition marked `valour` with a minimum, in the record's condition or inside an instruction (PlayOnlyIf).
function asksValour(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  const fields = value as Record<string, unknown>;
  if (fields.kind === "threat" && fields.valour === true && typeof fields.min === "number") return true;
  return Object.values(fields).some(asksValour);
}

// A card with a Valour ability: one of its records asks for the Valour threshold (`valour` on a `threat` condition: a Valour Action or Response).
export function hasValour(ctx: ReduceContext, code: string): boolean {
  let known = VALOUR.get(ctx.effects);
  if (!known) {
    known = new Map();
    VALOUR.set(ctx.effects, known);
  }
  const cached = known.get(code);
  if (cached != null) return cached;
  const found = effectsOf(ctx, code).some((effect) => asksValour(effect));
  known.set(code, found);
  return found;
}

// "The highest cost attachment you control" (145041:A:1): of the cards that matched, those with the highest printed cost, one with no printed cost counting as 0; every one when tied, and the chooser decides.
export function highestCost(state: ScenarioState, found: readonly string[], ctx: ReduceContext): string[] {
  return found.length === 0 ? [] : tiedExtreme(found, (id) => {
    const card = state.cards[id];
    return card ? (printedOf(ctx.cards, card.code).cost ?? 0) : 0;
  }, "highest");
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
