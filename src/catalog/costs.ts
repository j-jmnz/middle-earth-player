import type { Cost, Effect } from "./effect-schema.ts";

// An effect's costs as a list: a record names one cost or several paid together.
export function costsOf(effect: Pick<Effect, "cost">): readonly Cost[] {
  if (effect.cost == null) return [];
  return Array.isArray(effect.cost) ? effect.cost : [effect.cost];
}

// The cost of one kind, when the effect has it.
export function costOfKind<K extends Cost["kind"]>(effect: Pick<Effect, "cost">, kind: K): Extract<Cost, { kind: K }> | undefined {
  return costsOf(effect).find((cost): cost is Extract<Cost, { kind: K }> => cost.kind === kind);
}
