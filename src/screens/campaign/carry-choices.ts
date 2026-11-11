// What a finished playthrough hands to a new campaign, as the campaign setup screen offers it (docs/design-system.md, Campaign setup).
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { continueOffers } from "../../campaign/continue";
import { carryOffers } from "../../campaign/carry-over";
import type { PoolCard } from "../../campaign/log";
import type { Save } from "../../campaign/save";
import { campaignOf } from "../data/campaign-data";
import { listArchivedSaves, listSaves, savedAt, type ListedSave } from "../data/campaign-store";
import { carrySource, carryWords, continueWords } from "./carry-words";
import { deckFaces } from "../deck/store";
import type { AppDatabases } from "../data/open-databases";
import { seatWord } from "../data/seats";

/** One offer as the setup screen draws it: the finished campaign, what tells it apart, and its cards in words. */
export type CarryChoice = { saveId: string; label: string; source: string; words: string; cards: readonly PoolCard[] };

/** One finished save of the box before this one that a new save may continue (docs/brief.md, The Two Towers): the whole log is copied, so the choice carries the save's log and seat count. */
export type ContinueChoice = { saveId: string; label: string; source: string; words: string; seatCount: 1 | 2; from: Pick<Save, "id" | "campaignId" | "seatCount" | "log"> };

type Stores = { saves: ListedSave[]; archived: ListedSave[]; saved: ReadonlyMap<string, number> };

const NO_STORES: Stores = { saves: [], archived: [], saved: new Map() };

/**
 * The carry-over a new playthrough may take in: every finished playthrough, open or archived, that holds cards for the next campaign
 * and that no other playthrough has taken; and, for a saga box, the finished playthroughs of the box before it that no other has
 * continued. The saves are read again on focus.
 */
export function useCarryChoices(catalog: AppDatabases["catalog"], user: AppDatabases["user"], campaignId: string | null): { carry: CarryChoice[]; continues: ContinueChoice[] } {
  const [stores, setStores] = useState<Stores>(NO_STORES);
  useFocusEffect(
    useCallback(() => {
      setStores({ saves: listSaves(user), archived: listArchivedSaves(user), saved: savedAt(user) });
    }, [user]),
  );
  const every = [...stores.saves, ...stores.archived];
  const scenarios = (id: string) => campaignOf(id)?.scenarios ?? null;
  const offers = carryOffers(every, scenarios);
  const continuing = campaignId ? continueOffers(every, campaignId, scenarios) : [];
  const faces = deckFaces(catalog, offers.flatMap((offer) => offer.cards.map((card) => card.code)));
  const carry = offers.map((offer) => ({
    saveId: offer.saveId,
    label: campaignOf(offer.campaignId)?.name ?? offer.campaignId,
    source: carrySource(seatWord(offer.seatCount), stores.saved.get(offer.saveId) ?? null, offer.score),
    words: carryWords(offer.cards, (code) => faces.get(code)?.name ?? code),
    cards: offer.cards,
  }));
  const continues = continuing.flatMap((offer): ContinueChoice[] => {
    const from = every.find((save) => save.id === offer.saveId);
    return from
      ? [{ saveId: offer.saveId, label: campaignOf(offer.campaignId)?.name ?? offer.campaignId, source: carrySource(seatWord(offer.seatCount), stores.saved.get(offer.saveId) ?? null, offer.score), words: continueWords(offer), seatCount: offer.seatCount, from: { id: from.id, campaignId: from.campaignId, seatCount: from.seatCount, log: from.log } }]
      : [];
  });
  return { carry, continues };
}
