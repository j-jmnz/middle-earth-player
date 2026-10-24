import { isStatCondition, type ModifierStat } from "../catalog/boundary.ts";

import { hasTrait } from "./conditions.ts";
import { constantInstructions } from "./constant-records.ts";
import type { ReduceContext } from "./interpret.ts";
import { isCharacterType, printedOf } from "./printed.ts";
import type { CardInstance, Modifier, ScenarioState } from "./state.ts";
import { inPlay, livingSeats, modifierActive } from "./state.ts";

// A constant effect is a rule that holds while its source is in play. The engine turns each ModifyStat
// instruction of one into records on the modifier list, so modifiedStat stays the only reader. The
// records are rebuilt from the effect list, so they follow the source and its conditions.

function cardsInPlay(state: ScenarioState): CardInstance[] {
  return Object.values(state.cards).filter((instance) => inPlay(instance.zone));
}

// Hobbit heroes the source's controller has.
function hobbitHeroes(state: ScenarioState, source: CardInstance, ctx: ReduceContext): number {
  const seat = source.controller ?? state.firstPlayer;
  return (state.seats[seat]?.heroes ?? []).filter((id) => hasTrait(state, id, "Hobbit", ctx)).length;
}

function holders(state: ScenarioState, source: CardInstance, target: string | undefined, ctx: ReduceContext): string[] {
  switch (target) {
    case "heroes":
      return cardsInPlay(state).filter((instance) => printedOf(ctx.cards, instance.code).type === "hero").map((instance) => instance.id);
    case "hobbitCharacters":
      return cardsInPlay(state)
        .filter((instance) => (instance.zone === "heroes" || instance.zone === "play") && isCharacterType(printedOf(ctx.cards, instance.code)) && hasTrait(state, instance.id, "Hobbit", ctx))
        .map((instance) => instance.id);
    case "enemies":
      return cardsInPlay(state).filter((instance) => printedOf(ctx.cards, instance.code).type === "enemy").map((instance) => instance.id);
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
  for (const { source, effect, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "ModifyStat") continue;
    // "for each Hobbit hero you control" is counted here, each time the records are rebuilt.
    const amount = instruction.per === "hobbitHero" ? instruction.amount * hobbitHeroes(state, source, ctx) : instruction.amount;
    if (amount === 0) continue;
    for (const holder of holders(state, source, instruction.target, ctx)) {
      found.push({
        instanceId: holder,
        sourceId: source.id,
        stat: instruction.stat,
        amount,
        until: "whileSourceInPlay",
        origin: effect.id,
        ...(instruction.per && instruction.per !== "hobbitHero" ? { per: instruction.per } : {}),
        ...(isStatCondition(instruction.when) ? { when: instruction.when } : {}),
      });
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
