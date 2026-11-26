// Rules: faq.simultaneous-effects, rr.hit-points, rr.ownership-and-control (data/rules/entries.json); ledger line 06074:A:1.
// "Discard the character with the fewest remaining hit points. That character's controller may ...": the heroes and the allies in play, any player's (Lord Alcaron too), are measured by the hit points they have left, as modified; the first player chooses among those tied.
// The player who controls the card picked then acts for the instructions that follow, so the prevention is his choice and his hand.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { askTarget } from "../../windows/choices.ts";
import { reseatQueue } from "../deck/moves.ts";
import { markPicked } from "../play/refs.ts";
import type { Focus } from "../index.ts";

/** PickFewestHitPointsLeft: of the characters in play the one with the fewest hit points left becomes the picked card, and its controller the acting player of the rest of the effect. Nothing is picked when no character is in play. */
export function pickFewestHitPointsLeft(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const candidates = pickCandidates(state, { type: "character", control: "any" }, focus.seat, [], focus.sourceId, ctx);
  if (candidates.length === 0) return state;
  const left = (id: string): number => {
    const card = state.cards[id];
    return card ? Math.max(0, modifiedStat(state, card, "hitPoints", ctx.cards) - card.damage) : Number.POSITIVE_INFINITY;
  };
  const fewest = Math.min(...candidates.map(left));
  const tied = candidates.filter((id) => left(id) === fewest);
  const chosen = focus.chosen && tied.includes(focus.chosen) ? focus.chosen : tied.length === 1 ? tied[0] : undefined;
  if (!chosen) return askTarget(state, { instruction: { verb: "PickFewestHitPointsLeft" } as Instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, tied);
  const picked = markPicked(state, chosen);
  const seat = picked.cards[chosen]?.controller;
  return seat == null ? picked : reseatQueue(picked, seat);
}
