// The pictures the table asks the image cache for (docs/architecture.md, Images): the hand, the cards on the table and the screen about to open, and a card
// the player picks up. Never the whole cache: the canvas draws names until a file lands.
import { useEffect, useMemo } from "react";

import { pictureCode } from "../play/picture-key";
import { prefetchCodes, resolutionCodes } from "../play/prefetch";
import type { ScenarioState, TableStore } from "../play/store";
import { enqueueImageDownloads } from "./images/queue";

export function useTablePictures(store: TableStore, session: { facts: ReadonlyMap<string, { imagesrc?: string | null }> }, game: ScenarioState, shown: number): void {
  // The codes are joined into one string so the effect runs when the set changes, not on every intent.
  const wanted = useMemo(() => prefetchCodes(game, shown, resolutionCodes(game)).join(","), [game, shown]);
  useEffect(() => {
    const jobs = wanted.split(",").flatMap((code) => {
      const imagesrc = session.facts.get(code)?.imagesrc;
      return imagesrc ? [{ code, imagesrc, first: true }] : [];
    });
    if (jobs.length > 0) enqueueImageDownloads(jobs);
  }, [session, wanted]);
  // A card picked up (a drag begins, the canvas selects it) is fetched at once if its picture is missing. The pickup is the store's `selected`,
  // read here from a listener instead of a subscription, so picking a card up does not render the view or the hooks and panels under it. A fallen
  // hero (`<code>~enemy`) is fetched by the hero's code.
  useEffect(
    () =>
      store.subscribe((state, before) => {
        const id = state.selected;
        if (id == null || id === before.selected) return;
        const code = state.game.cards[id]?.code;
        const imagesrc = code ? session.facts.get(pictureCode(code))?.imagesrc : undefined;
        if (code && imagesrc) enqueueImageDownloads([{ code: pictureCode(code), imagesrc, first: true }]);
      }),
    [store, session],
  );
}
