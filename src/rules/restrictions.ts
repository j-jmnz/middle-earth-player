import type { Instruction } from "../catalog/boundary.ts";

import { holds } from "./conditions.ts";
import type { ReduceContext } from "./interpret.ts";
import { printedOf } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { inPlay } from "./state.ts";

type Restrict = Extract<Instruction, { verb: "Restrict" }>;
export type Restriction = { sourceId: string; what: Restrict["what"]; exceptTrait?: string };

// Rules from constant effects that forbid something. The question names what is being asked about, and
// each record names the card it came from, so a caller can tell whose rule it is.
export function restricted(state: ScenarioState, ctx: ReduceContext, what: Restrict["what"]): Restriction[] {
  const found: Restriction[] = [];
  for (const source of Object.values(state.cards)) {
    if (!inPlay(source.zone)) continue;
    for (const effect of ctx.effects) {
      if (effect.timing !== "constant" || effect.cardCode !== source.code) continue;
      const scope = { actor: source.controller ?? state.firstPlayer, sourceId: source.id, returned: 0 };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      for (const instruction of effect.instructions) {
        if (instruction.verb !== "Restrict" || instruction.what !== what) continue;
        if (instruction.when && !holds(state, instruction.when, scope, ctx)) continue;
        found.push({ sourceId: source.id, what, ...(instruction.exceptTrait ? { exceptTrait: instruction.exceptTrait } : {}) });
      }
    }
  }
  return found;
}

export function travelBlocked(state: ScenarioState, ctx: ReduceContext, locationId: string): boolean {
  return restricted(state, ctx, "travel").some((rule) => rule.sourceId === locationId);
}

export function attachBlocked(state: ScenarioState, ctx: ReduceContext, hostId: string, attachmentCode: string): boolean {
  const traits = printedOf(ctx.cards, attachmentCode).traits;
  return restricted(state, ctx, "attach").some(
    (rule) => rule.sourceId === hostId && !(rule.exceptTrait != null && traits.includes(rule.exceptTrait)),
  );
}

// The hero does not count against the hero limit while a card attached to it says so.
export function heroLimitExempt(state: ScenarioState, ctx: ReduceContext, heroId: string): boolean {
  return restricted(state, ctx, "heroLimit").some((rule) => state.cards[rule.sourceId]?.host === heroId);
}
