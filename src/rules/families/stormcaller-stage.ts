// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages (data/rules/entries.json); ledger lines 12016:B:3, 12017:A:1, 12017:B:3, 12018:B:1, 12018:B:2, 12012:B:2, 12026:A:1. The Stormcaller's quest stage:
// the progress the Stormcaller places on it at the end of each round and the progress the players move onto it, and the stage advance: first to the C side of the next stage, whose When Revealed
// resolves, then to its D side.
import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../amounts.ts";
import { currentCause, UNATTRIBUTED, type Cause } from "../cause.ts";
import { pushCardEffects } from "../effect-frames.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { modifiedStat } from "../keywords.ts";
import { printedOf } from "../printed.ts";
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";
import { heldAmount, livingSeats, updateCard } from "../state.ts";
import { moveCard } from "../zones.ts";
import { removeQuestProgress } from "./caves-progress.ts";
import type { Focus } from "./index.ts";
import { areaOf } from "./stormcaller-zone.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// The progress on the Stormcaller's stage, no more than it needs; a full stage advances.
function placeOnStage(state: ScenarioState, amount: number, ctx: ReduceContext, steps: EngineStep[], cause: Cause): ScenarioState {
  const area = areaOf(state);
  const stage = area ? state.cards[area.stage] : undefined;
  if (!area || !stage || amount <= 0) return state;
  const points = modifiedStat(state, stage, "questPoints", ctx.cards);
  const placed = Math.min(amount, Math.max(0, points - stage.progress));
  let next = state;
  if (placed > 0) {
    next = updateCard(next, stage.id, { progress: stage.progress + placed });
    steps.push({ kind: "progress", targetId: stage.id, amount: placed, cause });
  }
  return (next.cards[stage.id]?.progress ?? 0) >= points ? advanceStormcaller(next, ctx, steps) : next;
}

// The Stormcaller's stage is full: it advances to the next stage, C side first (its When Revealed effects resolve), then D side (dcce.stormcallers-area-stages), and the Stormcaller returns to the area
// (12019:A:3). Each player hears it ("When the Stormcaller advances to the next quest stage", 12024:A:1). The last stage, filled, is announced instead (12018:B:2).
function advanceStormcaller(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const area = areaOf(state);
  if (!area || !state.sea) return state;
  const [upcoming, ...rest] = area.deck;
  if (!upcoming) return queueEvent(state, { trigger: "stormcallerStageDefeated", seat: null, subject: area.card });
  // The defeated stage leaves the game's play; the new one becomes the current stage before it moves, so it is not taken for a card of the area.
  const advanced: ScenarioState = { ...state, sea: { ...state.sea, stormcaller: { ...area, stage: upcoming, number: area.number + 1, deck: rest } } };
  let next = moveCard(advanced, area.stage, { zone: "setAside" });
  next = updateCard(moveCard(next, upcoming, { zone: "stormcallerArea" }), upcoming, { face: "B" });
  next = moveCard(next, area.card, { zone: "stormcallerArea" });
  for (const seat of livingSeats(next)) next = queueEvent(next, { trigger: "stormcallerAdvanced", seat, subject: area.card });
  const revealed = ctx.effects.filter((effect) => effect.cardCode === next.cards[upcoming]?.code && effect.timing === "whenRevealed");
  return pushCardEffects(next, "whenRevealed", upcoming, next.firstPlayer, false, revealed, ctx, steps);
}

/** StormcallerProgress: the top card of the encounter deck is discarded, and the Stormcaller's stage takes the Stormcaller's Threat, the printed Threat of the discarded card and the Threat of each card
 * in the area that contributes its Threat to it (12020:A:3). */
export function stormcallerProgress(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const area = areaOf(state);
  if (!area) return state;
  const cause = currentCause(steps, UNATTRIBUTED);
  const top = state.encounterDeck[0];
  let next = top ? updateCard(moveCard(state, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null }) : state;
  let amount = top ? (printedOf(ctx.cards, state.cards[top]?.code ?? "").threat ?? 0) : 0;
  const caller = next.cards[area.card];
  if (caller) amount += modifiedStat(next, caller, "threat", ctx.cards);
  for (const id of areaOf(next)?.members ?? []) {
    const member = next.cards[id];
    if (member?.zone === "stormcallerArea" && id !== area.card && heldAmount(next, id, "stormcallerThreat") > 0) amount += modifiedStat(next, member, "threat", ctx.cards);
  }
  next = placeOnStage(next, amount, ctx, steps, cause);
  return next;
}

/** MoveProgressToStormcaller: up to `amount` progress comes off the current quest card and goes on the Stormcaller's stage. */
export function moveProgressToStormcaller(state: ScenarioState, instruction: Verb<"MoveProgressToStormcaller">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const quest = state.questStage ? state.cards[state.questStage] : undefined;
  if (!quest || !areaOf(state)) return state;
  const moved = Math.min(resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx), quest.progress);
  if (moved <= 0) return state;
  const cause = currentCause(steps, UNATTRIBUTED);
  return placeOnStage(removeQuestProgress(state, moved, steps, cause), moved, ctx, steps, cause);
}
