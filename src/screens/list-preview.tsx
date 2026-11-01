// The long-press preview for a screen that lists cards (a pack, the card pool): a row hands over its code, name and the
// picture it already shows, and the screen draws the preview over everything as its last child. A screen that names cards in its
// text (the campaign log, the path's pool) hands over only the code (`openCode`): the name and the picture are looked up on the tap.
import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { cards } from "../catalog/schema";
import { CardPreview, type PreviewCard } from "../play/card-preview";
import type { PictureSource } from "../play/table-canvas-types";
import { useDatabases } from "./databases";
import { cardImageUrl, shownCardImage } from "./images/policy";
import { scanAssets } from "./images/scan-map";
import { cachedImage } from "./images/store";

// The picture a card shows now, read on the tap: its downloaded file, else its bundled scan, else its remote picture.
function pictureNow(code: string, imagesrc: string | null): PictureSource | null {
  const { source } = shownCardImage({ cached: cachedImage(code), imagesrc, bundled: scanAssets[code] ?? null });
  if (source) return source;
  const remote = imagesrc ? cardImageUrl(imagesrc) : null;
  return remote ? { uri: remote } : null;
}

export function useListPreview() {
  const router = useRouter();
  const { catalog } = useDatabases();
  const [card, setCard] = useState<PreviewCard | null>(null);
  const open = useCallback(
    (code: string, name: string, source: PictureSource | null) => {
      const row = catalog.select({ typeCode: cards.typeCode, text: cards.text }).from(cards).where(eq(cards.code, code)).get();
      setCard({ code, name, source, landscape: row?.typeCode === "quest", text: row?.text ?? null });
    },
    [catalog],
  );
  const openCode = useCallback(
    (code: string) => {
      const row = catalog.select({ name: cards.name, imagesrc: cards.imagesrc, typeCode: cards.typeCode, text: cards.text }).from(cards).where(eq(cards.code, code)).get();
      if (!row) return;
      setCard({ code, name: row.name, source: pictureNow(code, row.imagesrc), landscape: row.typeCode === "quest", text: row.text ?? null });
    },
    [catalog],
  );
  const close = useCallback(() => setCard(null), []);
  const overlay = card ? (
    <CardPreview key={card.code} card={card} onClose={close} onDetails={(code) => router.push({ pathname: "/card/[code]", params: { code } })} />
  ) : null;
  return { open, openCode, overlay };
}
