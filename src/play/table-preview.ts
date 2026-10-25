// What a long press on a table card shows (card-preview.tsx): the card, the cards attached to it and its face-up shadow cards,
// each with the effects on it now, opened on the card that was pressed. Pure: the screen hands over how a code is pictured.
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";

import { effectLines } from "./card-effects.ts";
import type { PreviewCard } from "./card-preview.tsx";
import { inspectTargets } from "./selectors.ts";

// A card code as the preview draws it: its name, its picture (or null), whether it is printed sideways, its text.
export type Describe = (code: string) => Omit<PreviewCard, "code" | "effects" | "role">;

/** The cards the preview lists, and which of them it opens on. `extra` adds cards that are not on the table (Look). */
export function previewCards(game: ScenarioState, ctx: ReduceContext, cardId: string, describe: Describe, cardName: (cardId: string) => string, extra: readonly string[] = []): { cards: PreviewCard[]; start: number } {
  const ids = [...inspectTargets(game, cardId), ...extra.filter((id) => id !== cardId)];
  const cards = ids.flatMap((id, index): PreviewCard[] => {
    const card = game.cards[id];
    if (!card) return [];
    const role = index === 0 ? null : card.zone === "shadow" ? "Shadow card" : card.host ? "Attachment" : null;
    return [{ code: card.code, ...describe(card.code), effects: effectLines(game, ctx, id, cardName), ...(role ? { role } : {}) }];
  });
  return { cards, start: Math.max(0, ids.indexOf(cardId)) };
}
