// What a screen reader hears of a pile and of a row's fold stack (reader-piles.tsx puts a button over each). Pure.
import type { CardSlot } from "../layout/layout.ts";
import { foldWords } from "../layout/row-fold.ts";
import { AREA_FOLD_WHERE } from "../words/stormcaller.ts";
import { pileCountWords } from "../words/sea.ts";
import { opensList, PILE_WORDS, type PileId } from "../store/selectors.ts";

/** What a screen reader hears of a pile slot or a fold stack, and what a tap on it does. */
export function pileSpeech(slot: Pick<CardSlot, "zone" | "count" | "fold" | "areaFold" | "points">): { label: string; hint: string | null } {
  if (slot.fold) return { label: foldWords(slot.count, slot.areaFold ? AREA_FOLD_WHERE : slot.fold === "staging" ? "staging" : "the engagement area"), hint: "Opens the list of these cards" };
  const pile = slot.zone as PileId;
  // The victory display also says what it scores: "Victory display, 3 cards, 5 victory points".
  const points = slot.points != null ? `, ${slot.points} victory ${slot.points === 1 ? "point" : "points"}` : "";
  return { label: `${pileCountWords(PILE_WORDS[pile], slot.count)}${points}`, hint: opensList(pile) ? "Opens the list of cards" : null };
}
