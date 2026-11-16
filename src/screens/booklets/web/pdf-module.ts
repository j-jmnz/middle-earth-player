// The web's `booklet-pdf`: metro.config.js serves this file for `import "booklet-pdf"` on the web platform only, so the screens that import the phone's native module
// (the route, reader-view.ts) read a pdf.js reader here without a line of their own for it, and the phone's bundle never reaches it. It has the exports of
// modules/booklet-pdf/index.ts (pdf-module.test.ts holds the shapes together). pdf.js itself is loaded when a book is first opened (open-pdf.ts).
import type { ComponentType } from "react";
import type { BookletPdfViewProps, PageChange } from "booklet-pdf";

import { countPages, openPdf } from "./open-pdf";
import { WebBookletPdf } from "./reader";

export type { BookletPdfViewProps, PageChange };

/** Always true on the web: pdf.js reads a PDF in any browser. */
export function bookletPdfAvailable(): boolean {
  return true;
}

export function bookletPdfUnavailableReason(): string | null {
  return null;
}

/** The page count of a PDF at `uri` (a URL or an `opfs:` path); rejects when the file is not a PDF pdf.js can open. */
export function pdfPageCount(uri: string): Promise<number> {
  return countPages(() => openPdf(uri));
}

export function bookletPdfView(): ComponentType<BookletPdfViewProps> | null {
  return WebBookletPdf;
}
