import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { pdfPageCount } from "booklet-pdf";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { writeBooklet, type BookletRow } from "../campaign-store";
import { BOOKLET_DIRECTORY, bookletPath } from "./books";

export type ImportResult = { ok: true; row: BookletRow } | { ok: false; reason: "cancelled" | "notPdf" | "unavailable" | "failed"; message: string };

function fileOf(row: BookletRow): File {
  return new File(Paths.document, row.path);
}

/** The file:// URI of a stored book, or null when the file is not there (a restored backup, a cleared app). */
export function bookletUri(row: BookletRow): string | null {
  const file = fileOf(row);
  return file.exists ? file.uri : null;
}

function booksDirectory(): Directory {
  const directory = new Directory(Paths.document, BOOKLET_DIRECTORY);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

/**
 * Picks a PDF, copies it out of the picker's cache into `booklets/<id>.pdf` in the document directory, checks that the
 * platform can read it, and only then records the row. The picker cache is not the store. The file is never fetched
 * from a network and never read by the engine.
 */
export async function importBooklet<TRun>(user: BaseSQLiteDatabase<"sync", TRun>, id: string): Promise<ImportResult> {
  let picked: File | null = null;
  let partial: File | null = null;
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false });
    const asset = result.canceled ? null : (result.assets[0] ?? null);
    if (!asset) return { ok: false, reason: "cancelled", message: "No file was picked." };
    picked = new File(asset.uri);

    const directory = booksDirectory();
    partial = new File(directory, `${id}.partial`);
    if (partial.exists) partial.delete();
    picked.copy(partial);

    let pageCount: number;
    try {
      pageCount = await pdfPageCount(partial.uri);
    } catch {
      partial.delete();
      return { ok: false, reason: "notPdf", message: "That file is not a PDF this phone can open." };
    }

    // The stored book stays where it is until the new file has its digest and the row is written. The old book moves
    // aside under a temp name and comes back if anything after the swap fails.
    const finalFile = new File(directory, `${id}.pdf`);
    const aside = new File(directory, `${id}.previous`);
    if (aside.exists) aside.delete();
    const hadPrevious = finalFile.exists;
    if (hadPrevious) finalFile.rename(`${id}.previous`);
    try {
      partial.rename(`${id}.pdf`);
      // The renamed file is the stored book now; the cleanup below must not touch it.
      partial = null;
      const sha256 = await finalFile.digest("SHA-256");
      const row: BookletRow = {
        id,
        path: bookletPath(id),
        originalFilename: asset.name,
        byteSize: finalFile.size ?? asset.size ?? 0,
        sha256,
        pageCount,
        lastPage: 1,
      };
      writeBooklet(user, row);
      if (aside.exists) aside.delete();
      return { ok: true, row };
    } catch (error: unknown) {
      if (finalFile.exists) finalFile.delete();
      if (hadPrevious && aside.exists) aside.rename(`${id}.pdf`);
      throw error;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "The booklet could not be stored.";
    return { ok: false, reason: "failed", message };
  } finally {
    if (picked?.exists) picked.delete();
    if (partial?.exists) partial.delete();
  }
}
