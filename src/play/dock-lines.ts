// The dock's lines under the moment's title (docs/design-system-table.md, Command column; phase 22): the first-game guide, the
// moment's note and what the rules refuse now. One line shows; the rest wait behind the "i" pill (dock-more), which opens them in
// place. A screen reader hears every sentence either way (`spoken`). Pure; the dock draws it.
import type { Unavailable } from "./sheet-types.ts";

export type DockLine = { testID: string; text: string; kind: "guide" | "note" | "unavailable" };

export type DockLines = {
  // The line that shows while the rest is folded, or null when there is none.
  first: DockLine | null;
  // The lines behind the "i" pill, in order.
  rest: readonly DockLine[];
  // Every line in one sentence run, for the line's accessibility label while folded.
  spoken: string;
  // The "i" pill is worth showing: lines are folded, or the first one is longer than the room the folded line has (`chars`).
  foldable: boolean;
};

/**
 * The guide (when it is on), then the note, then each refusal; the first shows and the others fold. `chars` is about how many
 * characters the folded line holds (its lines times the dock's width in label type), so a long first line also gets the pill.
 */
export function dockLines(a: { guide: string | null; note: string | null; unavailable: readonly Unavailable[]; chars?: number }): DockLines {
  const lines: DockLine[] = [
    ...(a.guide ? [{ testID: "dock-guide", text: `Guide: ${a.guide}`, kind: "guide" as const }] : []),
    ...(a.note ? [{ testID: "sheet-note", text: a.note, kind: "note" as const }] : []),
    ...a.unavailable.map((item) => ({ testID: `sheet-unavailable-${item.id}`, text: `${item.label}: ${item.reason}`, kind: "unavailable" as const })),
  ];
  const first = lines[0] ?? null;
  return { first, rest: lines.slice(1), spoken: lines.map((line) => line.text).join(" "), foldable: lines.length > 1 || (first != null && first.text.length > (a.chars ?? Infinity)) };
}
