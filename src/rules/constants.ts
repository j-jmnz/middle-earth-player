import type { ModifierStat } from "../catalog/boundary.ts";

import { holds } from "./conditions.ts";
import type { ReduceContext } from "./interpret.ts";
import type { CardInstance, Modifier, ScenarioState } from "./state.ts";
import { inPlay, livingSeats, modifierActive } from "./state.ts";

// A constant effect is a rule that holds while its source is in play. The engine turns each ModifyStat
// instruction of one into records on the modifier list, so modifiedStat stays the only reader. The
// records are rebuilt from the effect list, so they follow the source and its conditions.

function holders(state: ScenarioState, source: CardInstance, target: string | undefined): string[] {
  switch (target) {
    case "host":
      return source.host ? [source.host] : [];
    case "table":
      return ["table"];
    case "engagedSeat":
      return source.zone === "engaged" && source.controller != null ? [`seat:${source.controller}`] : [];
    case "eachSeat":
      return livingSeats(state).map((seat) => `seat:${seat}`);
    default:
      return [source.id];
  }
}

function wanted(state: ScenarioState, ctx: ReduceContext): Modifier[] {
  const found: Modifier[] = [];
  const sources = Object.values(state.cards)
    .filter((instance) => inPlay(instance.zone))
    .sort((left, right) => left.enteredPlay - right.enteredPlay || left.id.localeCompare(right.id, undefined, { numeric: true }));
  for (const source of sources) {
    for (const effect of ctx.effects) {
      if (effect.timing !== "constant" || effect.cardCode !== source.code) continue;
      const scope = { actor: source.controller ?? state.firstPlayer, sourceId: source.id, returned: 0 };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      for (const instruction of effect.instructions) {
        if (instruction.verb !== "ModifyStat") continue;
        if (instruction.when && !holds(state, instruction.when, scope, ctx)) continue;
        for (const holder of holders(state, source, instruction.target)) {
          found.push({
            instanceId: holder,
            sourceId: source.id,
            stat: instruction.stat,
            amount: instruction.amount,
            until: "whileSourceInPlay",
            origin: effect.id,
            ...(instruction.per ? { per: instruction.per } : {}),
          });
        }
      }
    }
  }
  return found;
}

export function syncConstants(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const current = state.modifiers.filter((modifier) => modifier.origin != null);
  if (current.length === 0 && !ctx.effects.some((effect) => effect.timing === "constant")) return state;
  const desired = wanted(state, ctx);
  if (JSON.stringify(current) === JSON.stringify(desired)) return state;
  return { ...state, modifiers: [...state.modifiers.filter((modifier) => modifier.origin == null), ...desired] };
}

export type HoldCounts = { committed: number; ally: number };

// A Hide number held by the table or by one seat. `per` modifiers count once for each committed character or ally.
export function heldStat(state: ScenarioState, seat: number, stat: ModifierStat, counts: HoldCounts): number {
  let total = 0;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== stat || !modifierActive(state, modifier)) continue;
    if (modifier.instanceId !== "table" && modifier.instanceId !== `seat:${seat}`) continue;
    total += modifier.amount * (modifier.per === "committed" ? counts.committed : modifier.per === "ally" ? counts.ally : 1);
  }
  return total;
}

export const NO_COUNTS: HoldCounts = { committed: 0, ally: 0 };

// An enemy that cannot attack one seat for now.
export function attackBarred(state: ScenarioState, enemyId: string, seat: number): boolean {
  return state.modifiers.some(
    (modifier) =>
      modifier.stat === "cannotAttack" &&
      modifier.instanceId === enemyId &&
      (modifier.seat == null || modifier.seat === seat) &&
      modifierActive(state, modifier),
  );
}
