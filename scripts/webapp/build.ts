// `pnpm webapp build`: the web export in webapp/build/web with what Cloudflare needs beside it (site.ts), ready for `npx wrangler deploy` in webapp/. It is the desktop's
// export (EXPO_PUBLIC_DESKTOP=1: every picture bundled, none fetched) until the web app has its own flag (docs/plans/pwa-iphone-ipad.md, Phase 1: the web app build).
// `--skip-assets` leaves the packs as they are, `--optional` lets a pack fail, `--skip-export` stages the export that is there.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { exportDesktopWeb, packAssets } from "../desktop/shell.ts";
import { bytes, runScript, type Log } from "../log.ts";
import { ROUTES_PATH } from "../../webapp/routes.ts";
import { ASSET_COUNT_LIMIT, assetsIgnore, dynamicPages, headersFile, oversize, TOUCH_ICON, withHomeScreenTags, type SiteFile } from "./site.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const WEB_DIR = path.join(ROOT, "webapp", "build", "web");
// What this script writes into the export; webapp/worker.ts reads the list at ROUTES_PATH.
const ROUTES_FILE = ROUTES_PATH.slice(1);
const WRITTEN = new Set(["_headers", ".assetsignore", ROUTES_FILE, TOUCH_ICON]);

function filesIn(dir: string, root: string, out: SiteFile[] = []): SiteFile[] {
  for (const name of readdirSync(dir).sort()) {
    const file = path.join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) filesIn(file, root, out);
    else out.push({ path: path.relative(root, file).split(path.sep).join("/"), size: stat.size });
  }
  return out;
}

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2);
  if (!args.includes("--skip-export")) {
    if (!args.includes("--skip-assets")) packAssets(log, [], args.includes("--optional") ? ["--optional"] : []);
    exportDesktopWeb(log, { out: WEB_DIR });
  }
  if (!existsSync(path.join(WEB_DIR, "index.html"))) throw new Error("webapp/build/web has no export; run pnpm webapp build without --skip-export");
  const files = filesIn(WEB_DIR, WEB_DIR).filter((file) => !WRITTEN.has(file.path));
  await sharp(path.join(ROOT, "assets", "images", "icon.png")).resize(180, 180).png().toFile(path.join(WEB_DIR, TOUCH_ICON));
  for (const file of files) {
    if (!file.path.endsWith(".html")) continue;
    const at = path.join(WEB_DIR, file.path);
    const html = readFileSync(at, "utf8");
    const tagged = withHomeScreenTags(html);
    if (tagged !== html) writeFileSync(at, tagged);
  }
  const pages = dynamicPages(files.map((file) => file.path));
  writeFileSync(path.join(WEB_DIR, "_headers"), headersFile());
  writeFileSync(path.join(WEB_DIR, ROUTES_FILE), `${JSON.stringify(pages)}\n`);
  writeFileSync(path.join(WEB_DIR, ".assetsignore"), assetsIgnore(files));
  const large = oversize(files);
  for (const file of large) log.warn(`${file.path} is ${bytes(file.size)}, over Cloudflare's 25 MiB for a static asset: it is not uploaded`);
  // The page list and the icon are assets too; `_headers` and `.assetsignore` are not.
  const count = files.length - large.length + 2;
  if (count > ASSET_COUNT_LIMIT) throw new Error(`${count} files, over Cloudflare's ${ASSET_COUNT_LIMIT} static assets for a Worker`);
  log.notice(`webapp: ${count} files, ${bytes(files.reduce((sum, file) => sum + file.size, 0))}, ${pages.length} dynamic pages, ${large.length} left out, in webapp/build/web`);
}

await runScript("webapp:build", main);
