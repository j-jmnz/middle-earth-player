// Rules: rr.step-3-4, rr.delayed-effects (data/rules/entries.json).
// What each committed character hears when the quest resolves ("After ~ quests successfully", "After resolving a quest to which
// ~ was committed"), and the delayed effects that wait for the players to quest successfully (19112:A:1). The committed
// characters are read before the quest resolves, since resolving it clears their commitment.
import { pushEffectFrame } from "../effect-frames.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { committedWillpower, stagingThreat } from "../quest.ts";
import type { ScenarioState } from "../state.ts";
import { inPlay, livingSeats } from "../state.ts";
import { queueHeard } from "./quest-events.ts";

export type QuestOutcome = { committed: readonly string[]; result: "success" | "failure" | "tie" };

// The characters committed to the quest and how it will resolve, read just before it resolves (rr.step-3-4).
export function questOutcome(state: ScenarioState, ctx: ReduceContext): QuestOutcome {
  const committed = livingSeats(state).flatMap((seat) => [...(state.seats[seat]?.heroes ?? []), ...(state.seats[seat]?.play ?? [])].filter((id) => state.cards[id]?.committed === true));
  const willpower = committedWillpower(state, ctx.cards);
  const threat = stagingThreat(state, ctx.cards);
  return { committed, result: willpower > threat ? "success" : willpower < threat ? "failure" : "tie" };
}

// After the quest resolved: each character that was committed hears it, and so, when the quest succeeded, does each one that
// quested successfully. The delayed effects waiting for success resolve now (the first one scheduled first), or are dropped.
export function afterQuestOutcome(state: ScenarioState, outcome: QuestOutcome, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of outcome.committed) {
    const card = next.cards[id];
    if (!card || !inPlay(card.zone)) continue;
    next = queueHeard(next, ctx, { trigger: "committedQuestResolved", seat: card.controller, subject: id });
    if (outcome.result === "success") next = queueHeard(next, ctx, { trigger: "questedSuccessfully", seat: card.controller, subject: id });
  }
  // And those waiting for the players to quest unsuccessfully (900307:A:1).
  const waiting = next.delayed.filter((entry) => entry.until === "questSucceeded" || entry.until === "questFailed");
  if (waiting.length === 0) return next;
  next = { ...next, delayed: next.delayed.filter((entry) => entry.until !== "questSucceeded" && entry.until !== "questFailed") };
  const due = waiting.filter((entry) => (entry.until === "questSucceeded" ? outcome.result === "success" : outcome.result === "failure"));
  for (const entry of [...due].reverse()) {
    if (entry.phase !== next.phase) continue;
    next = pushEffectFrame(
      next,
      {
        frame: "delayed",
        sourceId: entry.sourceId,
        actor: entry.seat,
        peril: false,
        effectId: entry.id,
        instructions: entry.instructions,
        cancel: null,
        blockCancel: entry.uncancelable,
        ...(entry.subjectId ? { picked: [entry.subjectId] } : {}),
        ...(entry.cause ? { cause: entry.cause } : {}),
      },
      steps,
    );
  }
  return next;
}
