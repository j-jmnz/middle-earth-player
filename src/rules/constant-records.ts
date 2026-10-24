import type { Effect, Instruction } from "../catalog/boundary.ts";

import { holds } from "./conditions.ts";
import type { ReduceContext } from "./interpret.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { inPlay } from "./state.ts";

export type ConstantInstruction = { source: CardInstance; effect: Effect; instruction: Instruction };

// Every instruction of a constant effect whose card is in play and whose effect and instruction
// conditions hold, oldest card in play first. Restrictions and modifier records both read this.
export function* constantInstructions(state: ScenarioState, ctx: ReduceContext): Generator<ConstantInstruction> {
  const sources = Object.values(state.cards)
    .filter((instance) => inPlay(instance.zone))
    .sort((left, right) => left.enteredPlay - right.enteredPlay || left.id.localeCompare(right.id, undefined, { numeric: true }));
  for (const source of sources) {
    for (const effect of ctx.effects) {
      if (effect.timing !== "constant" || effect.cardCode !== source.code) continue;
      const scope = { actor: source.controller ?? state.firstPlayer, sourceId: source.id, returned: 0 };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      for (const instruction of effect.instructions) {
        if ("when" in instruction && instruction.when && !holds(state, instruction.when, scope, ctx)) continue;
        yield { source, effect, instruction };
      }
    }
  }
}
