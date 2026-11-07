// The deck list's drag-to-reorder, as plain functions. The gesture (deck/reorder.tsx) calls the worklet ones on the UI thread.

export type SlotRect = { x: number; y: number; width: number; height: number };
export type Shift = { x: number; y: number };

/** `items` with the one at `from` moved to `to` (both clamped into the list). A new array; the same items when nothing moves. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const out = [...items];
  if (from < 0 || from >= out.length) return out;
  const target = Math.max(0, Math.min(out.length - 1, to));
  if (target === from) return out;
  const [moved] = out.splice(from, 1);
  out.splice(target, 0, moved!);
  return out;
}

/** Which of Move up / Move down a deck at `place` of `count` can move: each direction that has room (the other button is drawn disabled, not left out). */
export function moveChoices(place: number, count: number): { up: boolean; down: boolean } {
  return { up: place > 0 && place < count, down: place >= 0 && place < count - 1 };
}

/** The slot whose centre is nearest the point: where the dragged deck would land if let go there. */
export function nearestSlot(rects: readonly SlotRect[], cx: number, cy: number): number {
  "worklet";
  let best = 0;
  let bestDistance = Infinity;
  for (let at = 0; at < rects.length; at += 1) {
    const rect = rects[at]!;
    const dx = rect.x + rect.width / 2 - cx;
    const dy = rect.y + rect.height / 2 - cy;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = at;
    }
  }
  return best;
}

/**
 * How far each deck (by its place now) moves from its own slot while the one at `from` is held over `to`: the decks between
 * shift one place toward `from`, and the held deck's entry is where it settles. One column packs the decks one under another
 * (their heights may differ); a grid reuses the slots, whose cells are the same size.
 */
export function shiftsFor(rects: readonly SlotRect[], from: number, to: number): Shift[] {
  "worklet";
  const n = rects.length;
  const order: number[] = [];
  for (let at = 0; at < n; at += 1) order.push(at);
  order.splice(from, 1);
  order.splice(to, 0, from);
  const first = rects[0];
  const single = n > 0 && rects.every((rect) => rect.x === first!.x);
  const out: Shift[] = rects.map(() => ({ x: 0, y: 0 }));
  let y = first ? Math.min(...rects.map((rect) => rect.y)) : 0;
  for (let slot = 0; slot < n; slot += 1) {
    const deck = order[slot]!;
    const own = rects[deck]!;
    const at = single ? { x: own.x, y } : rects[slot]!;
    out[deck] = { x: at.x - own.x, y: at.y - own.y };
    y += own.height;
  }
  return out;
}
