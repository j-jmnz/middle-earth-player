// What the briefing's card rows and the campaign setup's share (scenario-cards.tsx, campaign-cards.tsx): a card's name and picture read once from the
// catalog for its row.
import { eq } from "drizzle-orm";
import { useMemo } from "react";

import { cards } from "../../catalog/schema";
import { useDatabases } from "../data/databases";

/** The name and picture a row shows for this card, or null while it has none (no code, or a code the catalog lacks). */
export function useCardFacts(code: string | undefined): { name: string; imagesrc: string | null } | null {
  const { catalog } = useDatabases();
  return useMemo(() => (code ? (catalog.select({ name: cards.name, imagesrc: cards.imagesrc }).from(cards).where(eq(cards.code, code)).get() ?? null) : null), [catalog, code]);
}
