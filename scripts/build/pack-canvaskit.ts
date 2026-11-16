import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bytes, runScript, type Log } from "../log.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Where the web build serves CanvasKit's wasm from (src/ui/skia-web.ts loads it by this name). Gitignored: `pnpm assets canvaskit` writes it. */
export const CANVASKIT_PUBLIC = path.join(ROOT, "public", "canvaskit.wasm");

/**
 * The wasm Skia's web build loads: the `full` build `LoadSkiaWeb` imports its loader from (canvaskit-wasm/bin/full/canvaskit), so loader and
 * binary are the same build. Copied from node_modules so the browser and the desktop shell fetch it from the app's own origin.
 */
export function canvaskitSource(): string {
  return path.join(ROOT, "node_modules", "canvaskit-wasm", "bin", "full", "canvaskit.wasm");
}

export function packCanvasKit(log: Log, from = canvaskitSource(), to = CANVASKIT_PUBLIC): number {
  if (!existsSync(from)) throw new Error(`CanvasKit's wasm is not at ${from}: run pnpm install`);
  mkdirSync(path.dirname(to), { recursive: true });
  copyFileSync(from, to);
  const size = statSync(to).size;
  log.info(`canvaskit.wasm: ${bytes(size)}`);
  return size;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runScript("pack-canvaskit", (log) => {
    packCanvasKit(log);
  });
}
