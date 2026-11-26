// Rules: rm.time-x, rm.grima-objective-ally (data/rules/entries.json); ledger lines 07063:B:1, 07063:B:2, 07064:B:1, 07064:B:2, 07059:B:1, 07059:B:2, 07060:B:2, 07060:B:3, 07061:B:1, 07061:B:2, 07065:B:1, 07065:B:2, 07066:B:1, 07066:B:2, 07067:B:1, 07067:B:2.
// The time dial of the quest stages of The Fords of Isen, To Catch an Orc and Into Fangorn: the counters left against the Time X the stage printed, warming as the last refresh phase gets near. The engine decided every number (`timeOf`, the counters on the card); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { timeLimit } from "../../../rules/families/angmar/time.ts";
import type { ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";

import { stageTimeLimitWords, stageTimeNearWords, stageTimeWords } from "../../words/scenarios/ring-maker/fords-table.ts";
import { cardsOf, type TableDial } from "../dials.ts";

/** The quest stages of The Fords of Isen, of To Catch an Orc (stages 2B and 3B), of Into Fangorn (stages 1B, 2B and 3B) and of The Dunland Trap (stages 1B and 3B; 2B prints none) that print Time X. */
export const FORDS_STAGES: readonly string[] = ["07059", "07060", "07061", "07063", "07064", "07065", "07066", "07067", "08011", "08013"];

export function ringMakerDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const dials: TableDial[] = [];
  for (const code of FORDS_STAGES) {
    const printed = timeLimit(game, ctx, code);
    if (printed == null) continue;
    for (const card of cardsOf(game, code)) {
      // A stage that counted the players when it turned keeps its counters if a player leaves later.
      const limit = Math.max(printed, card.resources);
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
