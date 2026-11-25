// Rules: rm.time-x, rm.grima-objective-ally (data/rules/entries.json); ledger lines 07063:B:1, 07063:B:2, 07064:B:1, 07064:B:2, 07059:B:1, 07059:B:2, 07060:B:2, 07060:B:3, 07061:B:1, 07061:B:2.
// The time dial of the quest stages of The Fords of Isen and To Catch an Orc: the counters left against the Time X the stage printed, warming as the last refresh phase gets near. The engine decided every number (`timeOf`, the counters on the card); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { timeOf } from "../../../rules/families/angmar/time.ts";
import type { ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";

import { stageTimeLimitWords, stageTimeNearWords, stageTimeWords } from "../../words/scenarios/ring-maker/fords-table.ts";
import { cardsOf, type TableDial } from "../dials.ts";

/** The quest stages of The Fords of Isen and of To Catch an Orc (stages 2B and 3B) that print Time X. */
export const FORDS_STAGES: readonly string[] = ["07059", "07060", "07061", "07063", "07064"];

export function ringMakerDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const dials: TableDial[] = [];
  for (const code of FORDS_STAGES) {
    const limit = timeOf(ctx, code);
    if (limit == null) continue;
    for (const card of cardsOf(game, code)) {
      // Only stage 1B's last counter is a loss; the other two return counters, so their dials warm near and are never critical.
      const level = card.resources <= 1 && code === "07059" ? ("critical" as const) : ("near" as const);
      dials.push({
        id: `time:${card.id}`,
        testID: `ring-maker-time:${card.id}`,
        label: "Time",
        name: `Time counters left on ${nameOf(card.code)}:`,
        value: card.resources,
        cardId: card.id,
        limit,
        limitWords: stageTimeLimitWords(limit),
        ...(card.resources <= 2 ? { warn: { level, words: stageTimeNearWords(code, card.resources) } } : {}),
        note: stageTimeWords(code, card.resources),
      });
    }
  }
  return dials;
}

/** Gríma's code. */
export const GRIMA = "07016";

/** The ids of Gríma lying on this card (The Islet, 07059:A:1): attached to it and controlled by no player. The card's pill says "1 held". Empty for any other card and in every other game. */
export function grimaLyingOn(game: ScenarioState, hostId: string): readonly string[] {
  const host = game.cards[hostId];
  return host == null || host.attachments.length === 0 ? [] : host.attachments.filter((id) => game.cards[id]?.code === GRIMA && game.cards[id]?.controller == null);
}
