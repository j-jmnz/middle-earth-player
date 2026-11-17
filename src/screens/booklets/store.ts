// The web's booklet store; the phone's is store.native.ts (Metro takes that one there, so nothing here reaches the phone's bundle). A book the build
// carries (assets/booklets, `pnpm assets booklets`) is read from its asset URL and copied nowhere: its row only records that the player has it. A
// book the player adds from the browser's file picker is stored in OPFS under `booklets/` (web/opfs.ts), the web's document directory, and read from
// there. Neither is fetched from a network, and the engine never reads one.
import { Asset } from "expo-asset";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { readBooklet, writeBooklet, type BookletRow } from "../data/campaign-store";
import { bookletPath } from "./books";
import { bundledBooklets } from "./bundled-map";
import { hex, looksLikePdf } from "./web/pdf-check";
import { countPages, openPdf, openPdfBytes } from "./web/open-pdf";
import { opfsAvailable, opfsUri, writeOpfsFile } from "./web/opfs";
import { pickFile } from "../../ui/web/pick-file";

export type ImportResult = { ok: true; row: BookletRow } | { ok: false; reason: "cancelled" | "notPdf" | "unavailable" | "failed"; message: string };

// A bundled book's row names no file: its path says the build carries the book.
const BUNDLED = "bundled:";

function bundledPath(id: string): string {
  return `${BUNDLED}${id}`;
}

function bundledUrl(id: string): string | null {
  const bundled = bundledBooklets[id];
  return bundled ? Asset.fromModule(bundled.moduleId).uri : null;
}

/**
 * Where the reader reads a stored book: the asset's URL for a bundled one, an `opfs:` path for one the player added, and null when the row names a
 * book this build no longer carries (a build with another pin), which the reader then installs again. A stored file's presence is not checked here,
 * since OPFS answers only asynchronously: a missing one shows as the reader's own message.
 */
export function bookletUri(row: BookletRow): string | null {
  if (row.path.startsWith(BUNDLED)) {
    const bundled = bundledBooklets[row.id];
    return bundled && bundled.sha256 === row.sha256 ? bundledUrl(row.id) : null;
  }
  return opfsUri(row.path);
}

/** True when this build carries the book's PDF (scripts/build/pack-booklets.ts filled the map). */
export function hasBundledBooklet(id: string): boolean {
  return bundledBooklets[id] != null;
}

// One install per book at a time: a remounted reader joins the install already running.
const installing = new Map<string, Promise<ImportResult>>();

/** Records the book this build carries as the player's, after pdf.js has opened it. The PDF is the build's own, so it is not checked against its pin again. */
export function installBundledBooklet<TRun>(user: BaseSQLiteDatabase<"sync", TRun>, id: string): Promise<ImportResult> {
  const running = installing.get(id);
  if (running) return running;
  const install = installFromAsset(user, id).finally(() => installing.delete(id));
  installing.set(id, install);
  return install;
}

async function installFromAsset<TRun>(user: BaseSQLiteDatabase<"sync", TRun>, id: string): Promise<ImportResult> {
  const bundled = bundledBooklets[id];
  const url = bundledUrl(id);
  if (!bundled || !url) return { ok: false, reason: "unavailable", message: "This build does not carry that booklet." };
  try {
    const pageCount = await countPages(() => openPdf(url));
    const row: BookletRow = { id, path: bundledPath(id), originalFilename: bundled.filename, byteSize: bundled.bytes, sha256: bundled.sha256, pageCount, lastPage: readBooklet(user, id)?.lastPage ?? 1 };
    writeBooklet(user, row);
    return { ok: true, row };
  } catch (error: unknown) {
    return { ok: false, reason: "failed", message: error instanceof Error ? error.message : "The bundled booklet could not be read." };
  }
}

async function digestOf(bytes: Uint8Array): Promise<string> {
  // crypto.subtle exists only in a secure context (https, localhost, the desktop's own scheme); the digest is a record, not a check.
  if (typeof crypto === "undefined" || !crypto.subtle) return "";
  return hex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

async function storePicked<TRun>(user: BaseSQLiteDatabase<"sync", TRun>, id: string, file: File): Promise<ImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) return { ok: false, reason: "notPdf", message: "That file is not a PDF." };
  const sha256 = await digestOf(bytes);
  // pdf.js takes over the buffer it is given, so it reads a copy.
  const opened = await openPdfBytes(bytes.slice());
  if (!opened.ok) return { ok: false, reason: "notPdf", message: `That file is not a PDF this reader can open. ${opened.message}` };
  const pageCount = opened.doc.numPages;
  await opened.doc.loadingTask.destroy();
  await writeOpfsFile(bookletPath(id), file);
  const row: BookletRow = { id, path: bookletPath(id), originalFilename: file.name, byteSize: file.size, sha256, pageCount, lastPage: 1 };
  writeBooklet(user, row);
  return { ok: true, row };
}

/** Picks a PDF and stores it. Called from the tap that asked for it, since a browser opens its file picker only then. */
export async function importBooklet<TRun>(user: BaseSQLiteDatabase<"sync", TRun>, id: string): Promise<ImportResult> {
  if (!opfsAvailable()) return { ok: false, reason: "unavailable", message: "This browser cannot keep files for the app." };
  try {
    const file = await pickFile("application/pdf,.pdf");
    if (!file) return { ok: false, reason: "cancelled", message: "No file was picked." };
    return await storePicked(user, id, file);
  } catch (error: unknown) {
    return { ok: false, reason: "failed", message: error instanceof Error ? error.message : "The booklet could not be stored." };
  }
}
