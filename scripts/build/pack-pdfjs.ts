import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bytes, runScript, type Log } from "../log.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Where the web build serves pdf.js's worker and data from (src/screens/booklets/web/open-pdf.ts reads `/pdfjs`). Gitignored: `pnpm assets pdfjs` writes it. */
export const PDFJS_PUBLIC = path.join(ROOT, "public", "pdfjs");

// What pdf.js reads at run time: its worker, the CMaps and the standard fonts a PDF may leave out, the ICC profiles and the wasm image decoders.
const PARTS: readonly { from: readonly string[]; to: string }[] = [
  { from: ["build", "pdf.worker.min.mjs"], to: "pdf.worker.min.mjs" },
  { from: ["cmaps"], to: "cmaps" },
  { from: ["standard_fonts"], to: "standard_fonts" },
  { from: ["iccs"], to: "iccs" },
  { from: ["wasm"], to: "wasm" },
];

export function pdfjsSource(): string {
  return path.join(ROOT, "node_modules", "pdfjs-dist");
}

/** Copies pdf.js's runtime files from node_modules, so the browser and the desktop shell fetch them from the app's own origin. */
export function packPdfjs(log: Log, from = pdfjsSource(), to = PDFJS_PUBLIC): number {
  if (!existsSync(from)) throw new Error(`pdf.js is not at ${from}: run pnpm install`);
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  for (const part of PARTS) cpSync(path.join(from, ...part.from), path.join(to, part.to), { recursive: true });
  const worker = statSync(path.join(to, "pdf.worker.min.mjs")).size;
  log.info(`pdfjs: worker ${bytes(worker)}, data in ${path.relative(ROOT, to)}`);
  return worker;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runScript("pack-pdfjs", (log) => {
    packPdfjs(log);
  });
}
