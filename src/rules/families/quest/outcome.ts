// Rules: rr.step-3-4, rr.delayed-effects (data/rules/entries.json).
// What each committed character hears when the quest resolves ("After ~ quests successfully", "After resolving a quest to which
// ~ was committed"), and the delayed effects that wait for the players to quest successfully (19112:A:1). The committed
// characters are read before the quest resolves, since resolving it clears their commitment.
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { committedWillpower, stagingThreat } from "../../quest/quest.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats } from "../../core/state.ts";
import { queueHeard } from "./events.ts";

type Result = "success" | "failure" | "tie";

// `bySeat`: once stages are separate, how each living seat's own quest resolves (mec109.multiple-staging-areas); `result` is then success when every living seat
// succeeded, failure when each failed, and a tie otherwise. `placed`: the resolution placed progress, wherever it went (set by the resolution step once it has run, for the trigger the table hears once).
export type QuestOutcome = { committed: readonly string[]; result: Result; bySeat?: Readonly<Record<number, Result>>; placed?: boolean };

function resultOf(willpower: number, threat: number): Result {
  return willpower > threat ? "success" : willpower < threat ? "failure" : "tie";
}

// The characters committed to the quest and how it will resolve, read just before it resolves (rr.step-3-4).
export function questOutcome(state: ScenarioState, ctx: ReduceContext): QuestOutcome {
  const committed = livingSeats(state).flatMap((seat) => [...(state.seats[seat]?.heroes ?? []), ...(state.seats[seat]?.play ?? [])].filter((id) => state.cards[id]?.committed === true));
  if (state.separate) {
    const bySeat: Record<number, Result> = {};
    for (const seat of livingSeats(state)) bySeat[seat] = resultOf(committedWillpower(state, ctx.cards, seat), stagingThreat(state, ctx.cards, seat));
    const results = Object.values(bySeat);
    const result = results.length > 0 && results.every((each) => each === "success") ? "success" : results.length > 0 && results.every((each) => each === "failure") ? "failure" : "tie";
    return { committed, result, bySeat };
  }
  const willpower = committedWillpower(state, ctx.cards);
  const threat = stagingThreat(state, ctx.cards);
  return { committed, result: resultOf(willpower, threat) };
}

// After the quest resolved: each character that was committed hears it, and so, when the quest succeeded, does each one that
// quested successfully. The delayed effects waiting for success resolve now (the first one scheduled first), or are dropped.
export function afterQuestOutcome(state: ScenarioState, outcome: QuestOutcome, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  // The table hears once that a successful quest placed progress (`placed`: any of it, wherever it went), whatever is committed (147002:B:2).
  if (outcome.placed === true && outcome.result === "success") next = queueHeard(next, ctx, { trigger: "questProgressPlaced", seat: null });
  for (const id of outcome.committed) {
    const card = next.cards[id];
    if (!card || !inPlay(card.zone)) continue;
    next = queueHeard(next, ctx, { trigger: "committedQuestResolved", seat: card.controller, subject: id });
    // Its own seat's quest, once stages are separate.
    const own = outcome.bySeat && card.controller != null ? outcome.bySeat[card.controller] : outcome.result;
    if (own === "success") next = queueHeard(next, ctx, { trigger: "questedSuccessfully", seat: card.controller, subject: id });
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
