import { useCallback, useMemo } from "react";

import type { PictureSource } from "../../play/canvas/table-canvas-types";
import { pictureCode, pictureKey } from "../../play/canvas/picture-key";
import { ledgerLine } from "../../play/cards/ledger";
import { notAppliedCodes } from "../../play/cards/not-applied";
import { shownName } from "../../play/cards/shown-name";
import type { SheetNames } from "../../play/choice/sheet-types";
import type { TableStore } from "../../play/store/store";
import { scanAssets } from "../images/scan-map";
import { cachedImage } from "../images/store";
import type { OpenedTable } from "./view";

// What the table view asks of a card by its picture key: the name it shows, its sphere, the picture it is drawn from, whether a
// printed line of it is not applied. A Lost Island lying on its Lost Island side (dcce.uncharted) answers as that side only.

// By picture key (src/play/canvas/picture-key.ts): the bundled picture of the key, else its downloaded file. `exact`: that picture only, never the other side's: a
// Lost Island's side B never shows the real side behind it (dcce.uncharted), and a card on its B side that has a side B picture to download (a quest stage
// turned to 1B) never shows side A meanwhile; until the file lands the card is drawn on paper. Otherwise a key with neither falls back to side A's picture.
function picture(key: string, exact = false): PictureSource | null {
  const bundledSide = scanAssets[key];
  if (bundledSide) return bundledSide.moduleId;
  const cachedSide = cachedImage(key);
  if (cachedSide) return { uri: cachedSide.uri };
  if (exact) return null;
  const code = pictureCode(key);
  const bundled = scanAssets[code];
  if (bundled) return bundled.moduleId;
  const cached = cachedImage(code);
  return cached ? { uri: cached.uri } : null;
}

// The lookups made since the image cache last changed (`revision`, images/store.ts). A card shown large (the preview, the advanced stage) is
// described during the render and its description is kept while its inputs are the same, so the picture it shows has to be an input: this
// reads `picture` for a revision and is read again only when the revision moves, which re-describes the card when its file lands.
let looked: { revision: number; sources: Map<string, PictureSource | null> } = { revision: -1, sources: new Map() };
export function pictureAt(key: string, revision: number, exact: boolean): PictureSource | null {
  if (looked.revision !== revision) looked = { revision, sources: new Map() };
  const at = exact ? `${key}!` : key;
  if (!looked.sources.has(at)) looked.sources.set(at, picture(key, exact));
  return looked.sources.get(at) ?? null;
}

export function useCardLookups(session: OpenedTable, store: TableStore) {
  // By picture key: a fallen hero (`<code>~enemy`) keeps the hero's name, and a Lost Island lying on its Lost Island side shows that name, never the location it turns out to be (src/play/cards/shown-name.ts).
  const nameOf = useCallback((key: string) => shownName(key, session.world.cards.get(pictureCode(key))), [session]);
  const sphereOf = useCallback((code: string) => (session.world.cards.get(code) ?? session.world.cards.get(pictureCode(code)))?.sphere ?? null, [session]);
  // A Lost Island lying on its Lost Island side is drawn from its own picture only.
  const lostIsland = useCallback((key: string) => key !== pictureCode(key) && session.world.cards.get(pictureCode(key))?.keywords.uncharted === true, [session]);
  // A card on its B side with a side B picture to download (a quest stage after setup) is drawn from that picture only, never side A's (picture, above).
  const ownSide = useCallback((key: string) => lostIsland(key) || (key !== pictureCode(key) && session.facts.get(pictureCode(key))?.backImagesrc != null), [lostIsland, session]);
  const pictureOf = useCallback((key: string) => picture(key, ownSide(key)), [ownSide]);
  const names: SheetNames = useMemo(
    () => ({
      card: (cardId: string) => {
        const card = store.getState().game.cards[cardId];
        return nameOf(card ? pictureKey(card) : cardId);
      },
      // The real name of a Lost Island whose facedown side a look shows.
      facedown: (cardId: string) => nameOf(store.getState().game.cards[cardId]?.code ?? cardId),
      line: ledgerLine, text: (code: string) => session.facts.get(code)?.text ?? null }),
    [nameOf, store, session],
  );
  // A printed line no effect record reads is not applied: the canvas marks the card, and no control applies the line.
  const inactiveSet = useMemo(() => notAppliedCodes([...session.facts].map(([code, facts]) => [code, facts.text] as const)), [session]);
  // By picture key: a Lost Island lying on its Lost Island side has no line the app leaves out, whatever its other side lacks.
  const inactive = useCallback((key: string) => !lostIsland(key) && inactiveSet.has(pictureCode(key)), [inactiveSet, lostIsland]);
  return { nameOf, sphereOf, lostIsland, ownSide, pictureOf, names, inactive };
}
