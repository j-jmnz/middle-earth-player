// Rules: rr.step-3-2, rr.step-3-4, rr.travel, rr.resources, rr.engagement-check, rr.lasting-effects, rr.ownership-and-control,
// rr.attachment-cards, rr.the-word-choose (data/rules/entries.json).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction, SimpleInstruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { openBranch, askTarget } from "../../windows/choices.ts";
import { characters } from "../../combat/combat.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { addModifier, placeDamage, playerCardEffectCanChoose } from "../../core/keywords.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { exhaustCard, lastPicked, placePlayerDamage, readyCard, seatOf } from "../../interpret/player-verbs.ts";
import { flaggedByClass } from "../../core/holder-classes.ts";
import { isCharacterType, isPlayerType, printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Modifier, QueueItem, ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { lowerCardThreat, makeActive, moveProgress, removeAllProgress, removeProgressEach, removeProgressFromQuest } from "./places.ts";
import { playerSource, raiseQuestThreat, resetThreat } from "./threat.ts";
import { bottomStage, keepStage, lookedStages, shuffleStages } from "./order.ts";
import { advanceAndReveal } from "../../quest/stage-reveal.ts";
import { placeProgressOnQuestCard } from "./quest-card.ts";
import { announceEliminated } from "./eliminated.ts";
import { resetSweep } from "./reset.ts";
import { questIdle } from "./idle.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// The verbs src/catalog/families/quest.ts adds, for the quest phase, locations, travel, progress, threat and engagement. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "CommitToQuest":
      return commitToQuest(state, instruction, focus, ctx, steps);
    case "MakeActive":
      return makeActive(state, instruction, focus, ctx, steps);
    case "MoveProgress":
      return moveProgress(state, instruction, focus, ctx, steps, (current, max, option) => askNumber(current, max, option, focus, ctx, steps));
    case "LowerCardThreat":
      return lowerCardThreat(state, instruction, focus, ctx);
    case "DamageEach":
      return damageEach(state, instruction, focus, ctx, steps);
    case "ExhaustEach": {
      let next = state;
      for (const id of pickCandidates(state, instruction.pick, focus.seat, [], focus.sourceId, ctx)) next = exhaustCard(next, id);
      return next;
    }
    case "ReadyAll": {
      let next = state;
      for (const id of characters(state, focus.seat, ctx.cards)) if (!instruction.trait || hasTrait(state, id, instruction.trait, ctx)) next = readyCard(next, id, playerSource(state, focus.sourceId, ctx), ctx.cards);
      return next;
    }
    case "BarEngagement": {
      const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId));
      if (!id || !state.cards[id]) return state;
      return withModifier(state, { instanceId: id, sourceId: focus.sourceId ?? id, stat: instruction.what === "checks" ? "noChecksAgainst" : "cannotEngageSeat", amount: 1, until: instruction.until, seat: focus.seat });
    }
    case "WaiveQuestThreat": {
      const picked = seatOf(lastPicked(state));
      const seats = instruction.who === "eachSeat" ? livingSeats(state) : picked == null ? [] : [picked];
      let next = state;
      for (const seat of seats) next = withModifier(next, { instanceId: `seat:${seat}`, sourceId: focus.sourceId ?? "table", stat: "noQuestThreat", amount: 1, until: instruction.until });
      return next;
    }
    case "SkipQuestPhase":
      return withModifier(state, { instanceId: "table", sourceId: focus.sourceId ?? "table", stat: "skipQuestPhase", amount: 1, until: "endOfRound" });
    case "AdvanceStage":
      return advanceAndReveal(state, ctx, steps);
    case "RaiseQuestThreat":
      return raiseQuestThreat(state, focus.seat, instruction.amount, ctx, steps);
    case "ResetThreat":
      return resetThreat(state, focus.seat, focus.sourceId, ctx, steps);
    case "ReattachSelf":
      return reattachSelf(state, instruction, focus);
    // Read when the scenario's definition is built (BranchStage, rules/families/quest/branch.ts); nothing to do when it runs.
    case "BranchStage":
    case "AdvanceIfAttached":
      return state;
    case "ShuffleStages":
      return shuffleStages(state, instruction.codes);
    case "LookAtStages":
      return lookAtStages(state, instruction, focus, ctx, steps);
    case "RemoveProgressFromQuest":
      return removeProgressFromQuest(state, instruction, focus, ctx, steps);
    case "RemoveAllProgress":
      return removeAllProgress(state, instruction, focus, ctx, steps);
    case "RemoveProgressEach":
      return removeProgressEach(state, instruction, focus, ctx, steps);
    case "PlaceProgressOnQuestCard":
      return placeProgressOnQuestCard(state, instruction, focus, ctx, steps);
    default:
      return null;
  }
}

// LookAtStages (families/quest/order.ts): the first player looks at the top stages of the quest deck and chooses the one the quest advances to; the
// others go to the bottom of the deck; with `bottom` (Mount Gundabad) the stage chosen goes to the bottom and the quest advances to the top of the deck. A deck of one stage goes without asking. Null outside the frame the defeated stage pushed.
function lookAtStages(state: ScenarioState, instruction: Verb<"LookAtStages">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.stageChoice !== "asking") return state;
  const looked = lookedStages(state, instruction.count);
  const chosen = focus.chosen ?? (looked.length === 1 ? looked[0] : undefined);
  if (!chosen || !looked.includes(chosen)) {
    const cause = currentCause(steps, UNATTRIBUTED);
    return askTarget(state, { instruction, seat: focus.seat, chosen: null, cause }, looked);
  }
  return advanceAndReveal(instruction.bottom ? bottomStage(state, chosen) : keepStage(state, looked, chosen), ctx, steps);
}

function withModifier(state: ScenarioState, modifier: Modifier): ScenarioState {
  return { ...state, modifiers: [...state.modifiers, modifier] };
}

// The actor chooses a number from 1 to `max`: a Choose the engine makes, one option per number (rr.the-word-choose). With one
// number, or outside a running effect, the highest runs at once.
function askNumber(state: ScenarioState, max: number, option: (n: number) => SimpleInstruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (max <= 1 || topFrame(state)?.data.kind !== "effect") return run(state, option(max), focus, ctx, steps) ?? state;
  const options = Array.from({ length: max }, (_, at) => ({ id: String(at + 1), instructions: [option(at + 1)] }));
  const item: QueueItem = { instruction: { verb: "Choose", who: "actor", options }, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) };
  return openBranch(state, item, 0, ctx);
}

// A character that cannot quest stays out of an effect's commitment too, whether the bar is held by the card or by a class it belongs to ("Attached hero ... cannot commit to a quest", 04023:A:1; The Massing at Osgiliath).
function barredFromCommitting(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  return card != null && flaggedByClass(state, card, printedOf(ctx.cards, card.code), "cannotQuest", (trait) => hasTrait(state, id, trait, ctx));
}

// The card commits to the quest without exhausting (rr.step-3-2 exhausts only for the commitment step itself), and the cards that
// answer a commitment hear it; a character that cannot quest stays out. With `stat: "attack"` it quests with its Attack until the phase ends.
function commitToQuest(state: ScenarioState, instruction: Verb<"CommitToQuest">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId));
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.committed || card.controller == null || (card.zone !== "heroes" && card.zone !== "play")) return state;
  if (!isCharacterType(printedOf(ctx.cards, card.code))) return state;
  if (barredFromCommitting(state, id, ctx)) return state;
  let next = updateCard(state, id, { committed: true });
  steps.push({ kind: "commit", cardId: id });
  if (instruction.stat === "attack") next = addModifier(next, id, focus.sourceId ?? id, "questsWithAttack", 1, "endOfPhase");
  return queueEvent(next, { trigger: "committed", seat: card.controller, cardId: id });
}

// Damage on each matching card, or on each enemy engaged with the picked player. Read once, then placed on each in turn.
function damageEach(state: ScenarioState, instruction: Verb<"DamageEach">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const player = source != null && isPlayerType(printedOf(ctx.cards, source.code));
  const seat = instruction.engagedWith === "picked" ? seatOf(lastPicked(state)) : null;
  const targets =
    instruction.engagedWith === "picked"
      ? (seat == null ? [] : (state.seats[seat]?.engaged ?? [])).filter((id) => {
          const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
          return printed.type === "enemy" && (!player || playerCardEffectCanChoose(printed));
        })
      : instruction.pick
        ? pickCandidates(state, instruction.pick, focus.seat, [], focus.sourceId, ctx)
        : [];
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  let next = state;
  if (amount <= 0) return next;
  for (const id of targets) {
    next = player ? placePlayerDamage(next, focus.seat, id, amount, ctx, steps, focus.sourceId) : placeDamage(next, id, amount, ctx.cards, steps, "framework", currentCause(steps, UNATTRIBUTED));
  }
  return next;
}

// The source attachment moves onto the card and passes to that card's controller; it stays its owner's card
// (rr.ownership-and-control).
function reattachSelf(state: ScenarioState, instruction: Verb<"ReattachSelf">, focus: Focus): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId));
  const host = id ? state.cards[id] : undefined;
  if (!source || !id || !host || host.controller == null || !inPlay(source.zone) || !inPlay(host.zone) || id === source.host) return state;
  const owner = source.owner ?? source.controller ?? host.controller;
  const moved = attachTo(moveCard(state, source.id, { zone: "play", seat: host.controller }), source.id, id);
  return updateCard(moved, source.id, { owner: owner === host.controller ? undefined : owner });
}

/** "Remove 5 progress from stage 3B to travel here" (145017:A:3, rr.travel): the players cannot pay it, and so cannot travel, while the current quest holds fewer progress than the amount (resolved for the location's own Travel line). */
function removeProgressUnpayable(state: ScenarioState, instruction: Instruction, ctx: ReduceContext, locationId: string): boolean {
  if (instruction.verb !== "RemoveProgressFromQuest") return false;
  const needed = resolveAmount(state, instruction.amount, frameScope(state, state.firstPlayer, locationId), ctx);
  return (state.questStage ? (state.cards[state.questStage]?.progress ?? 0) : 0) < needed;
}

export const manifest: RulesFamily = { name: "quest", settle: { before: announceEliminated, sweep: resetSweep }, travel: { unpayable: removeProgressUnpayable }, verbs: ["CommitToQuest", "MakeActive", "MoveProgress", "LowerCardThreat", "DamageEach", "ExhaustEach", "ReadyAll", "BarEngagement", "WaiveQuestThreat", "SkipQuestPhase", "AdvanceStage", "RaiseQuestThreat", "ResetThreat", "ReattachSelf", "BranchStage", "AdvanceIfAttached", "ShuffleStages", "LookAtStages", "RemoveProgressFromQuest", "RemoveAllProgress", "RemoveProgressEach", "PlaceProgressOnQuestCard"], run, idle: questIdle };
