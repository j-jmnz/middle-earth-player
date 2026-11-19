// The static web export the browser scripts open (`pnpm browser`, `pnpm test a11y`): `expo export -p web` with the e2e seed, so the fixture route
// (src/screens/routes/e2e/[fixture].tsx) writes saves, into one temporary folder, served on localhost with the headers the app needs.
//
// An export takes about a minute and a half, so it is reused while its inputs are unchanged: a stamp of every input file's path and content (size
// and mtime for a file over 16 MB) is written beside it once the export is done, and an export whose stamp differs (or has none) is made again.
// Content, not mtime, because `pnpm assets catalog` rewrites an unchanged catalog.db before every run.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { contentType, resolveFile } from "../../desktop/serve.ts";
import type { Log } from "../log.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const EXPORT_DIR = path.join(tmpdir(), "middle-earth-player-web-export");
const STAMP = ".inputs-stamp";

// What the web bundle is built from. Folders are walked; a missing entry is skipped.
const INPUTS = ["src", "public", "assets", "modules", "app.json", "app.config.js", "package.json", "pnpm-lock.yaml", "metro.config.js", "babel.config.js", "global.css", "tailwind.config.js"];
const ENV = { EXPO_PUBLIC_E2E_SEED: "1", EXPO_NO_TELEMETRY: "1", EXPO_OFFLINE: "1", CI: "1" };

const BIG = 16 * 1024 * 1024;

function walk(file: string, out: string[], root: string): void {
  if (!existsSync(file)) return;
  const stat = statSync(file);
  if (!stat.isDirectory()) {
    const content = stat.size > BIG ? `${stat.size}\t${Math.round(stat.mtimeMs)}` : createHash("sha256").update(readFileSync(file)).digest("hex");
    out.push(`${path.relative(root, file)}\t${content}`);
    return;
  }
  for (const name of readdirSync(file).sort()) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    walk(path.join(file, name), out, root);
  }
}

/** The stamp of the export's inputs as they are now. */
export function inputsStamp(root: string = ROOT): string {
  const lines: string[] = [JSON.stringify(ENV)];
  for (const input of INPUTS) walk(path.join(root, input), lines, root);
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

function exportedStamp(): string | null {
  const file = path.join(EXPORT_DIR, STAMP);
  return existsSync(file) && existsSync(path.join(EXPORT_DIR, "index.html")) ? readFileSync(file, "utf8").trim() : null;
}

/**
 * The export folder, made again unless it is current. `fresh` always makes it again; `reuse` keeps any finished export, whatever changed since.
 * The catalog and CanvasKit must be packed first (`pnpm assets catalog canvaskit`); the `pnpm browser` and `pnpm test a11y` steps do that.
 */
export function ensureExport(log: Log, options: { fresh?: boolean; reuse?: boolean } = {}): string {
  const now = inputsStamp();
  const last = exportedStamp();
  if (!options.fresh && last !== null && (options.reuse || last === now)) {
    log.debug(`reusing the web export in ${EXPORT_DIR}${last === now ? "" : " (its inputs changed since)"}`);
    return EXPORT_DIR;
  }
  rmSync(path.join(EXPORT_DIR, STAMP), { force: true });
  mkdirSync(EXPORT_DIR, { recursive: true });
  log.step("expo export -p web", () => {
    execFileSync("pnpm", ["exec", "expo", "export", "-p", "web", "--output-dir", EXPORT_DIR], {
      cwd: ROOT,
      stdio: ["ignore", "ignore", "inherit"],
      env: { ...process.env, ...ENV },
    });
  });
  writeFileSync(path.join(EXPORT_DIR, STAMP), now);
  return EXPORT_DIR;
}

/** Serves an export on 127.0.0.1 (`port` 0 picks a free one). The database runs in a worker that needs a cross-origin isolated page (SharedArrayBuffer). */
export function serveExport(root: string, port = 0): Promise<{ server: Server; base: string }> {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const file = resolveFile(root, pathname);
    response.writeHead(200, {
      "content-type": contentType(file),
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "credentialless",
    });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })));
}
