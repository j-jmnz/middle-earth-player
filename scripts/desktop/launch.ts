// How `pnpm desktop smoke` (scripts/checks/desktop-smoke.ts) opens the app. The checkout's shell is launched through Playwright's `_electron`, which injects its loader so the
// page is attached before the window opens. A packed app cannot take the loader (an `executablePath` launch races the window: it hangs whenever the window is up before
// Playwright attaches), so it is started as a plain process with a debugging port and attached with `connectOverCDP`. The renderer sandbox is off on Linux (--no-sandbox): a
// container runs as root and a CI runner may forbid the user namespaces the sandbox needs.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";

import { _electron as electron, chromium, type Browser, type BrowserContext, type ElectronApplication, type Page } from "playwright";

import { APP_ORIGIN } from "../../desktop/identity.ts";
import { APP_DIR, WEB_E2E_DIR, withoutNodeOptions } from "./shell.ts";

/** An open app: its window's page and context, the Electron handle when it is the checkout's shell, and how to close it. */
export type Opened = { page: Page; context: BrowserContext; app: ElectronApplication | null; close: () => Promise<void> };

const linuxFlags = (): string[] => (process.platform === "linux" ? ["--no-sandbox", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"] : []);

function exited(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once("exit", () => resolve());
  });
}

// Windows keeps Chromium's child processes alive for a moment after the main process is gone, so the whole tree goes.
function killTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGKILL");
}

// The packed app, started as a plain process with a debugging port, and attached to over CDP. Browser.close quits it the way the window's close does.
async function launchPacked(executable: string, userData: string): Promise<{ browser: Browser; child: ChildProcess }> {
  const child: ChildProcess = spawn(executable, [`--user-data-dir=${userData}`, "--remote-debugging-port=0", ...linuxFlags()], {
    env: { ...withoutNodeOptions(process.env), APPIMAGE_EXTRACT_AND_RUN: "1" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  const endpoint = await new Promise<string>((resolve, reject) => {
    let seen = "";
    const timer = setTimeout(() => reject(new Error(`the packed app printed no DevTools address in 60 s:\n${seen.slice(-600)}`)), 60_000);
    child.stderr?.on("data", (chunk: Buffer) => {
      seen += String(chunk);
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(seen);
      if (match?.[1]) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.once("error", (error: Error) => reject(error));
    void exited(child).then(() => reject(new Error(`the packed app exited before it was ready:\n${seen.slice(-600)}`)));
  }).catch((error: unknown) => {
    killTree(child);
    throw error;
  });
  await windowCommitted(endpoint, child);
  return { browser: await chromium.connectOverCDP(endpoint, { timeout: 60_000 }), child };
}

// Playwright (both `_electron` with an executable and `connectOverCDP`) hangs when it attaches to a page whose first navigation has not committed yet (the shell opens its window within a few hundred ms of starting), so the attach
// waits until the debugging port lists a page at the app's address.
async function windowCommitted(endpoint: string, child: ChildProcess): Promise<void> {
  const port = /:(\d+)\//.exec(endpoint)?.[1];
  const until = Date.now() + 60_000;
  while (Date.now() < until && child.exitCode === null) {
    const pages = (await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json() as Promise<{ type: string; url: string }[]>, () => [])) ?? [];
    if (pages.some((entry) => entry.type === "page" && entry.url.startsWith(APP_ORIGIN))) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  killTree(child);
  throw new Error("the packed app opened no window at its address in 60 s");
}

/** The packed app at `executable` on the profile `userData`, attached to over CDP once its window has committed. */
export async function openPacked(executable: string, userData: string): Promise<Opened> {
  const { browser, child } = await launchPacked(executable, userData);
  const context = browser.contexts()[0];
  if (!context) throw new Error("the packed app has no browser context");
  const page = context.pages()[0] ?? (await context.waitForEvent("page", { timeout: 60_000 }));
  const close = async () => {
    // Browser.close may never answer once the app is gone, so it is not awaited; the exit is.
    void browser.newBrowserCDPSession().then((cdp) => cdp.send("Browser.close")).catch(() => undefined);
    await Promise.race([exited(child), new Promise((resolve) => setTimeout(resolve, 5_000))]);
    killTree(child);
    await exited(child);
  };
  return { page, context, app: null, close };
}

/** The checkout's shell (desktop/build/app) on the seeded export, through Playwright's `_electron`, on the profile `userData`. */
export async function openChecked(userData: string): Promise<Opened> {
  const app = await electron.launch({
    args: [path.join(APP_DIR, "main.js"), `--user-data-dir=${userData}`, ...linuxFlags()],
    env: { ...withoutNodeOptions(process.env), MIDDLE_EARTH_PLAYER_WEB_ROOT: WEB_E2E_DIR },
    timeout: 60_000,
  });
  return { page: await app.firstWindow(), context: app.context(), app, close: () => app.close() };
}
