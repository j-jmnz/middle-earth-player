// Rules: rm.time-x, rm.grima-objective-ally (data/rules/entries.json); ledger lines 07059:B:1, 07059:B:2, 07060:B:2, 07060:B:3, 07061:B:1, 07061:B:2.
// The time dial of The Fords of Isen's three quest stages: the counters left against the Time X the stage printed, warming as the last refresh phase gets near. The engine decided every number (`timeOf`, the counters on the card); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { timeOf } from "../../../rules/families/angmar/time.ts";
import type { ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";

import { stageTimeLimitWords, stageTimeNearWords, stageTimeWords } from "../../words/scenarios/ring-maker/fords-table.ts";
import { cardsOf, type TableDial } from "../dials.ts";

/** The three quest stages of The Fords of Isen that print Time X. */
export const FORDS_STAGES: readonly string[] = ["07059", "07060", "07061"];

export function ringMakerDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const dials: TableDial[] = [];
  for (const code of FORDS_STAGES) {
    const limit = timeOf(ctx, code);
    for (const card of cardsOf(game, code)) {
      if (limit == null) continue;
      // Only stage 1B's last counter is a loss; the other two return counters, so their dials warm near and are never critical.
      const level = card.resources <= 1 && code === "07059" ? ("critical" as const) : ("near" as const);
      dials.push({
        id: `time:${card.id}`,
        testID: `ring-maker-time:${card.id}`,
        label: "Time",
        name: `Time counters left on ${nameOf(card.code)}:`,
        value: card.resources,
        limit,
        limitWords: stageTimeLimitWords(limit),
        ...(card.resources <= 2 ? { warn: { level, words: stageTimeNearWords(code, card.resources) } } : {}),
        note: stageTimeWords(code, card.resources),
      });
    }
  }
  return dials;
}
