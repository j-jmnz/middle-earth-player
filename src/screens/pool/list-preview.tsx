// The long-press preview for a screen that lists cards (a pack, the card pool): a row hands over its code, name and the
// picture it already shows, and the screen draws the preview over everything as its last child. A screen that names cards in its
// text (the campaign log, the path's pool) hands over only the code (`openCode`): the name and the picture are looked up on the tap.
// `openSides` opens several card sides in one preview, the first large and the rest in its strip (the briefing's quest cards).
import { eq, inArray } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { cards } from "../../catalog/schema";
import { CardPreview, type PreviewCard } from "../../play/cards/card-preview";
import { sideText } from "../../play/cards/ledger";
import type { PictureSource } from "../../play/canvas/table-canvas-types";
import { useDatabases } from "../data/databases";

import { cardImageUrl, shownCardImage } from "../images/policy";
import { scanAssets } from "../images/scan-map";
import { cachedImage } from "../images/store";

/** One side of a card to show: side B reads its own picture (`<code>.B`, picture-key.ts) and its ledger lines. `label` is the line over its name ("Stage 2B"). */
export type CardSide = { code: string; side: "A" | "B"; label?: string };

// The picture a card shows now, read on the tap: its downloaded file, else its bundled scan, else its remote picture.
function pictureNow(code: string, imagesrc: string | null): PictureSource | null {
  const { source } = shownCardImage({ cached: cachedImage(code), imagesrc, bundled: scanAssets[code] ?? null });
  if (source) return source;
  const remote = imagesrc ? cardImageUrl(imagesrc) : null;
  return remote ? { uri: remote } : null;
}

// The preview's cards for these sides, read from the catalog in one query; a code the catalog lacks is left out.
function previewSides(catalog: ReturnType<typeof useDatabases>["catalog"], sides: readonly CardSide[]): PreviewCard[] {
  const rows = catalog
    .select({ code: cards.code, name: cards.name, imagesrc: cards.imagesrc, backImagesrc: cards.backImagesrc, typeCode: cards.typeCode, text: cards.text })
    .from(cards)
    .where(inArray(cards.code, [...new Set(sides.map((entry) => entry.code))]))
    .all();
  const byCode = new Map(rows.map((row) => [row.code, row]));
  return sides.flatMap((entry): PreviewCard[] => {
    const row = byCode.get(entry.code);
    if (!row) return [];
    const back = entry.side === "B";
    const source = back ? pictureNow(`${entry.code}.B`, row.backImagesrc) : pictureNow(entry.code, row.imagesrc);
    const text = (back ? sideText(entry.code, "B") : null) ?? row.text ?? null;
    const role = entry.label ?? (back ? "Side B" : null);
    return [{ code: entry.code, name: row.name, source, landscape: row.typeCode === "quest", text, ...(role ? { role } : {}) }];
  });
}

export function useListPreview() {
  const router = useRouter();
  const { catalog } = useDatabases();
  const [card, setCard] = useState<PreviewCard | null>(null);
  // The cards in the preview's strip after the first (openSides).
  const [related, setRelated] = useState<readonly PreviewCard[]>([]);
  const open = useCallback(
    (code: string, name: string, source: PictureSource | null) => {
      const row = catalog.select({ typeCode: cards.typeCode, text: cards.text }).from(cards).where(eq(cards.code, code)).get();
      setCard({ code, name, source, landscape: row?.typeCode === "quest", text: row?.text ?? null });
      setRelated([]);
    },
    [catalog],
  );
  const openSides = useCallback(
    (sides: readonly CardSide[]) => {
      const [first, ...rest] = previewSides(catalog, sides);
      if (!first) return;
      setCard(first);
      setRelated(rest);
    },
    [catalog],
  );
  const openCode = useCallback(
    (code: string) => {
      const [first] = previewSides(catalog, [{ code, side: "A" }]);
      if (!first) return;
      setCard(first);
      setRelated([]);
    },
    [catalog],
  );
  const close = useCallback(() => setCard(null), []);
  const overlay = card ? (
    <CardPreview key={card.code} card={card} related={related} onClose={close} onDetails={(code) => router.push({ pathname: "/card/[code]", params: { code } })} />
  ) : null;
  return { open, openCode, openSides, overlay };
}
