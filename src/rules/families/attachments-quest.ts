// Rules: rr.step-3-4, rr.active-location, rr.explored, rr.quest-advancement (data/rules/entries.json).
//
// Attachments on quest cards and on locations that take quest progress: the quest cards an attachment may go on ("Attach to
// a quest card in play"), and Explorer's Almanac's "Progress from questing successfully may be placed on the attached
// location before it is placed on the current quest" (the takesProgressFirst flag, answered once each quest phase).
import type { Instruction } from "../../catalog/boundary.ts";

import { effectCause, ruleCause } from "../cause.ts";
import { pushEffectFrame } from "../effect-frames.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { destroyCard, modifiedStat } from "../keywords.ts";
import { effectsOf } from "../listen.ts";
import { printedOf, type PrintedCard } from "../printed.ts";
import { committedWillpower, stagingThreat } from "../quest.ts";
import type { Modifier, ScenarioState } from "../state.ts";
import { flagged, heldAmount, inPlay, modifierActive, updateCard } from "../state.ts";

// The quest cards in play an attachment may go on: the current quest card, and any other quest card in play (a side quest).
export function questHosts(state: ScenarioState, ctx: ReduceContext): string[] {
  const others = Object.values(state.cards)
    .filter((card) => card.id !== state.questStage && inPlay(card.zone) && card.zone !== "questStage" && printedOf(ctx.cards, card.code).type === "quest")
    .map((card) => card.id);
  return [...(state.questStage ? [state.questStage] : []), ...others];
}

// The players' answer this quest phase: progress goes on the locations that may take it first.
function placingFirst(state: ScenarioState): boolean {
  return heldAmount(state, "table", "progressFirst") > 0;
}

// Progress from questing successfully, after the active location took its share: each location in the staging area that may
// take it (takesProgressFirst) takes what it needs, when the players said so, and a full one is explored (rr.explored).
// A location that must take it (`progressFirstRequired`: "progress must be placed on Mines of Moria before it can be placed on the current quest",
// 142052:A:1) takes it from every placement; one that may (`takesProgressFirst`) takes what the players said, from questing only.
export function progressFirstLocations(state: ScenarioState, amount: number, cards: ReadonlyMap<string, PrintedCard>, steps: EngineStep[], questing = true): { state: ScenarioState; remaining: number } {
  const chosen = questing && placingFirst(state);
  let next = state;
  let remaining = amount;
  for (const id of state.staging) {
    const location = next.cards[id];
    if (remaining <= 0 || !location || !(flagged(next, id, "progressFirstRequired") || (chosen && flagged(next, id, "takesProgressFirst"))) || printedOf(cards, location.code).questPoints == null) continue;
    const points = modifiedStat(next, location, "questPoints", cards);
    const placed = Math.min(remaining, Math.max(0, points - location.progress));
    if (placed <= 0) continue;
    next = updateCard(next, id, { progress: location.progress + placed });
    steps.push({ kind: "progress", targetId: id, amount: placed, cause: ruleCause("rr.step-3-4") });
    remaining -= placed;
    if (location.progress + placed >= points) next = destroyCard(next, id, cards, steps, true);
  }
  return { state: next, remaining };
}

function holderOf(state: ScenarioState): Modifier | undefined {
  return state.modifiers.find((modifier) => modifier.stat === "takesProgressFirst" && modifier.amount > 0 && modifierActive(state, modifier) && state.staging.includes(modifier.instanceId));
}

// Before the quest resolves (stage-reveal.ts): when it will succeed and a location in the staging area may take its progress
// first, the controller of the card that allows it chooses, once this phase. The answer waits on the table until the phase
// ends (progressFirst: 0 asked, 1 placed first).
export function askQuestProgress(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  if (state.modifiers.some((modifier) => modifier.stat === "progressFirst" && modifierActive(state, modifier))) return null;
  const holder = holderOf(state);
  if (!holder || committedWillpower(state, ctx.cards) <= stagingThreat(state, ctx.cards)) return null;
  const source = state.cards[holder.sourceId];
  const record = source ? effectsOf(ctx, source.code).find((effect) => JSON.stringify(effect.instructions).includes('"takesProgressFirst"')) : undefined;
  const asked: ScenarioState = { ...state, window: null, modifiers: [...state.modifiers, { instanceId: "table", sourceId: holder.sourceId, stat: "progressFirst", amount: 0, until: "endOfPhase" }] };
  const choose: Instruction = {
    verb: "Choose",
    who: "actor",
    options: [
      { id: "location", instructions: [{ verb: "QuestProgressFirst", first: true }] },
      { id: "quest", instructions: [] },
    ],
  };
  return pushEffectFrame(
    asked,
    {
      frame: "ResolveEffect",
      sourceId: holder.sourceId,
      actor: source?.controller ?? state.firstPlayer,
      peril: false,
      effectId: record?.id ?? "takesProgressFirst",
      instructions: [choose],
      cancel: null,
      blockCancel: null,
      cause: record ? effectCause(record) : ruleCause("rr.step-3-4"),
    },
    steps,
  );
}

// QuestProgressFirst: the players' answer replaces the mark that they were asked.
export function answerQuestProgress(state: ScenarioState, first: boolean, sourceId: string | null): ScenarioState {
  const kept = state.modifiers.filter((modifier) => modifier.stat !== "progressFirst");
  return { ...state, modifiers: [...kept, { instanceId: "table", sourceId: sourceId ?? "table", stat: "progressFirst", amount: first ? 1 : 0, until: "endOfPhase" }] };
}
