// The pictures the table asks the image cache for (docs/architecture.md, Images): the hand, the cards on the table and the screen about to open, and a card
// the player picks up. Never the whole cache: the canvas draws names until a file lands.
import { useEffect, useMemo } from "react";

import { pictureCode, pictureKey } from "../play/picture-key";
import { prefetchCodes, resolutionCodes } from "../play/prefetch";
import type { ScenarioState, TableStore } from "../play/store";
import { enqueueImageDownloads } from "./images/queue";

type PictureFacts = ReadonlyMap<string, { imagesrc?: string | null; backImagesrc?: string | null }>;

// The file to download for a picture key: side A's picture for a code, side B's for `<code>.B` (a quest stage turned to its B side), cached under the key.
function sourceOf(facts: PictureFacts, key: string): string | null {
  const code = pictureCode(key);
  const card = facts.get(code);
  return (key === code ? card?.imagesrc : card?.backImagesrc) ?? null;
}

export function useTablePictures(store: TableStore, session: { facts: PictureFacts }, game: ScenarioState, shown: number): void {
  // The keys are joined into one string so the effect runs when the set changes, not on every intent.
  const wanted = useMemo(() => prefetchCodes(game, shown, resolutionCodes(game)).join(","), [game, shown]);
  useEffect(() => {
    const jobs = wanted.split(",").flatMap((code) => {
      const imagesrc = sourceOf(session.facts, code);
      return imagesrc ? [{ code, imagesrc, first: true }] : [];
    });
    if (jobs.length > 0) enqueueImageDownloads(jobs);
  }, [session, wanted]);
  // A card picked up (a drag begins, the canvas selects it) is fetched at once if its picture is missing. The pickup is the store's `selected`,
  // read here from a listener instead of a subscription, so picking a card up does not render the view or the hooks and panels under it. A fallen
  // hero (`<code>~enemy`) is fetched by the hero's code, a card on its B side by that side's key.
  useEffect(
    () =>
      store.subscribe((state, before) => {
        const id = state.selected;
        if (id == null || id === before.selected) return;
        const card = state.game.cards[id];
        const key = card ? pictureKey(card) : null;
        const imagesrc = key ? sourceOf(session.facts, key) : null;
        if (key && imagesrc) enqueueImageDownloads([{ code: key, imagesrc, first: true }]);
      }),
    [store, session],
  );
}
