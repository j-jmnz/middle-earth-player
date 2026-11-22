// What `pnpm webapp build` adds to the web export so Cloudflare serves it (docs/plans/pwa-iphone-ipad.md, Cloudflare fit): the `_headers` file, the list of dynamic
// pages the Worker reads (webapp/worker.ts) and the `.assetsignore` of what is not uploaded. Pure, so site.test.ts runs it.
import { CSP } from "../../desktop/serve.ts";

/** Cloudflare's limit for one static asset. A larger file is not uploaded; the plan serves it from R2. */
export const ASSET_FILE_LIMIT = 25 * 1024 * 1024;
/** Cloudflare's limit of static assets for one Worker version on the paid plan. */
export const ASSET_COUNT_LIMIT = 100_000;

/**
 * The `_headers` file. Safari has no COEP `credentialless`, so the page is isolated with `require-corp` (expo-sqlite's synchronous calls need SharedArrayBuffer), which
 * every file of the app's own origin passes. The CSP is the desktop's. The hashed files never change under their name, so a browser keeps them for good.
 */
export function headersFile(): string {
  const all = [
    "Cross-Origin-Opener-Policy: same-origin",
    "Cross-Origin-Embedder-Policy: require-corp",
    "Cross-Origin-Resource-Policy: same-origin",
    `Content-Security-Policy: ${CSP}`,
    "X-Content-Type-Options: nosniff",
    "X-Robots-Tag: noindex",
  ];
  const immutable = ["Cache-Control: public, max-age=31536000, immutable"];
  const block = (pattern: string, lines: readonly string[]) => [pattern, ...lines.map((line) => `  ${line}`)].join("\n");
  return `${[block("/*", all), block("/_expo/static/*", immutable), block("/assets/*", immutable)].join("\n\n")}\n`;
}

/** The export's pages that have a parameter (`table/[saveId].html`), from its files' paths relative to the export, sorted. */
export function dynamicPages(files: readonly string[]): string[] {
  return files
    .map((file) => file.split("\\").join("/"))
    .filter((file) => file.endsWith(".html") && /(^|\/)\[[^\]/]+\]/.test(file))
    .sort();
}

export type SiteFile = { path: string; size: number };

/** The files Cloudflare cannot hold as static assets, largest first. */
export function oversize(files: readonly SiteFile[]): SiteFile[] {
  return files.filter((file) => file.size > ASSET_FILE_LIMIT).sort((a, b) => b.size - a.size);
}

/** The `.assetsignore` file: the oversize files and the browser scripts' stamp, one path for each line, rooted at the export. */
export function assetsIgnore(files: readonly SiteFile[]): string {
  return `${[".inputs-stamp", ...oversize(files).map((file) => `/${file.path}`)].join("\n")}\n`;
}

/** The icon iOS puts on the Home Screen, at the export's root. */
export const TOUCH_ICON = "apple-touch-icon.png";
// What makes iOS open the page from the Home Screen as an app of its own (no Safari bars, its own storage), before the web app has a manifest
// (docs/plans/pwa-iphone-ipad.md, Phase 1: the web app build).
const HOME_SCREEN_TAGS = [
  '<meta name="apple-mobile-web-app-capable" content="yes"/>',
  '<meta name="mobile-web-app-capable" content="yes"/>',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black"/>',
  '<meta name="apple-mobile-web-app-title" content="Middle-Earth"/>',
  `<link rel="apple-touch-icon" href="/${TOUCH_ICON}"/>`,
].join("");

/** A page of the export with the Home Screen tags at the end of its head; a page that has them, or no head, is returned as it is. */
export function withHomeScreenTags(html: string): string {
  if (html.includes("apple-mobile-web-app-capable") || !html.includes("</head>")) return html;
  return html.replace("</head>", `${HOME_SCREEN_TAGS}</head>`);
}
