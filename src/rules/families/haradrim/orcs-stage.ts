// Rules: hrd.orcs-area, rr.quest-advancement, faq.triggering-forced-effects (data/rules/entries.json); ledger lines 17045:A:3, 17050:B:2, 17051:B:2, 17052:B:2, 17053:B:2, 17054:B:2, 17052:B:3, 17053:B:3, 17054:B:3. The Orcs' quest stage: the progress
// the Orcs place on it at the end of each quest phase and the progress cards place on it, and the stage advance: a full stage is defeated (the stage's loss resolves), then the Orcs advance to the C side of the next stage, whose When Revealed resolves,
// then to its D side. The players win or lose by the printed lines of the stages, never by the engine.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED, type Cause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { holds } from "../../interpret/conditions.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/modified-stat.ts";
import { printedOf } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { engagedThreatTotal, orcsAreaThreat } from "./orcs-values.ts";
import { orcsOf } from "./orcs-zone.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// The progress on the Orcs' stage, no more than it needs; a full stage is defeated.
function placeOnStage(state: ScenarioState, amount: number, ctx: ReduceContext, steps: EngineStep[], cause: Cause): ScenarioState {
  const area = orcsOf(state);
  const stage = area ? state.cards[area.stage] : undefined;
  if (!area || !stage || amount <= 0) return state;
  const points = modifiedStat(state, stage, "questPoints", ctx.cards);
  const placed = Math.min(amount, Math.max(0, points - stage.progress));
  let next = state;
  if (placed > 0) {
    next = updateCard(next, stage.id, { progress: stage.progress + placed });
    steps.push({ kind: "progress", targetId: stage.id, amount: placed, cause });
  }
  return (next.cards[stage.id]?.progress ?? 0) >= points ? defeatOrcsStage(next, ctx, steps) : next;
}

// The Orcs' stage is full. Its records that hear `orcsStageDefeated` resolve (the loss of 2D, 3D and 4D); unless that loses the game, the Orcs advance to the next stage, C side first (its When Revealed effects resolve), then D side (hrd.orcs-area). The last stage stays where it is.
function defeatOrcsStage(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const area = orcsOf(state);
  const stage = area ? state.cards[area.stage] : undefined;
  if (!area || !stage) return state;
  const [upcoming, ...rest] = area.deck;
  const defeated = ctx.effects.filter((effect) => effect.cardCode === stage.code && effect.trigger === "orcsStageDefeated");
  // A defeat that loses the game leaves the Orcs on the stage they defeated, so the table at the loss shows the stage the loss names: the check comes before the advance (17052:B:3, 17053:B:3, 17054:B:3).
  const scope = { actor: state.firstPlayer, sourceId: stage.id, returned: 0 };
  const loses = defeated.some((effect) => (effect.condition == null || holds(state, effect.condition, scope, ctx)) && effect.instructions.some((instruction) => instruction.verb === "LoseGame"));
  let next = state;
  if (upcoming && !loses) {
    // The defeated stage leaves play; the new one becomes the current stage before it moves, so it is not taken for a card of the area.
    next = { ...next, orcs: { ...area, stage: upcoming, number: area.number + 1, deck: rest } };
    next = moveCard(next, area.stage, { zone: "setAside" });
    next = updateCard(moveCard(next, upcoming, { zone: "orcsArea" }), upcoming, { face: "B" });
    const revealed = ctx.effects.filter((effect) => effect.cardCode === next.cards[upcoming]?.code && effect.timing === "whenRevealed");
    next = pushCardEffects(next, "whenRevealed", upcoming, next.firstPlayer, false, revealed, ctx, steps);
  }
  // Pushed last, so the loss resolves before the C side's When Revealed.
  return pushCardEffects(next, "forced", stage.id, state.firstPlayer, false, defeated, ctx, steps);
}

/** OrcsProgress: the top card of the encounter deck is discarded, and the Orcs' stage takes the printed Threat of the discarded card plus the total Threat in the Orcs' area, or (`engaged`) the total Threat of each engaged enemy (17051:B:2, 17054:B:2). */
export function orcsProgress(state: ScenarioState, instruction: Verb<"OrcsProgress">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!orcsOf(state)) return state;
  const cause = currentCause(steps, UNATTRIBUTED);
  const top = state.encounterDeck[0];
  const next = top ? updateCard(moveCard(state, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null }) : state;
  const discarded = top ? (printedOf(ctx.cards, state.cards[top]?.code ?? "").threat ?? 0) : 0;
  return placeOnStage(next, discarded + (instruction.engaged === true ? engagedThreatTotal(next, ctx.cards) : orcsAreaThreat(next, ctx.cards)), ctx, steps, cause);
}

/** AddOrcsProgress: `amount` progress goes on the Orcs' stage (17045:A:3, 17050:B:2). */
export function addOrcsProgress(state: ScenarioState, instruction: Verb<"AddOrcsProgress">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!orcsOf(state)) return state;
  return placeOnStage(state, resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx), ctx, steps, currentCause(steps, UNATTRIBUTED));
}
