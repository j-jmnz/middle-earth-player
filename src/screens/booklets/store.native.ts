import { Asset } from "expo-asset";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { pdfPageCount } from "booklet-pdf";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { writeBooklet, type BookletRow } from "../data/campaign-store";
import { BOOKLET_DIRECTORY, bookletPath } from "./books";
import { bundledBooklets } from "./bundled-map";

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
 * Copies `source` into `booklets/<id>.pdf` in the document directory, checks that the platform can read it, and only
 * then records the row. The source file is left where it is; the caller owns it.
 */
async function storeBooklet<TRun>(user: BaseSQLiteDatabase<"sync", TRun>, id: string, source: File, originalFilename: string, sizeHint: number | null): Promise<ImportResult> {
  let partial: File | null = null;
  try {
    const directory = booksDirectory();
    partial = new File(directory, `${id}.partial`);
    if (partial.exists) partial.delete();
    // copy() is asynchronous in this expo-file-system: without the await, the reader opened a file still being written.
    await source.copy(partial);

    let pageCount: number;
    try {
      pageCount = await pdfPageCount(partial.uri);
    } catch (error: unknown) {
      partial.delete();
      // The native reason (the exception, the size, the first bytes) is kept so a report says why.
      const detail = error instanceof Error ? ` ${error.message}` : "";
      return { ok: false, reason: "notPdf", message: `That file is not a PDF this phone can open.${detail}` };
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
        originalFilename,
        byteSize: finalFile.size ?? sizeHint ?? 0,
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
    if (partial?.exists) partial.delete();
  }
}

/** True when this build carries the book's PDF (scripts/build/pack-booklets.ts filled the map). */
export function hasBundledBooklet(id: string): boolean {
  return bundledBooklets[id] != null;
}

/**
 * Stores the copy of the book this build carries, as if the player had picked it. The asset is resolved to a local file
 * (Android copies it out of the APK's resources into the cache) and copied into `booklets/`. A book the player added
 * stays; the reader calls this only when no stored file is there.
 */
// One install per book at a time: a remounted reader (StrictMode, a quick reopen) joins the install already running.
const installing = new Map<string, Promise<ImportResult>>();

export function installBundledBooklet<TRun>(user: BaseSQLiteDatabase<"sync", TRun>, id: string): Promise<ImportResult> {
  const running = installing.get(id);
  if (running) return running;
  const install = installFromAsset(user, id).finally(() => installing.delete(id));
  installing.set(id, install);
  return install;
}

async function installFromAsset<TRun>(user: BaseSQLiteDatabase<"sync", TRun>, id: string): Promise<ImportResult> {
  const bundled = bundledBooklets[id];
  if (!bundled) return { ok: false, reason: "unavailable", message: "This build does not carry that booklet." };
  const asset = Asset.fromModule(bundled.moduleId);
  let resolved: File | null = null;
  try {
    await asset.downloadAsync();
    if (!asset.localUri) return { ok: false, reason: "failed", message: "The bundled booklet could not be read." };
    resolved = new File(asset.localUri);
    // The bytes must be the pinned PDF before the platform reader sees them; a short or changed copy says so here.
    const size = resolved.size ?? 0;
    if (size !== bundled.bytes) return { ok: false, reason: "failed", message: `The bundled booklet came out ${size} bytes, not ${bundled.bytes}.` };
    const digest = (await resolved.digest("SHA-256")).toLowerCase();
    if (digest !== bundled.sha256) return { ok: false, reason: "failed", message: `The bundled booklet does not match its pin (sha256 ${digest}).` };
    return await storeBooklet(user, id, resolved, bundled.filename, size);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "The bundled booklet could not be stored.";
    return { ok: false, reason: "failed", message };
  } finally {
    // Android resolves the asset to a copy in the cache; the stored book is the only copy kept. iOS reads it in place.
    // The Asset object still believes the copy is there, so it is told otherwise and a retry resolves it again.
    if (resolved?.exists && resolved.uri.startsWith(Paths.cache.uri)) {
      resolved.delete();
      asset.downloaded = false;
      asset.localUri = null;
    }
  }
}

/** Picks a PDF and stores it. The picker cache is not the store. The file is never fetched from a network and never read by the engine. */
export async function importBooklet<TRun>(user: BaseSQLiteDatabase<"sync", TRun>, id: string): Promise<ImportResult> {
  let picked: File | null = null;
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false });
    const asset = result.canceled ? null : (result.assets[0] ?? null);
    if (!asset) return { ok: false, reason: "cancelled", message: "No file was picked." };
    picked = new File(asset.uri);
    return await storeBooklet(user, id, picked, asset.name, asset.size ?? null);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "The booklet could not be stored.";
    return { ok: false, reason: "failed", message };
  } finally {
    if (picked?.exists) picked.delete();
  }
}
