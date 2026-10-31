// What a screen reader hears of a pile and of a row's fold stack (reader-piles.tsx puts a button over each). Pure.
import type { CardSlot } from "./layout.ts";
import { foldWords } from "./row-fold.ts";
import { pileCountWords } from "./sea-words.ts";
import { isDiscardPile, PILE_WORDS, type PileId } from "./selectors.ts";

/** What a screen reader hears of a pile slot or a fold stack, and what a tap on it does. */
export function pileSpeech(slot: Pick<CardSlot, "zone" | "count" | "fold">): { label: string; hint: string | null } {
  if (slot.fold) return { label: foldWords(slot.count, slot.fold === "staging" ? "staging" : "the engagement area"), hint: "Opens the list of these cards" };
  const pile = slot.zone as PileId;
  return { label: pileCountWords(PILE_WORDS[pile], slot.count), hint: isDiscardPile(pile) ? "Opens the list of cards" : null };
}
