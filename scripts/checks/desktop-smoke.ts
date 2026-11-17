// `pnpm desktop smoke`: the desktop app launched through Playwright's `_electron` and checked end to end (docs/architecture.md, Desktop). It exports the web build with the
// e2e seed (EXPO_PUBLIC_E2E_SEED=1, so the fixture route writes saves) and EXPO_PUBLIC_DESKTOP=1 into desktop/build/web-e2e, bundles the shell, and opens the app on a fresh
// profile. Each check prints ok, FAIL with its message, or skipped; the run fails if any failed:
//   - the page is cross-origin isolated (expo-sqlite's synchronous calls need SharedArrayBuffer), and the preload exposes only the accessibility flag;
//   - /e2e/duo seeds a save and /table/save-e2e-duo draws the table on a canvas (a pixel read of a screenshot, not the reader table);
//   - a card picture loads from the bundle, and a booklet page renders (skipped when the export carries no pictures or no booklets: the release job packs them);
//   - a Blob download (the Settings backup) is offered through a save dialog with its name;
//   - no request left app:// (every request the window made is counted), no CSP violation or page error came up, and then a navigation away and a request to another host are refused;
//   - after closing and opening the app again on the same profile, the campaign list still shows the seeded save.
// Flags (scripts/desktop/smoke-args.ts): --skip-build reuses the last export and bundle; --app <path> launches a packed app (an installer's unpacked app or an AppImage)
// instead of the checkout's, which has no seeded export, so the seeded checks are skipped; with --require-bundle the picture and booklet checks must pass instead of being skipped
// for want of local packs, and --expect-version <x.y.z> fails unless the app reports it (the release job's launch check). On Linux without a display the script runs itself under xvfb-run.
// The app is opened by scripts/desktop/launch.ts. A packed app's version is read from its app.asar (scripts/desktop/asar.ts), and the save-dialog check, which needs the main
// process, runs on the checkout's shell only.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Page } from "playwright";
import sharp from "sharp";

import { APP_ORIGIN, DESKTOP_API } from "../../desktop/identity.ts";
import { duration, runScript, type Log } from "../log.ts";
import { packedVersion } from "../desktop/asar.ts";
import { openChecked, openPacked, type Opened } from "../desktop/launch.ts";
import { parseSmokeArgs } from "../desktop/smoke-args.ts";
import { bundleShell, desktopVersion, exportDesktopWeb, packAssets, ROOT, WEB_E2E_DIR } from "../desktop/shell.ts";

const FIXTURE = "duo";
const SAVE = `save-e2e-${FIXTURE}`;
const TIMEOUT = 90_000;

type Session = Opened & { requests: string[]; csp: string[]; errors: string[] };
type Options = { packed: string | null; userData: string };


async function launch(log: Log, { packed, userData }: Options): Promise<Session> {
  const opened = packed ? await openPacked(packed, userData) : await openChecked(userData);
  const session: Session = { ...opened, requests: [], csp: [], errors: [] };
  const { page } = session;
  session.context.on("request", (request) => session.requests.push(request.url()));
  page.on("console", (message) => {
    const text = message.text();
    log.debug(`console.${message.type()} ${text.slice(0, 300)}`);
    if (/content security policy/i.test(text)) session.csp.push(text.slice(0, 300));
  });
  page.on("pageerror", (error) => session.errors.push(error.message.slice(0, 300)));
  await page.waitForLoadState("domcontentloaded");
  return session;
}

// The distinct colours in an image's pixels, each channel kept to its top 4 bits: a blank canvas has one, a drawn table dozens.
async function colours(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const seen = new Set<number>();
  for (let at = 0; at + 2 < data.length; at += info.channels * 7) seen.add(((data[at] ?? 0) >> 4) << 8 | ((data[at + 1] ?? 0) >> 4) << 4 | ((data[at + 2] ?? 0) >> 4));
  return seen.size;
}

async function goto(page: Page, route: string, ready: string): Promise<void> {
  await page.goto(`${APP_ORIGIN}${route}`);
  await page.waitForSelector(`[data-testid="${ready}"]`, { timeout: TIMEOUT });
}

type Result = { name: string; verdict: "ok" | "FAIL" | "skipped"; detail?: string };

async function check(results: Result[], log: Log, name: string, run: () => Promise<string | void>): Promise<boolean> {
  try {
    const detail = await run();
    results.push({ name, verdict: "ok", ...(detail ? { detail } : {}) });
    log.info(`ok       ${name}${detail ? ` (${detail})` : ""}`);
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, verdict: "FAIL", detail });
    log.error(`FAIL     ${name}: ${detail}`);
    return false;
  }
}

function skip(results: Result[], log: Log, name: string, why: string): void {
  results.push({ name, verdict: "skipped", detail: why });
  log.info(`skipped  ${name}: ${why}`);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const scansPacked = () => existsSync(path.join(ROOT, "assets", "scans", ".packed.json"));
const bookletsPacked = () => existsSync(path.join(ROOT, "assets", "booklets", "learn-to-play.pdf"));

async function isolation(session: Session): Promise<string> {
  const { page } = session;
  assert(await page.evaluate(() => crossOriginIsolated), "crossOriginIsolated is false: expo-sqlite's synchronous calls would not work");
  assert(await page.evaluate(() => isSecureContext), "the page is not a secure context (crypto.subtle and OPFS need one)");
  const api = await page.evaluate((name) => Object.keys((window as unknown as Record<string, object>)[name] ?? {}).sort(), DESKTOP_API);
  assert(api.join() === "accessibilitySupportEnabled,onAccessibilitySupportChanged", `the preload exposes ${api.join() || "nothing"}`);
  // The bundle defines a `process` of its own (process.env), so the sign of Node is its version and `require`.
  const node = await page.evaluate(() => [typeof require, typeof module, String((globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node)].join());
  assert(node === "undefined,undefined,undefined", `Node is visible to the page (${node})`);
  return `${APP_ORIGIN}, preload: ${api.length} members`;
}

async function table(session: Session): Promise<string> {
  const { page } = session;
  await goto(page, `/table/${SAVE}`, "table");
  // The canvas is the largest one on the table; give CanvasKit and the first frames time to draw.
  await page.waitForFunction(() => [...document.querySelectorAll("canvas")].some((canvas) => canvas.clientWidth >= 400 && canvas.clientHeight >= 200), null, { timeout: TIMEOUT });
  await page.waitForTimeout(4000);
  const box = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")].map((canvas) => canvas.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height);
    const largest = canvases[0];
    return largest ? { x: largest.x, y: largest.y, width: largest.width, height: largest.height } : null;
  });
  assert(box !== null, "the table has no canvas: it is the reader table, so CanvasKit did not load");
  const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.max(1, Math.min(box.width, 1200)), height: Math.max(1, Math.min(box.height, 800)) };
  const distinct = await colours(await page.screenshot({ clip }));
  assert(distinct >= 12, `the table's canvas is blank (${distinct} colours)`);
  return `${Math.round(box.width)}x${Math.round(box.height)} canvas, ${distinct} colours`;
}

async function picture(session: Session): Promise<string> {
  const { page } = session;
  await goto(page, "/card/01001", "card-text");
  await page.waitForFunction(() => [...document.images].some((image) => image.src.startsWith("app://") && image.src.includes("/assets/scans/") && image.complete && image.naturalWidth > 0), null, { timeout: 30_000 });
  return "a scan loaded from app://";
}

async function booklet(session: Session): Promise<string> {
  const { page } = session;
  await page.goto(`${APP_ORIGIN}/booklet/learn-to-play`);
  await page.waitForSelector('[data-testid="booklet-page"]', { state: "attached", timeout: TIMEOUT });
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="booklet-page"]');
    return canvas !== null && canvas.width > 100 && canvas.style.width !== "";
  }, null, { timeout: TIMEOUT });
  await page.waitForTimeout(1500);
  const distinct = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="booklet-page"]');
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return 0;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const seen = new Set<number>();
    for (let at = 0; at < data.length; at += 28) seen.add(((data[at] ?? 0) >> 4 << 8) | ((data[at + 1] ?? 0) >> 4 << 4) | ((data[at + 2] ?? 0) >> 4));
    return seen.size;
  });
  assert(distinct >= 3, `the booklet's page canvas is blank (${distinct} colours)`);
  return `page canvas with ${distinct} colours`;
}

async function refusals(session: Session): Promise<string> {
  const { page } = session;
  const outside = await page.evaluate(() => fetch("https://example.com/").then(() => "reached", () => "blocked"));
  assert(outside === "blocked", "a request to https://example.com was not blocked");
  await page.evaluate(() => {
    location.assign("https://example.com/");
  });
  await page.waitForTimeout(800);
  assert(page.url().startsWith(`${APP_ORIGIN}/`), `the window navigated to ${page.url()}`);
  return "a fetch and a navigation to another site were refused";
}

// The Settings backup is a Blob download (`<a download>`): the shell must turn it into a save dialog offering the file's name, not save it unasked. The listener cancels the
// download once the shell's own handler has run, so no dialog stays open on the run's screen.
async function download(session: Session): Promise<string> {
  const { app, page } = session;
  if (app === null) throw new Error("no main process to listen on");
  const offered = app.evaluate(
    ({ session: electronSession }) =>
      new Promise<{ name: string; path: string }>((resolve) => {
        electronSession.defaultSession.once("will-download", (_event, item) => {
          const offer = { name: item.getFilename(), path: item.getSaveDialogOptions().defaultPath ?? "" };
          item.cancel();
          resolve(offer);
        });
      }),
  );
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["backup"]));
    link.download = "middle-earth-player-test.backup";
    document.body.append(link);
    link.click();
    link.remove();
  });
  const { name, path: target } = await Promise.race([offered, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("a Blob download never reached the shell")), 15_000))]);
  assert(name === "middle-earth-player-test.backup", `the download is named ${name}`);
  assert(target.endsWith(name), `the save dialog does not offer the file's name (${target})`);
  return `a save dialog is offered for ${name}`;
}

async function listText(page: Page): Promise<string> {
  await goto(page, "/", "campaign-list");
  await page.waitForTimeout(1500);
  return (await page.locator('[data-testid="campaign-list"]').innerText()).replace(/\s+/g, " ").trim();
}

async function main(log: Log): Promise<void> {
  const { packed, skipBuild, requireBundle, expectVersion } = parseSmokeArgs(process.argv.slice(2));
  if (packed !== null && !existsSync(packed)) throw new Error(`--app ${packed} does not exist`);
  if (process.platform === "linux" && !process.env["DISPLAY"]) {
    log.info("no display: running under xvfb-run");
    const child = spawnSync("xvfb-run", ["-a", "-s", "-screen 0 1440x900x24", process.execPath, ...process.argv.slice(1)], { cwd: ROOT, stdio: "inherit" });
    if (child.error) throw new Error(`xvfb-run is needed without a display: ${child.error.message}`);
    process.exitCode = child.status ?? 1;
    return;
  }
  if (packed === null && !skipBuild) {
    packAssets(log, ["catalog", "canvaskit", "pdfjs"]);
    exportDesktopWeb(log, { out: WEB_E2E_DIR, env: { EXPO_PUBLIC_E2E_SEED: "1" } });
    await bundleShell(log, desktopVersion(undefined));
  } else if (packed === null && !existsSync(path.join(WEB_E2E_DIR, "index.html"))) {
    throw new Error("--skip-build needs an earlier run's export in desktop/build/web-e2e");
  }
  const userData = mkdtempSync(path.join(tmpdir(), "middle-earth-player-smoke-"));
  const results: Result[] = [];
  const started = performance.now();
  let session: Session | null = null;
  try {
    session = await launch(log, { packed, userData });
    const first = session;
    await check(results, log, "isolation and preload", () => isolation(first));
    if (expectVersion !== null) {
      if (packed === null) skip(results, log, "reports the tag's version", "the checkout's shell carries no stamped version");
      else if (packedVersion(packed) === null) skip(results, log, "reports the tag's version", "an AppImage's app.asar is inside it; its file name carries the version (pnpm desktop stage)");
      else {
        await check(results, log, "reports the tag's version", async () => {
          const version = packedVersion(packed);
          assert(version === expectVersion, `the app's package.json says ${version}, not ${expectVersion}`);
          return version ?? "";
        });
      }
    }
    let fresh = "";
    let seeded = "";
    if (packed === null) {
      fresh = await listText(first.page);
      const ok = await check(results, log, "seeds /e2e/duo", async () => {
        await goto(first.page, `/e2e/${FIXTURE}`, "campaign-path");
        seeded = await listText(first.page);
        assert(seeded !== fresh, "the campaign list did not change after the seed");
        return "the campaign list shows the seeded save";
      });
      if (ok) await check(results, log, "table canvas draws", () => table(first));
    } else {
      skip(results, log, "seed and table", "a packed app carries no seeded export");
    }
    if (requireBundle || scansPacked()) await check(results, log, "picture from the bundle", () => picture(first));
    else skip(results, log, "picture from the bundle", "no scans packed");
    if (requireBundle || bookletsPacked()) await check(results, log, "booklet page renders", () => booklet(first));
    else skip(results, log, "booklet page renders", "no booklets packed");
    await check(results, log, "no request left app://", async () => {
      const left = first.requests.filter((url) => !url.startsWith(`${APP_ORIGIN}/`) && !url.startsWith("data:") && !url.startsWith("blob:"));
      assert(left.length === 0, `${left.length} requests left app://: ${left.slice(0, 3).join(", ")}`);
      assert(first.requests.length > 0, "no request was seen at all, so the count proves nothing");
      return `${first.requests.length} requests, all app://`;
    });
    await check(results, log, "no CSP violation, no page error", async () => {
      assert(first.csp.length === 0, `CSP: ${first.csp[0]}`);
      assert(first.errors.length === 0, `page error: ${first.errors[0]}`);
    });
    if (packed === null) await check(results, log, "a Blob download opens a save dialog", () => download(first));
    else skip(results, log, "a Blob download opens a save dialog", "the packed app has no main process to listen on; the checkout's run covers it");
    await check(results, log, "refuses what is not the app", () => refusals(first));
    await first.close();
    session = null;
    if (packed === null) {
      const second = await launch(log, { packed, userData });
      session = second;
      await check(results, log, "relaunch finds the save", async () => {
        const again = await listText(second.page);
        assert(again === seeded, `the campaign list after a relaunch is "${again.slice(0, 80)}", not the seeded "${seeded.slice(0, 80)}"`);
        await goto(second.page, `/table/${SAVE}`, "table");
        return "the seeded campaign survived the restart";
      });
    }
  } finally {
    await session?.close().catch(() => undefined);
    // Windows may hold a profile file for a moment after the app is gone.
    try {
      rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    } catch (error) {
      log.warn(`could not remove ${userData}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const failed = results.filter((result) => result.verdict === "FAIL");
  const passed = results.filter((result) => result.verdict === "ok").length;
  log.info(`${passed} of ${results.length} checks passed, ${results.filter((result) => result.verdict === "skipped").length} skipped, in ${duration(performance.now() - started)}`);
  if (failed.length > 0) throw new Error(`${failed.length} desktop smoke check${failed.length === 1 ? "" : "s"} failed: ${failed.map((result) => result.name).join(", ")}`);
}

await runScript("desktop:smoke", main);
