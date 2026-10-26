import { isStatCondition, type Effect, type Instruction } from "../catalog/boundary.ts";

import { holds } from "./conditions.ts";
import { textBlank } from "./families/attachments-hold.ts";
import { effectsOf } from "./listen.ts";
import type { ReduceContext } from "./interpret.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { inPlay } from "./state.ts";

export type ConstantInstruction = { source: CardInstance; effect: Effect; instruction: Instruction };

// An effect whose condition is "while this card is in the victory display" works from there (141046:A:2): an ability that
// refers to an out-of-play area is active in it (rr.in-play-and-out-of-play).
function fromVictory(effect: Effect): boolean {
  return effect.condition?.kind === "sourceIn" && effect.condition.zone === "victory";
}

// Every instruction of a constant effect whose card is in play and whose effect and instruction
// conditions hold, oldest card in play first. A stat condition (read when the stat is read) is left on the instruction. Restrictions and modifier records both read this.
export function* constantInstructions(state: ScenarioState, ctx: ReduceContext): Generator<ConstantInstruction> {
  const sources = Object.values(state.cards)
    .filter((instance) => inPlay(instance.zone) || instance.zone === "victory")
    .sort((left, right) => left.enteredPlay - right.enteredPlay || left.id.localeCompare(right.id, undefined, { numeric: true }));
  for (const source of sources) {
    // A card whose printed text box is blank has no constant abilities (rr.blank).
    if (textBlank(state, source.id)) continue;
    for (const effect of effectsOf(ctx, source.code)) {
      if (effect.timing !== "constant") continue;
      if ((source.zone === "victory") !== fromVictory(effect)) continue;
      const scope = { actor: source.controller ?? state.firstPlayer, sourceId: source.id, returned: 0 };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      for (const instruction of effect.instructions) {
        if ("when" in instruction && instruction.when && !isStatCondition(instruction.when) && !holds(state, instruction.when, scope, ctx)) continue;
        yield { source, effect, instruction };
      }
    }
  }
}
