// What a long press on a table card shows (card-preview.tsx): the card, the cards attached to it and its face-up shadow cards,
// each with the effects on it now, opened on the card that was pressed. Pure: the screen hands over how a code is pictured.
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";

import { delayedLines, effectLines } from "./card-effects.ts";
import type { PreviewCard } from "./card-preview.tsx";
import { inspectTargets } from "./selectors.ts";
import { whyNotPlayable } from "./why.ts";

// A card code as the preview draws it: its name, its picture (or null), whether it is printed sideways, its text, and the
// lines of it the app does not apply.
export type Describe = (code: string) => Omit<PreviewCard, "code" | "effects" | "role" | "note">;

/** The cards the preview lists, and which of them it opens on. `extra` adds cards that are not on the table (Look). */
export function previewCards(game: ScenarioState, ctx: ReduceContext, cardId: string, describe: Describe, cardName: (cardId: string) => string, extra: readonly string[] = []): { cards: PreviewCard[]; start: number } {
  const ids = [...inspectTargets(game, cardId), ...extra.filter((id) => id !== cardId)];
  const cards = ids.flatMap((id, index): PreviewCard[] => {
    const card = game.cards[id];
    if (!card) return [];
    const role = index === 0 ? null : card.zone === "shadow" ? "Shadow card" : card.host ? "Attachment" : null;
    // The effects on it, then what a delayed effect will do to it (Sneak Attack's return); for the pressed hand card, why it
    // does not glow.
    const effects = [...effectLines(game, ctx, id, cardName), ...delayedLines(game, id, cardName)];
    const note = id === cardId ? whyNotPlayable(game, ctx, id, cardName) : null;
    return [{ code: card.code, ...describe(card.code), effects, ...(role ? { role } : {}), ...(note ? { note } : {}) }];
  });
  return { cards, start: Math.max(0, ids.indexOf(cardId)) };
}
