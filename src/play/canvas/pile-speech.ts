// What a screen reader hears of a pile and of a row's fold stack (reader-piles.tsx puts a button over each). Pure.
import type { CardSlot } from "../layout/layout.ts";
import { foldWords } from "../layout/row-fold.ts";
import { areaWordsOf } from "../words/area-words.ts";
import type { AreaKind } from "../words/scenarios/stormcaller.ts";
import { pileCountWords } from "../words/scenarios/sea.ts";
import { opensList, PILE_WORDS, type PileId } from "../store/selectors.ts";

/**
 * What a screen reader hears of a pile slot or a fold stack, and what a tap on it does. A discard pile that wears the play mark (`playable`)
 * says so: "Discard pile, 5 cards, a card playable now". A fold stack that holds only the area's cards names the game's area (`area`, areaKind). The Grotto deck names its top card (`topName`): "Grotto deck, 6 cards, Undersea Grotto on top".
 */
export function pileSpeech(slot: Pick<CardSlot, "zone" | "count" | "fold" | "areaFold" | "points">, playable = false, topName?: string | null, topOpens = false, area?: AreaKind | null): { label: string; hint: string | null } {
  if (slot.fold) return { label: foldWords(slot.count, slot.areaFold ? areaWordsOf(area).foldWhere : slot.fold === "staging" ? "staging" : "the engagement area"), hint: "Opens the list of these cards" };
  const pile = slot.zone as PileId;
  // The victory display also says what it scores: "Victory display, 3 cards, 5 victory points".
  const points = slot.points != null ? `, ${slot.points} victory ${slot.points === 1 ? "point" : "points"}` : "";
  const plays = playable ? ", a card playable now" : "";
  // The Grotto deck's top card is free to read, Grotto side only: it is named and a tap opens it (dcce.grotto-deck).
  if (pile === "grottoDeck" && topName) return { label: `${pileCountWords(PILE_WORDS[pile], slot.count)}, ${topName} on top`, hint: "Opens the top card" };
  // A deck played with its top card faceup (Gandalf, 142002:A:1) opens that card; the caller names it after the label.
  const hint = opensList(pile) ? "Opens the list of cards" : topOpens ? "Opens the top card" : null;
  return { label: `${pileCountWords(PILE_WORDS[pile], slot.count)}${points}${plays}`, hint };
}
