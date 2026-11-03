import { isStatCondition, type Effect, type Instruction } from "../../catalog/boundary.ts";

import { holds } from "./conditions.ts";
import { textBlank } from "../families/attachments/hold.ts";
import { effectsOfCard } from "../families/misc/text.ts";
import type { ReduceContext } from "./interpret.ts";
import type { CardInstance, ScenarioState } from "../core/state.ts";
import { inPlay } from "../core/state.ts";

export type ConstantInstruction = { source: CardInstance; effect: Effect; instruction: Instruction };

// An effect whose condition is "while this card is in the victory display" works from there (141046:A:2): an ability that
// refers to an out-of-play area is active in it (rr.in-play-and-out-of-play).
function fromVictory(effect: Effect): boolean {
  return effect.condition?.kind === "sourceIn" && effect.condition.zone === "victory";
}

// A value that depends only on a state and the context it is read with, kept for as long as that state lives. A state is
// never changed once the reducer returns it (docs/architecture.md, State), so the same state always gives the same value.
export type StateMemo<T> = WeakMap<ScenarioState, WeakMap<ReduceContext, T>>;

export function memoOf<T>(memo: StateMemo<T>, state: ScenarioState, ctx: ReduceContext, build: () => T): T {
  let byCtx = memo.get(state);
  if (!byCtx) {
    byCtx = new WeakMap();
    memo.set(state, byCtx);
  }
  if (byCtx.has(ctx)) return byCtx.get(ctx) as T;
  const built = build();
  byCtx.set(ctx, built);
  return built;
}

const CONSTANTS: StateMemo<readonly ConstantInstruction[]> = new WeakMap();

// Every instruction of a constant effect whose card is in play and whose effect and instruction
// conditions hold, oldest card in play first. A stat condition (read when the stat is read) is left on the instruction. Restrictions and modifier records both read this.
// The list is built once for each state: `settle` and every legality check ask the same question of the same state many times.
export function constantInstructions(state: ScenarioState, ctx: ReduceContext): readonly ConstantInstruction[] {
  return memoOf(CONSTANTS, state, ctx, () => Array.from(scanConstants(state, ctx)));
}

function* scanConstants(state: ScenarioState, ctx: ReduceContext): Generator<ConstantInstruction> {
  const sources = Object.values(state.cards)
    .filter((instance) => inPlay(instance.zone) || instance.zone === "victory")
    .sort((left, right) => left.enteredPlay - right.enteredPlay || left.id.localeCompare(right.id, undefined, { numeric: true }));
  for (const source of sources) {
    // A card whose printed text box is blank has no constant abilities (rr.blank).
    if (textBlank(state, source.id)) continue;
    for (const effect of effectsOfCard(state, ctx, source)) {
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
