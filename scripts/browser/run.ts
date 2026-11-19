// `pnpm browser run <script.ts> [--dark] [--landscape] [--size WxH] [--net] [--base <url>] [--out <dir>] [--fresh | --reuse]`: runs an agent's scratch
// Playwright script against the web build, for a check `pnpm browser shot` cannot express (a flow of taps and assertions, a scroll, a typed search).
// The script lives in the session scratchpad, not in the repository, and default-exports one function that takes the App (scripts/browser/app.ts):
//
//   import type { App } from "/abs/path/to/scripts/browser/app.ts";
//   export default async function (app: App) {
//     const page = await app.open(await app.seed("duo"));
//     await app.tap(page, "path-open");
//     console.log(await app.shot(page, "after-open"), app.problems(page));
//   }
//
// It is served and launched as `pnpm browser shot` is; a throw from the script fails the run.
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runScript, type Log } from "../log.ts";
import { openApp, type App } from "./app.ts";
import { parseShotArgs } from "./shot-args.ts";
import { ensureExport, serveExport } from "./web-export.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

async function main(log: Log): Promise<void> {
  const argv = process.argv.slice(2);
  const [file, ...rest] = argv;
  if (!file || file.startsWith("--")) throw new Error("usage: pnpm browser run <script.ts> [flags]");
  const args = parseShotArgs(rest, ROOT);
  const script = (await import(pathToFileURL(path.resolve(process.env.INIT_CWD ?? process.cwd(), file)).href)) as { default?: (app: App, log: Log) => unknown };
  if (typeof script.default !== "function") throw new Error(`${file} has no default export function (app) => …`);
  const served = args.base ? null : await serveExport(ensureExport(log, { fresh: args.fresh, reuse: args.reuse }));
  const app = await openApp({ base: args.base ?? served?.base ?? "", scheme: args.schemes[0], size: args.size, network: args.network, out: args.out });
  try {
    await script.default(app, log);
  } finally {
    await app.close();
    served?.server.close();
  }
}

await runScript("browser:run", main, { done: false });
