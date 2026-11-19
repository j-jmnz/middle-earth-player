// The app in Chromium, for an agent that checks a screen by eye (`pnpm browser shot`, `pnpm browser run`): a browser context on a served web build, with
// what each page logs, throws and fails to load kept so the report can print it. react-native-web writes a `testID` as `data-testid`, so a screen is
// waited on and tapped by its testID. The table is drawn on a Skia canvas: its cards have no element to tap, but the menu, the dials and the panels do.
import { mkdirSync } from "node:fs";
import path from "node:path";

import type { Browser, BrowserContext, Page } from "playwright";

import { launchChromium } from "./chromium.ts";

export type Scheme = "light" | "dark";
export type Size = { width: number; height: number };

export const PORTRAIT: Size = { width: 390, height: 844 };
export const LANDSCAPE: Size = { width: 844, height: 390 };

/**
 * What a page said while it was open: console errors and warnings, uncaught errors, requests that failed or answered 400 and over, and how many
 * requests off localhost were blocked (`network` off; their console lines are left out, since the block caused them).
 */
export type Problems = { console: string[]; errors: string[]; requests: string[]; blocked: number };

export type AppOptions = {
  base: string;
  scheme?: Scheme;
  size?: Size;
  /** Lets requests leave localhost (card pictures come from the network in a web build without packed scans). Off: they are aborted, so a run is offline. */
  network?: boolean;
  /** Where `shot` writes. */
  out: string;
};

export type App = {
  base: string;
  browser: Browser;
  context: BrowserContext;
  /**
   * Opens a route in a new page and waits for `wait` (a testID), or for the first testID when none is named, then lets the screen settle. It closes
   * the page it opened before: the app's database is one OPFS file, and a second tab waits on it forever.
   */
  open: (route: string, options?: { wait?: string; settle?: number }) => Promise<Page>;
  /**
   * Writes a fixture save through the e2e route and returns the route it landed on (`/path/save-e2e-<name>`, or a standalone game's table). `at` keeps
   * the fixture's first intents only: the moment `pnpm game show <name> --at <n>` prints.
   */
  seed: (fixture: string, at?: number) => Promise<string>;
  /**
   * Taps an element: a bare word is a testID, anything with `=` or a leading `[`, `#` or `.` is a Playwright selector (`text=Settings`), and `x,y` is a
   * point in CSS pixels (a card on the table's canvas). A target that is not there fails after 5 s, naming the testIDs that are.
   */
  tap: (page: Page, target: string, settle?: number) => Promise<void>;
  /** A PNG of the page in `out`, named `<name>.png`; returns its path. */
  shot: (page: Page, name: string, fullPage?: boolean) => Promise<string>;
  /** The testIDs on the page, sorted, once each. */
  testIds: (page: Page) => Promise<string[]>;
  /** What the page logged and failed since it opened. */
  problems: (page: Page) => Problems;
  close: () => Promise<void>;
};

const DEFAULT_SETTLE = 1000;
const TIMEOUT = 30_000;
const TAP_TIMEOUT = 5000;
// Headless Chromium draws WebGL in software; its driver notes are not the app's.
const NOISE = /GL Driver Message|GPU stall due to ReadPixels/;

/** A tap target that is a point (`120,340`), or null. */
export function pointOf(target: string): { x: number; y: number } | null {
  const match = /^(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/.exec(target);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

/** A target the way `tap` reads it, as a Playwright selector. */
export function selectorOf(target: string): string {
  return /=|^[[#.]/.test(target) ? target : `[data-testid="${target}"]`;
}

/** A file name for a route: `/table/save-e2e-duo` is `table-save-e2e-duo`, `/` is `home`. */
export function slugOf(route: string): string {
  const slug = route.replace(/[?#].*$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "home";
}

export async function openApp(options: AppOptions): Promise<App> {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: options.size ?? PORTRAIT, colorScheme: options.scheme ?? "light", reducedMotion: "reduce" });
  const host = new URL(options.base).hostname;
  if (!options.network) await context.route((url) => url.hostname !== host, (route) => route.abort());
  const seen = new WeakMap<Page, Problems>();
  mkdirSync(options.out, { recursive: true });

  // A request off localhost is aborted on purpose while `network` is off: it is not the page's fault.
  const offHost = (url: string): boolean => {
    if (options.network || !url) return false;
    try {
      return new URL(url).hostname !== host;
    } catch {
      return false;
    }
  };

  const watch = (page: Page): void => {
    const problems: Problems = { console: [], errors: [], requests: [], blocked: 0 };
    seen.set(page, problems);
    page.on("console", (message) => {
      if (message.type() !== "error" && message.type() !== "warning") return;
      if (offHost(message.location().url) || NOISE.test(message.text())) return;
      problems.console.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => problems.errors.push(error.stack ?? error.message));
    page.on("requestfailed", (request) => {
      if (offHost(request.url())) {
        problems.blocked += 1;
        return;
      }
      problems.requests.push(`${request.failure()?.errorText ?? "failed"}: ${request.url()}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) problems.requests.push(`${response.status()}: ${response.url()}`);
    });
  };

  let current: Page | undefined;
  const open = async (route: string, opts: { wait?: string; settle?: number } = {}): Promise<Page> => {
    if (current && !current.isClosed()) await current.close();
    const page = await context.newPage();
    current = page;
    watch(page);
    await page.goto(new URL(route, options.base).toString());
    await page.waitForSelector(opts.wait ? selectorOf(opts.wait) : "[data-testid]", { timeout: TIMEOUT });
    await page.waitForTimeout(opts.settle ?? DEFAULT_SETTLE);
    return page;
  };

  const seed = async (fixture: string, at?: number): Promise<string> => {
    if (current && !current.isClosed()) await current.close();
    const page = await context.newPage();
    watch(page);
    try {
      await page.goto(new URL(`/e2e/${fixture}${at === undefined ? "" : `?at=${at}`}`, options.base).toString());
      // The route replaces itself with the save's path, or a standalone game's table; it stays put on a name with no committed fixture.
      await page.waitForURL((url) => !url.pathname.startsWith("/e2e/"), { timeout: TIMEOUT });
      return new URL(page.url()).pathname;
    } catch {
      const said = await page.locator('[data-testid="e2e-fixture"]').innerText({ timeout: 2000 }).catch(() => "the e2e route did not render");
      throw new Error(`fixture ${fixture} did not open: ${said.trim()} (the names are in src/campaign/fixtures/registry.ts)`);
    } finally {
      await page.close();
    }
  };

  const testIds = async (page: Page): Promise<string[]> => {
    const ids = await page.$$eval("[data-testid]", (nodes) => nodes.map((node) => node.getAttribute("data-testid") ?? ""));
    return [...new Set(ids.filter(Boolean))].sort();
  };

  const tap = async (page: Page, target: string, settle?: number): Promise<void> => {
    const point = pointOf(target);
    if (point) await page.mouse.click(point.x, point.y);
    else {
      try {
        await page.click(selectorOf(target), { timeout: TAP_TIMEOUT });
      } catch (error) {
        const ids = await testIds(page);
        throw new Error(`no tappable ${selectorOf(target)} (${error instanceof Error ? error.message.split("\n")[0] : String(error)}); testIDs here: ${ids.join(" ")}`, { cause: error });
      }
    }
    await page.waitForTimeout(settle ?? DEFAULT_SETTLE);
  };

  const shot = async (page: Page, name: string, fullPage?: boolean): Promise<string> => {
    const file = path.join(options.out, `${name}.png`);
    await page.screenshot({ path: file, fullPage: fullPage ?? false });
    return file;
  };

  const problems = (page: Page): Problems => seen.get(page) ?? { console: [], errors: [], requests: [], blocked: 0 };

  const close = async (): Promise<void> => {
    await context.close();
    await browser.close();
  };

  return { base: options.base, browser, context, open, seed, tap, shot, testIds, problems, close };
}
