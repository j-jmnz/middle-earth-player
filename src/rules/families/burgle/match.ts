// Rules: hob.burgle (data/rules/entries.json); ledger lines 132042:A:3, 132044:A:2, 132046:A:2, 132047:A:2, 132048:A:3, 132049:A:2, 132050:A:2. A burgle effect and what "matches the revealed card" means (docs/scenarios/the-hobbit/the-lonely-mountain.md, The Lonely Mountain: sphere with the same sphere, neutral with neutral and
// Baggins with Baggins; type with the same card type; cost with an equal printed cost, an X cost matching nothing).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { Frame, ScenarioState } from "../../core/state.ts";
import { effectsOf } from "../../windows/listen.ts";

export type BurgleEffectLine = Extract<Instruction, { verb: "BurgleEffect" }>;

/** The burgle effect a card prints (its `BurgleEffect` marker), or undefined for a card with none. Read only for the card step 1 of an attempt stops at. */
export function burgleEffectOf(ctx: ReduceContext, code: string): BurgleEffectLine | undefined {
  for (const effect of effectsOf(ctx, code)) {
    for (const instruction of effect.instructions) if (instruction.verb === "BurgleEffect") return instruction;
  }
  return undefined;
}

/** Whether the card with this id shares with the revealed card what the burgle effect names: every named trait must match. */
export function matchesRevealed(state: ScenarioState, id: string, revealedId: string, effect: BurgleEffectLine, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  const revealed = state.cards[revealedId];
  if (!card || !revealed || id === revealedId) return false;
  const printed = printedOf(ctx.cards, card.code);
  const other = printedOf(ctx.cards, revealed.code);
  return effect.match.every((trait) => {
    if (trait === "sphere") return printed.sphere != null && printed.sphere === other.sphere;
    if (trait === "type") return printed.type === other.type;
    return printed.cost != null && !printed.costX && !other.costX && printed.cost === other.cost;
  });
}

/** The cards of the seat's hand that match the revealed card, in hand order. */
export function matchingHand(state: ScenarioState, seat: number, revealedId: string | null, effect: BurgleEffectLine, ctx: ReduceContext): string[] {
  if (revealedId == null) return [];
  return (state.seats[seat]?.hand ?? []).filter((id) => matchesRevealed(state, id, revealedId, effect, ctx));
}

/** The burgle frame nearest the top of the stack, or undefined with no attempt going on. */
export function nearestBurgle(state: ScenarioState): { frame: Frame & { data: Extract<Frame["data"], { kind: "burgle" }> }; index: number } | undefined {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const frame = state.stack[index];
    if (frame && frame.data.kind === "burgle") return { frame: frame as Frame & { data: Extract<Frame["data"], { kind: "burgle" }> }, index };
  }
  return undefined;
}
