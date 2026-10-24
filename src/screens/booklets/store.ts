import type { BookletRow } from "../campaign-store";

// Web has no document directory to store a book in. The reader says so; the native file is store.native.ts.
export type ImportResult = { ok: true; row: BookletRow } | { ok: false; reason: "cancelled" | "notPdf" | "unavailable" | "failed"; message: string };

export function bookletUri(_row: BookletRow): string | null {
  return null;
}

export function bookletFileExists(_row: BookletRow): boolean {
  return false;
}

export async function importBooklet(_user: unknown, _id: string): Promise<ImportResult> {
  return { ok: false, reason: "unavailable", message: "Booklets can be stored on a phone, not in the browser." };
}
