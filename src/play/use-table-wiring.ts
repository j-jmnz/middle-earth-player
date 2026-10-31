// The small wiring the table view hands its pieces (src/screens/table-view.tsx), kept here beside use-table-choice.ts: the printed facts the zone selectors and the look strip read, the card
// preview opener, what a tap on a pile does (a discard pile's list, a fold stack's row list, the Iron Shackles card on a deck), and the Heading dial the top bar shows. Nothing here changes the game.
import { useCallback, useMemo } from "react";

import type { Reading } from "./reading.ts";
import { isDiscardPile, shownSeat, type PileId } from "./selectors.ts";
import { successOf } from "./sea-sheets.ts";
import type { HeadingStep } from "./heading.ts";
import type { ReduceContext, ScenarioState, TableStore } from "./store.ts";
import { headingReadout } from "./widgets.ts";
import { zoneFactsOf } from "./zone-facts.ts";

/** A card shown large, and the cards listed with it that are not on the table (the Look window's). */
export type PreviewTarget = { id: string; extra: readonly string[] };

/** The Heading dial the top bar draws: the engine's step, and a tap that opens the Heading card's preview. Null while no Heading card is in play. */
export type HeadingDialProps = { step: HeadingStep; onPress: () => void };

export function useTableWiring({ store, ctx, game, setReading, setPreview }: { store: TableStore; ctx: ReduceContext; game: ScenarioState; setReading: (reading: Reading) => void; setPreview: (target: PreviewTarget) => void }) {
  // What the zone selectors read of a printing (ships first, the fold order of staging) and the success symbols a look marks (the engine counts the same printed symbols).
  const facts = useMemo(() => zoneFactsOf(ctx.cards), [ctx]);
  const success = useCallback((code: string) => successOf(ctx.cards, code), [ctx]);
  const onPreview = useCallback((id: string, extra: readonly string[] = []) => setPreview({ id, extra }), [setPreview]);
  // A discard pile opens its list; a fold stack says which row it folds (row-fold.ts): its list opens on a tap or a long press; a deck with an encounter card attached to it (Iron Shackles,
  // 01105:A:1) opens that card, whose preview says what it does.
  const onPile = useCallback(
    (id: string) => {
      if (id === "staging" || id === "engaged") return setReading({ kind: "row", row: id });
      if (isDiscardPile(id as PileId)) return setReading({ kind: "pile", pile: id as PileId });
      const { game: now, viewedSeat } = store.getState();
      const shackles = id === "deck" ? now.seats[shownSeat(now, viewedSeat)]?.deckAttached?.[0] : undefined;
      if (shackles) setPreview({ id: shackles, extra: [] });
    },
    [store, setReading, setPreview],
  );
  // The Heading dial, after the seat dials, while the Heading card is in play: a tap opens the card's preview (it never changes the dial).
  const headingNow = useMemo(() => headingReadout(game), [game]);
  const headingStep = headingNow?.step ?? null;
  const headingCard = headingNow?.cardId ?? null;
  const headingDial = useMemo((): HeadingDialProps | null => (headingStep ? { step: headingStep, onPress: () => (headingCard ? onPreview(headingCard) : undefined) } : null), [headingStep, headingCard, onPreview]);
  return { facts, success, onPreview, onPile, headingDial };
}
