// What a finished playthrough hands to a new campaign, as the campaign setup screen offers it (docs/design-system.md, Campaign setup).
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { carryOffers } from "../campaign/carry-over";
import type { PoolCard } from "../campaign/log";
import { campaignOf } from "./campaign-data";
import { listArchivedSaves, listSaves, savedAt, type ListedSave } from "./campaign-store";
import { carrySource, carryWords } from "./carry-words";
import { deckFaces } from "./deck-store";
import type { AppDatabases } from "./open-databases";
import { seatWord } from "./seats";

/** One offer as the setup screen draws it: the finished campaign, what tells it apart, and its cards in words. */
export type CarryChoice = { saveId: string; label: string; source: string; words: string; cards: readonly PoolCard[] };

type Stores = { saves: ListedSave[]; archived: ListedSave[]; saved: ReadonlyMap<string, number> };

const NO_STORES: Stores = { saves: [], archived: [], saved: new Map() };

/**
 * The carry-over a new playthrough may take in: every finished playthrough, open or archived, that holds cards for the next campaign
 * and that no other playthrough has taken. The saves are read again on focus.
 */
export function useCarryChoices(catalog: AppDatabases["catalog"], user: AppDatabases["user"]): CarryChoice[] {
  const [stores, setStores] = useState<Stores>(NO_STORES);
  useFocusEffect(
    useCallback(() => {
      setStores({ saves: listSaves(user), archived: listArchivedSaves(user), saved: savedAt(user) });
    }, [user]),
  );
  const offers = carryOffers([...stores.saves, ...stores.archived], (id) => campaignOf(id)?.scenarios ?? null);
  const faces = deckFaces(catalog, offers.flatMap((offer) => offer.cards.map((card) => card.code)));
  return offers.map((offer) => ({
    saveId: offer.saveId,
    label: campaignOf(offer.campaignId)?.name ?? offer.campaignId,
    source: carrySource(seatWord(offer.seatCount), stores.saved.get(offer.saveId) ?? null, offer.score),
    words: carryWords(offer.cards, (code) => faces.get(code)?.name ?? code),
    cards: offer.cards,
  }));
}
