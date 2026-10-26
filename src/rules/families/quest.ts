// Rules: rr.step-3-2, rr.step-3-4, rr.resources, rr.engagement-check, rr.lasting-effects, rr.ownership-and-control,
// rr.attachment-cards, rr.the-word-choose (data/rules/entries.json).
import type { Instruction, SimpleInstruction } from "../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../amounts.ts";
import { currentCause, UNATTRIBUTED } from "../cause.ts";
import { openBranch } from "../choices.ts";
import { characters } from "../combat.ts";
import { hasTrait } from "../conditions.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { addModifier, placeDamage, playerCardEffectCanChoose } from "../keywords.ts";
import { pickCandidates } from "../pick.ts";
import { lastPicked, readyCard, seatOf } from "../player-verbs.ts";
import { isCharacterType, isPlayerType, printedOf } from "../printed.ts";
import { queueEvent } from "../queue.ts";
import type { Modifier, QueueItem, ScenarioState } from "../state.ts";
import { inPlay, livingSeats, updateCard } from "../state.ts";
import { topFrame } from "../windows.ts";
import { attachTo, moveCard } from "../zones.ts";
import type { Focus } from "./index.ts";
import { lowerCardThreat, makeActive, moveProgress } from "./quest-places.ts";
import { raiseQuestThreat, resetThreat } from "./quest-threat.ts";
import { advanceStage } from "../quest.ts";
import { restricted } from "../restrictions.ts";
import { afterProgress } from "../stage-reveal.ts";

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
    case "ReadyAll": {
      let next = state;
      for (const id of characters(state, focus.seat, ctx.cards)) if (!instruction.trait || hasTrait(state, id, instruction.trait, ctx)) next = readyCard(next, id);
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
    case "AdvanceStage": {
      const before = steps.length;
      return afterProgress(advanceStage(state, ctx.cards, steps, (current) => !restricted(current, ctx, "advance").length), before, ctx, steps);
    }
    case "RaiseQuestThreat":
      return raiseQuestThreat(state, focus.seat, instruction.amount, ctx, steps);
    case "ResetThreat":
      return resetThreat(state, focus.seat, focus.sourceId, ctx, steps);
    case "ReattachSelf":
      return reattachSelf(state, instruction, focus);
    default:
      return null;
  }
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

// The card commits to the quest without exhausting (rr.step-3-2 exhausts only for the commitment step itself), and the cards that
// answer a commitment hear it. With `stat: "attack"` it quests with its Attack until the phase ends.
function commitToQuest(state: ScenarioState, instruction: Verb<"CommitToQuest">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId));
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.committed || card.controller == null || (card.zone !== "heroes" && card.zone !== "play")) return state;
  if (!isCharacterType(printedOf(ctx.cards, card.code))) return state;
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
  if (amount > 0) for (const id of targets) next = placeDamage(next, id, amount, ctx.cards, steps, player ? "player" : "framework", currentCause(steps, UNATTRIBUTED));
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
