// The Scenarios hub's catalog as the flat items of one FlashList (docs/design-system.md, Scenarios; Performance: a list is a FlashList):
// Collapse all, each box's fold header and the rows of its tiles, then Coming later's header and its locked tiles. A folded box adds
// its header alone, so its tiles are never mounted. A row holds one tile on a phone (`posters` 0) and `posters` tiles across on a
// tablet. Pure, so a test reads it in Node.

/** A box's playable scenario: its id and its number in the book. */
export type HubEntry = { id: string; number: number };

export type HubItem =
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
};

/** The fold id of a box (`settings.sections`). */
export const boxFoldId = (boxId: string) => `box-${boxId}`;

export function hubItems({ boxes, waiting, posters, folded }: HubItemsInput): HubItem[] {
  const across = Math.max(1, posters);
  const folds = boxes.length + (waiting > 0 ? 1 : 0);
  const items: HubItem[] = folds > 1 ? [{ type: "fold-all", id: "scenarios-fold-all" }] : [];
  for (const { box, playable } of boxes) {
    const id = boxFoldId(box.id);
    const shut = folded(id);
    items.push({ type: "box", id, boxId: box.id, name: box.name, count: playable.length, folded: shut });
    if (shut) continue;
    for (let start = 0; start < playable.length; start += across) {
      const entries = playable.slice(start, start + across);
      items.push({ type: "tiles", id: `${id}-${entries[0]?.id ?? start}`, boxId: box.id, entries, first: start === 0 });
    }
  }
  if (waiting > 0) {
    const shut = folded("scenarios-coming");
    items.push({ type: "coming", id: "scenarios-coming", count: waiting, folded: shut });
    if (!shut) items.push({ type: "locked", id: "locked-scenarios" });
  }
  return items;
}
