// What the app:// handler answers: which file a path names, its type, its headers and the part of it a Range asks for. Pure and Node-only (no Electron), so
// desktop/serve.test.ts runs it, and scripts/checks/a11y-web.ts serves the same export through the same resolution.
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { LATEST_RELEASE_URL } from "./policy.ts";

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  // The pdf.js worker is a module worker: a module script with another type is refused.
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".pdf": "application/pdf",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".bcmap": "application/octet-stream",
  ".db": "application/octet-stream",
};

/** The Content-Type of a file by its extension; an unknown one is a plain binary. */
export function contentType(file: string): string {
  return TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

function isFile(file: string): boolean {
  return existsSync(file) && statSync(file).isFile();
}

// A folder, not a file a longer path runs on below ("/index.html/x"), whose listing would throw.
function isDirectory(dir: string): boolean {
  return existsSync(dir) && statSync(dir).isDirectory();
}

// A path that climbs out of the export folder ("/../") is not served: it falls to the not-found page.
function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/** The page an unknown route falls to. */
export function notFoundFile(root: string): string {
  return path.join(root, "+not-found.html");
}

/**
 * The file a request path names in a static Expo export: the path itself, `<path>.html`, `<path>/index.html`, then the `[param].html` beside it (a dynamic route),
 * and the not-found page when none exists. The path is already decoded.
 */
export function resolveFile(root: string, pathname: string): string {
  const missing = notFoundFile(root);
  if (pathname.includes("\0")) return missing;
  const at = (candidate: string) => path.resolve(root, `.${path.sep}${candidate}`);
  const direct = [pathname, `${pathname}.html`, path.join(pathname, "index.html")].map(at).find((file) => inside(root, file) && isFile(file));
  if (direct) return direct;
  const dir = at(path.dirname(pathname));
  const dynamic = inside(root, dir) && isDirectory(dir) ? readdirSync(dir).find((name) => /^\[.*\]\.html$/.test(name)) : undefined;
  return dynamic ? path.join(dir, dynamic) : missing;
}

/** What to answer for a path: the file, and 404 when it fell to the not-found page (the page still carries the body, so an unknown route shows the app's own). */
export function answerFor(root: string, pathname: string): { file: string; status: 200 | 404 } {
  const file = resolveFile(root, pathname);
  return { file, status: file === notFoundFile(root) && !/^\/?\+not-found(\.html)?$/.test(pathname) ? 404 : 200 };
}

// What each directive lets the page do, and why (docs/architecture.md, Desktop). Found by loading every screen with the table, a booklet and a deck import:
//   default-src 'none'    nothing is allowed unless a directive below names it
//   script-src            the export's own scripts; the one inline script Expo Router writes into each page (`globalThis.__EXPO_ROUTER_HYDRATE__=true;`), by its hash;
//                         'wasm-unsafe-eval' compiles CanvasKit's and wa-sqlite's WebAssembly and nothing else (no eval of text)
//   style-src             the export's stylesheet, and the inline styles and <style> rules react-native-web writes
//   img-src               pictures from the bundle, data: and blob: images the table draws
//   font-src              the bundled fonts (data: for an icon font a stylesheet inlines)
//   connect-src           fetch and workers' requests: the bundle, the RingsDB deck import, and the update check's one URL (desktop/policy.ts holds the exact paths)
//   worker-src            expo-sqlite's database worker and pdf.js's worker (a module of the bundle), and a blob: shim expo-sqlite starts them through
//   object-src, base-uri, form-action, frame-ancestors    closed: no plugin, no <base>, no form post, no framing
export const HYDRATE_SCRIPT_HASH = "sha256-67fhrP0+BkBqmgGGXTtgiVO/9EQs3QruYNU/7fnRkI8=";
export const CSP = [
  "default-src 'none'",
  `script-src 'self' '${HYDRATE_SCRIPT_HASH}' 'wasm-unsafe-eval'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://ringsdb.com ${LATEST_RELEASE_URL}`,
  "worker-src 'self' blob:",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * The headers every response carries. COOP `same-origin` with COEP `credentialless` makes the page cross-origin isolated, which expo-sqlite's synchronous calls need
 * (SharedArrayBuffer); `credentialless` lets the RingsDB request through without CORP.
 */
export function responseHeaders(file: string, size: number): Record<string, string> {
  return {
    "content-type": contentType(file),
    "content-length": String(size),
    "accept-ranges": "bytes",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-embedder-policy": "credentialless",
    "cross-origin-resource-policy": "same-origin",
    "content-security-policy": CSP,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
}

/** The bytes a `Range: bytes=a-b` header asks for out of `size`, or null when it asks for none (no header, a form other than one bytes range, or a start past the end). */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  const match = header === null ? null : /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size <= 0) return null;
  const [first, last] = [match[1] ?? "", match[2] ?? ""];
  if (first === "" && last === "") return null;
  if (first === "") {
    // A suffix range: the last n bytes.
    const count = Math.min(Number(last), size);
    return count > 0 ? { start: size - count, end: size - 1 } : null;
  }
  const start = Number(first);
  if (start >= size) return null;
  const end = last === "" ? size - 1 : Math.min(Number(last), size - 1);
  return end >= start ? { start, end } : null;
}
