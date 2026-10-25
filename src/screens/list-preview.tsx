// The long-press preview for a screen that lists cards (a pack, the card pool): a row hands over its code, name and the
// picture it already shows, and the screen draws the preview over everything as its last child.
import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { cards } from "../catalog/schema";
import { CardPreview, type PreviewCard } from "../play/card-preview";
import type { PictureSource } from "../play/table-canvas-types";
import { useDatabases } from "./databases";

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
  const close = useCallback(() => setCard(null), []);
  const overlay = card ? (
    <CardPreview key={card.code} card={card} onClose={close} onDetails={() => router.push({ pathname: "/card/[code]", params: { code: card.code } })} />
  ) : null;
  return { open, overlay };
}
