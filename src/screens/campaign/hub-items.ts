// The Scenarios hub's catalog as the flat items of one FlashList (docs/design-system.md, Scenarios; Performance: a list is a FlashList):
// the search field, Collapse all, each box's fold header and the rows of its tiles, then Coming later's header and its locked tiles. A folded box adds
// its header alone, so its tiles are never mounted. A row holds one tile on a phone (`posters` 0) and `posters` tiles across on a
// tablet. A search (`searchHub`) keeps the boxes, scenarios and locked tiles whose words loosely hold every word typed, opens every
// fold and leaves Collapse all out; when it keeps nothing the list says so. Pure, so a test reads it in Node.
import { searchWords } from "../groups/encounter-tree";
import { withinOneEdit } from "../kit/fold";

/** A box's playable scenario: its id and its number in the book. */
export type HubEntry = { id: string; number: number };

export type HubItem =
  | { type: "search"; id: "scenarios-search" }
  | { type: "empty"; id: "scenarios-empty" }
  | { type: "fold-all"; id: "scenarios-fold-all" }
  | { type: "box"; id: string; boxId: string; name: string; count: number; folded: boolean }
  | { type: "tiles"; id: string; boxId: string; entries: readonly HubEntry[]; first: boolean }
  | { type: "coming"; id: "scenarios-coming"; count: number; folded: boolean }
  | { type: "locked"; id: "locked-scenarios" };

export type HubItemsInput = {
  boxes: readonly { box: { id: string; name: string }; playable: readonly HubEntry[] }[];
  // How many scenarios wait under Coming later (0 leaves the fold out).
  waiting: number;
  // Poster tiles across a row; 0 for a phone's rows, one tile each.
  posters: number;
  // Whether the fold with this id is folded now.
  folded: (id: string) => boolean;
  // True while a search narrows the list: every fold is open and Collapse all is left out.
  searching?: boolean;
};

type HubBox = { box: { id: string; name: string }; playable: readonly HubEntry[] };

// A typed word this long is found anywhere in a word ("wood" in Mirkwood), and one this long is forgiven a one-letter slip (the card
// search's length, `card-search.ts`: a shorter word has too many neighbours, "ring" and "king").
const INSIDE_MIN = 3;
const SLIP_MIN = 5;

// The words of a name, and its words with the apostrophes dropped, so "helms" finds Helm's Deep.
const wordsOf = (text: string): string[] => [...searchWords(text), ...searchWords(text.replace(/['\u2018\u2019]/g, ""))];

// Whether a word of a name answers a typed word: it starts with it, holds it, or is one slip (a letter missed, added, wrong or two
// swapped) from it; the slip is also forgiven in the word's start, so a name half typed with a slip still stays ("mirkwod", "golum").
function answers(word: string, typed: string): boolean {
  if (word.startsWith(typed)) return true;
  if (typed.length >= INSIDE_MIN && word.includes(typed)) return true;
  if (typed.length < SLIP_MIN) return false;
  return [typed.length - 1, typed.length, typed.length + 1].some((length) => withinOneEdit(typed, word.slice(0, length)));
}

/** Whether the text loosely holds every word typed (accents, case and punctuation ignored). */
export function looselyHolds(text: string, typed: readonly string[]): boolean {
  const words = wordsOf(text);
  return typed.every((term) => words.some((word) => answers(word, term)));
}

/**
 * What a search keeps: a box whose name loosely holds the words keeps every scenario, otherwise a scenario stays when its name
 * holds them; a locked tile stays when its name and caption hold them. An empty search keeps everything.
 */
export function searchHub<B extends HubBox, W extends { name: string; caption: string }>(boxes: readonly B[], waiting: readonly W[], text: string, nameOf: (scenarioId: string) => string): { searching: boolean; boxes: readonly B[]; waiting: readonly W[] } {
  const words = searchWords(text);
  if (words.length === 0) return { searching: false, boxes, waiting };
  const kept = boxes.flatMap((entry): B[] => {
    if (looselyHolds(entry.box.name, words)) return [entry];
    const playable = entry.playable.filter(({ id }) => looselyHolds(nameOf(id), words));
    return playable.length > 0 ? [{ ...entry, playable }] : [];
  });
  return { searching: true, boxes: kept, waiting: waiting.filter((tile) => looselyHolds(`${tile.name} ${tile.caption}`, words)) };
}

/** The fold id of a box (`settings.sections`). */
export const boxFoldId = (boxId: string) => `box-${boxId}`;

export function hubItems({ boxes, waiting, posters, folded, searching = false }: HubItemsInput): HubItem[] {
  const across = Math.max(1, posters);
  const folds = boxes.length + (waiting > 0 ? 1 : 0);
  const items: HubItem[] = [{ type: "search", id: "scenarios-search" }];
  if (folds === 0) items.push({ type: "empty", id: "scenarios-empty" });
  if (folds > 1 && !searching) items.push({ type: "fold-all", id: "scenarios-fold-all" });
  for (const { box, playable } of boxes) {
    const id = boxFoldId(box.id);
    const shut = !searching && folded(id);
    items.push({ type: "box", id, boxId: box.id, name: box.name, count: playable.length, folded: shut });
    if (shut) continue;
    for (let start = 0; start < playable.length; start += across) {
      const entries = playable.slice(start, start + across);
      items.push({ type: "tiles", id: `${id}-${entries[0]?.id ?? start}`, boxId: box.id, entries, first: start === 0 });
    }
  }
  if (waiting > 0) {
    const shut = !searching && folded("scenarios-coming");
    items.push({ type: "coming", id: "scenarios-coming", count: waiting, folded: shut });
    if (!shut) items.push({ type: "locked", id: "locked-scenarios" });
  }
  return items;
}
