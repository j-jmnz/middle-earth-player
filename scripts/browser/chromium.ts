// The Chromium every Playwright script here launches (`pnpm browser`, `pnpm test a11y`, the README banner). Playwright's own browser is used when it is
// installed (CI runs `pnpm exec playwright install chromium`). A cloud container ships a Chromium of another Playwright revision instead, at a fixed path,
// so that one is used when Playwright's own is missing. CHROMIUM_PATH names a binary and wins over both.
import { existsSync } from "node:fs";

import { chromium, type Browser, type LaunchOptions } from "playwright";

/** The Chromium a cloud container ships beside its own Playwright (a link to the binary). */
export const CONTAINER_CHROMIUM = "/opt/pw-browsers/chromium";

export type ChromiumChoice = { executablePath: string | undefined; args: string[] };

/**
 * Which binary to launch and with which flags. `env` is CHROMIUM_PATH, `own` Playwright's own binary path, `exists` the file check.
 * A binary outside Playwright's own install, or any run as root, has the sandbox off: a container runs as root, and Chromium refuses its sandbox there.
 */
export function chooseChromium(env: string | undefined, own: string, exists: (file: string) => boolean, root: boolean): ChromiumChoice {
  const custom = env || (!exists(own) && exists(CONTAINER_CHROMIUM) ? CONTAINER_CHROMIUM : undefined);
  return { executablePath: custom, args: custom || root ? ["--no-sandbox"] : [] };
}

export async function launchChromium(options: LaunchOptions = {}): Promise<Browser> {
  const choice = chooseChromium(process.env.CHROMIUM_PATH, chromium.executablePath(), existsSync, process.getuid?.() === 0);
  if (!choice.executablePath && !existsSync(chromium.executablePath())) {
    throw new Error("No Chromium: run `pnpm exec playwright install chromium` once, or set CHROMIUM_PATH=<binary>");
  }
  return chromium.launch({ ...options, executablePath: choice.executablePath, args: [...choice.args, ...(options.args ?? [])] });
}
