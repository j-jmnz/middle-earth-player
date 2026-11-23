// The Scenarios hub's catalog as the flat items of one FlashList (docs/design-system.md, Scenarios; Performance: a list is a FlashList):
// the search field, Collapse all, each box's fold header and the rows of its tiles, then Coming later's header and its locked tiles. A folded box adds
// its header alone, so its tiles are never mounted. A row holds one tile on a phone (`posters` 0) and `posters` tiles across on a
// tablet. A search (`searchHub`) keeps the boxes, scenarios and locked tiles whose words hold every word typed, opens every fold and
// leaves Collapse all out; when it keeps nothing the list says so. Pure, so a test reads it in Node.
import { holds, searchWords } from "../groups/encounter-tree";

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

/**
 * What a search keeps (the Cards tab's rule, `searchEncounter`): a box whose name holds the words keeps every scenario, otherwise a
 * scenario stays when its name holds them; a locked tile stays when its name and caption hold them. An empty search keeps everything.
 */
export function searchHub<B extends HubBox, W extends { name: string; caption: string }>(boxes: readonly B[], waiting: readonly W[], text: string, nameOf: (scenarioId: string) => string): { searching: boolean; boxes: readonly B[]; waiting: readonly W[] } {
  const words = searchWords(text);
  if (words.length === 0) return { searching: false, boxes, waiting };
  const kept = boxes.flatMap((entry): B[] => {
    if (holds(entry.box.name, words)) return [entry];
    const playable = entry.playable.filter(({ id }) => holds(nameOf(id), words));
    return playable.length > 0 ? [{ ...entry, playable }] : [];
  });
  return { searching: true, boxes: kept, waiting: waiting.filter((tile) => holds(`${tile.name} ${tile.caption}`, words)) };
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
