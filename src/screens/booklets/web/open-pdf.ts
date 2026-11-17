// pdf.js, loaded on the first booklet opened and never before: a static render or a phone-sized screen that never opens a book pays nothing,
// and Node (the static export) never evaluates it. The worker and the fonts, color profiles and decoders pdf.js reads on demand are served
// from the app's own origin (`pnpm assets pdfjs` copies them to public/pdfjs), so the reader works offline and fetches nothing else.
import type { PDFDocumentProxy } from "pdfjs-dist";

import { isOpfsUri, opfsPathOf, readOpfsFile } from "./opfs";

type PdfJs = typeof import("pdfjs-dist");

export const PDFJS_ROOT = "/pdfjs";

let loading: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  loading ??= import("pdfjs-dist").then(
    (library) => {
      library.GlobalWorkerOptions.workerSrc = `${PDFJS_ROOT}/pdf.worker.min.mjs`;
      return library;
    },
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

const ASSETS = {
  cMapUrl: `${PDFJS_ROOT}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${PDFJS_ROOT}/standard_fonts/`,
  iccUrl: `${PDFJS_ROOT}/iccs/`,
  wasmUrl: `${PDFJS_ROOT}/wasm/`,
  // No eval: the desktop shell's content security policy forbids it.
  isEvalSupported: false,
} as const;

export type Opened = { ok: true; doc: PDFDocumentProxy } | { ok: false; message: string };

function reasonOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "The file could not be read.";
}

/** Opens a PDF from bytes. pdf.js takes the buffer over, so a caller that still needs the bytes passes a copy. */
export async function openPdfBytes(data: Uint8Array): Promise<Opened> {
  try {
    const library = await loadPdfJs();
    return { ok: true, doc: await library.getDocument({ data, ...ASSETS }).promise };
  } catch (error: unknown) {
    return { ok: false, message: reasonOf(error) };
  }
}

/** Opens the book at `uri`: an `opfs:` path (a book the player added) or a URL (a book the build carries). */
export async function openPdf(uri: string): Promise<Opened> {
  try {
    if (isOpfsUri(uri)) {
      const file = await readOpfsFile(opfsPathOf(uri));
      return await openPdfBytes(new Uint8Array(await file.arrayBuffer()));
    }
    const library = await loadPdfJs();
    return { ok: true, doc: await library.getDocument({ url: uri, ...ASSETS }).promise };
  } catch (error: unknown) {
    return { ok: false, message: reasonOf(error) };
  }
}

/** Opens the PDF just to count its pages; rejects with pdf.js's reason when it is not one. */
export async function countPages(open: () => Promise<Opened>): Promise<number> {
  const opened = await open();
  if (!opened.ok) throw new Error(opened.message);
  const count = opened.doc.numPages;
  await opened.doc.loadingTask.destroy();
  return count;
}
