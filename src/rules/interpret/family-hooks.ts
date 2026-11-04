// How the core calls the hooks of the mechanic families (docs/architecture.md, Mechanic families): each function walks a family list, RULES_FAMILIES by
// default, so a test can pass its own. A hook returns a new state or the same object, never a changed one.
import type { Amount, Condition, PickSpec } from "../../catalog/boundary.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ScenarioState } from "../core/state.ts";
import type { AmountScope } from "./amounts.ts";
import type { Scope } from "./conditions.ts";
import type { RulesFamily, SettleHook, SettleHooks } from "./family-manifest.ts";
import type { ReduceContext } from "./interpret.ts";
import type { PickContext } from "./pick.ts";

import { RULES_FAMILIES, SETTLE_ORDER } from "../families/index.ts";

export type SettlePhase = keyof SettleHooks;

// The families that have a hook, once per list: the lists are constants, so the walk is not repeated on every call.
const compiled = new WeakMap<readonly RulesFamily[], Map<string, readonly RulesFamily[]>>();

function having(families: readonly RulesFamily[], key: string, has: (family: RulesFamily) => boolean): readonly RulesFamily[] {
  let byKey = compiled.get(families);
  if (!byKey) {
    byKey = new Map();
    compiled.set(families, byKey);
  }
  let found = byKey.get(key);
  if (!found) {
    found = families.filter(has);
    byKey.set(key, found);
  }
  return found;
}

/** The families with a settle hook for the phase: those SETTLE_ORDER names, in its order, then the rest in list order. */
export function settleHooks(phase: SettlePhase, families: readonly RulesFamily[] = RULES_FAMILIES, order: Readonly<Record<SettlePhase, readonly string[]>> = SETTLE_ORDER): readonly SettleHook[] {
  const mine = having(families, `settle.${phase}`, (family) => family.settle?.[phase] != null);
  const named = order[phase].flatMap((name) => mine.filter((family) => family.name === name));
  const rest = mine.filter((family) => !order[phase].includes(family.name));
  return [...named, ...rest].flatMap((family) => (family.settle?.[phase] ? [family.settle[phase]] : []));
}

/** Runs the settle hooks of one phase in order, each on the state the one before returned. */
export function runSettle(phase: SettlePhase, state: ScenarioState, ctx: ReduceContext, steps: EngineStep[], families: readonly RulesFamily[] = RULES_FAMILIES, order: Readonly<Record<SettlePhase, readonly string[]>> = SETTLE_ORDER): ScenarioState {
  let current = state;
  for (const hook of settleHooks(phase, families, order)) current = hook(current, ctx, steps);
  return current;
}

/** Whether some family lets the players travel from where they are. */
export function familyMayTravel(state: ScenarioState, ctx: ReduceContext, families: readonly RulesFamily[] = RULES_FAMILIES): boolean {
  return having(families, "travel.may", (family) => family.travel?.may != null).some((family) => family.travel?.may?.(state, ctx) === true);
}

/** The locations beyond staging that the families let the players travel to. */
export function familyTravelReach(state: ScenarioState, ctx: ReduceContext, families: readonly RulesFamily[] = RULES_FAMILIES): string[] {
  return having(families, "travel.reach", (family) => family.travel?.reach != null).flatMap((family) => family.travel?.reach?.(state, ctx) ?? []);
}

/** False when a family's pick predicate rejects the card. */
export function familyPickMatches(state: ScenarioState, id: string, spec: PickSpec, at: PickContext, ctx: ReduceContext, families: readonly RulesFamily[] = RULES_FAMILIES): boolean {
  return having(families, "pick", (family) => family.pick != null).every((family) => family.pick?.(state, id, spec, at, ctx) !== false);
}

/** The first family's answer to a condition, or null when none owns it. */
export function familyCondition(state: ScenarioState, condition: Condition, scope: Scope, ctx: ReduceContext, families: readonly RulesFamily[] = RULES_FAMILIES): boolean | null {
  for (const family of having(families, "condition", (candidate) => candidate.condition != null)) {
    const answer = family.condition?.(state, condition, scope, ctx);
    if (answer != null) return answer;
  }
  return null;
}

/** The first family's value for an amount, or null when none owns it. */
export function familyAmount(state: ScenarioState, amount: Exclude<Amount, number>, scope: AmountScope, ctx: ReduceContext, families: readonly RulesFamily[] = RULES_FAMILIES): number | null {
  for (const family of having(families, "amount", (candidate) => candidate.amount != null)) {
    const value = family.amount?.(state, amount, scope, ctx);
    if (value != null) return value;
  }
  return null;
}
