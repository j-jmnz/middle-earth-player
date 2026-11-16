// `pnpm desktop dev`: Electron on the Metro web server. Metro (`expo start --web` on port 8081, with the desktop's own switches) and the shell's bundle start, and the window loads
// http://localhost:8081, which desktop/policy.ts allows in this mode only; closing the window stops Metro.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

import { runScript, type Log } from "../log.ts";
import { APP_DIR, bundleShell, desktopVersion, packAssets, ROOT } from "./shell.ts";

// The `electron` package exports the path of its binary.
const electron = createRequire(import.meta.url)("electron") as string;
const PORT = 8081;

// pnpm gives every script the NODE_OPTIONS of pnpm-workspace.yaml (--disable-warning=...), which Electron refuses.
function withoutNodeOptions(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const { NODE_OPTIONS: _dropped, ...rest } = env;
  return rest;
}

async function waitFor(url: string, give: number): Promise<void> {
  const until = Date.now() + give;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Metro is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Metro did not answer on ${url} in ${give / 1000} s`);
}

async function main(log: Log): Promise<void> {
  packAssets(log, ["catalog", "canvaskit", "pdfjs"]);
  await bundleShell(log, desktopVersion(undefined));
  const metro = spawn("pnpm", ["exec", "expo", "start", "--web", "--port", String(PORT)], { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, EXPO_PUBLIC_DESKTOP: "1", BROWSER: "none", CI: "1" } });
  try {
    await waitFor(`http://localhost:${PORT}`, 120_000);
    log.info("Metro is up; opening the window");
    const shell = spawn(electron, [path.join(APP_DIR, "main.js"), ...process.argv.slice(2)], { cwd: ROOT, stdio: "inherit", env: { ...withoutNodeOptions(process.env), MIDDLE_EARTH_PLAYER_DEV: "1" } });
    await new Promise<void>((resolve) => shell.on("exit", () => resolve()));
  } finally {
    metro.kill();
  }
}

await runScript("desktop:dev", main);
