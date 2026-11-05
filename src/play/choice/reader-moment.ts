// What a screen reader is told when the table's moment changes (docs/design-system-table.md, Screen reader), as pure functions the dock
// and the choice hook only pass on. Read only under useReaderMode.
import type { Sheet } from "./sheet-types.ts";
import type { Dock } from "./table-choice.ts";

/**
 * True when focus stays where the reader is: the card it last activated (a tap on the table or on a row) is one the new moment still asks
 * about, so moving to the dock's title would take it off the card it is working on.
 */
export function holdsFocus(touched: string | null, asked: ReadonlySet<string>): boolean {
  return touched != null && asked.has(touched);
}

/**
 * What is announced for a new moment once focus has settled. When focus moved to the dock's title, the reader hears the title (and its step
 * and count) from the focus itself, so only the note is added; when focus stayed on a card, the title is announced with its note.
 */
export function momentSpeech(a: { title: string; note: string | null; moved: boolean }): string {
  const note = a.note?.trim() ?? "";
  if (a.moved) return note;
  return [a.title, note].filter((part) => part.length > 0).join(". ");
}

// The dock's sentence under a primary that waits for a pick, in the words a reader can follow: no card glows on the reader's table.
const GLOW_WHY: Readonly<Record<string, string>> = {
  pick: "Choose a card that can be picked.",
  multi: "Choose at least one card.",
  trigger: "Choose a card that can be used.",
};

/** The dock's `why` for a reader: a sentence that names a glowing card says what the reader's list says instead; any other stays. */
export function readerWhy(sheet: Sheet, why: string | null): string | null {
  if (why == null || !/glowing/i.test(why)) return why;
  return GLOW_WHY[sheet.kind] ?? why;
}

/** The dock a reader gets: the same dock, its waiting sentence in a reader's words (`readerWhy`). The very same dock when not `reader`, or when nothing changes. */
export function readerDock(dock: Dock, sheet: Sheet, reader: boolean): Dock {
  if (!reader) return dock;
  const why = readerWhy(sheet, dock.why);
  return why === dock.why ? dock : { ...dock, why };
}
