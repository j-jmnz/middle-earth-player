// The part of the table's choice hook that exists only for a phone screen reader (use-table-choice.ts calls it; docs/design-system-table.md,
// Screen reader): the card or row the reader last activated and whether focus stays on it when the moment changes, the step action on a
// share row, and the seed the reader table reads. With no reader on (`readerMode` false) it holds nothing and returns nothing new.
import { useCallback, useEffect, useState } from "react";

import type { PrintedCard } from "../../rules/core/printed.ts";
import { clearAnnouncements } from "../../ui/announce.ts";
import type { ReaderSeed } from "../canvas/table-canvas-types.ts";
import { holdsFocus, touchedAfter, type TouchedEnd } from "./reader-moment.ts";
import type { Sheet } from "./sheet-types.ts";
import { stepChoice } from "./tray-logic.ts";
import { tappable, type Choice } from "./table-choice.ts";

export type ReaderChoice = {
  readerSeed: ReaderSeed | null;
  // Focus stays where it is when the moment changes: it is on a card the new moment still asks about (reader-moment.ts).
  stayFocus: boolean;
  // A card or row was activated (set only under the reader).
  touch: (id: string) => void;
  // A reset reached from `end`: an accepted send keeps the touched card, every other end clears it.
  reset: (end: TouchedEnd) => void;
  // A screen reader's increment or decrement action on a share row: one share more or less (tray-logic.ts, stepChoice).
  onStep: (id: string, delta: 1 | -1) => void;
};

export function useReaderChoice({ readerMode, sheet, held, setHeld, peeking, cards }: { readerMode: boolean; sheet: Sheet; held: Choice | null; setHeld: (choice: Choice) => void; peeking: boolean; cards: ReadonlyMap<string, PrintedCard> }): ReaderChoice {
  // The card or row a screen reader's user last activated: focus stays on it when the next moment still asks about it.
  const [touched, setTouched] = useState<string | null>(null);
  const stayFocus = readerMode && touched != null && !peeking && holdsFocus(touched, tappable(sheet));
  // A moment whose focus moves to the dock's title leaves no card to stay on, and a peek at the other seat ends the card's hold: the card is
  // forgotten when the sheet's key or the peek changes (adjusted during the render that brings it, so the dock reads the result).
  const [seen, setSeen] = useState({ key: sheet.key, peeking });
  if (seen.key !== sheet.key || seen.peeking !== peeking) {
    setSeen({ key: sheet.key, peeking });
    if (touched != null && (peeking || !stayFocus)) setTouched(null);
  }
  // Leaving the table (or hiding it) forgets the card and drops the lines not yet said.
  useEffect(
    () => () => {
      setTouched((now) => touchedAfter(now, "leave"));
      clearAnnouncements();
    },
    [],
  );
  const touch = useCallback(
    (id: string) => {
      if (readerMode) setTouched(id);
    },
    [readerMode],
  );
  const reset = useCallback((end: TouchedEnd) => setTouched((now) => touchedAfter(now, end)), []);
  const onStep = useCallback(
    (id: string, delta: 1 | -1) => {
      const next = stepChoice(sheet, held, id, delta);
      if (next) setHeld(next);
    },
    [sheet, held, setHeld],
  );
  return { readerSeed: readerMode ? { sheet, cards } : null, stayFocus, touch, reset, onStep };
}
