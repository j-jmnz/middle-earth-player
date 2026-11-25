// `pnpm browser shot [route...]`: opens each route of the web build in Chromium, takes a PNG of it (and one after each `--tap`), and prints the PNG paths
// with every console error and warning, uncaught error and failed request the page had. An agent reads the PNGs to see a screen and the list to see what
// broke. It fails when a page throws, a wait times out or a tap finds nothing; console messages are printed, not failed on.
//
//   pnpm browser shot /settings /decks --dark                   # two screens in the dark theme
//   pnpm browser shot --fixture duo /table/{save} --landscape   # a fixture save (src/campaign/fixtures/registry.ts) on its table
//   pnpm browser shot --fixture mirkwood-lost --at 40 /table/{save} --landscape   # the moment `pnpm game show mirkwood-lost --at 40` prints
//   pnpm browser shot --scene the-morgul-vale '{"play":["143010"]}' --landscape   # a table built from a test layout (`pnpm game scene` prints it as text), read-only
//   pnpm browser shot --moment the-blood-of-gondor/hidden-cards --landscape   # a moment a scenario committed (test/scenarios/<id>/screens.ts); `--moment <id>` shoots all
//   pnpm browser shot /settings --tap text=Theme --ids          # tap, shoot again, list the testIDs left to tap
//   pnpm browser shot /rules --base http://localhost:8081       # a running `pnpm web` (Metro) in place of the export
//
// Without --base it serves the static export (scripts/browser/web-export.ts), made again only when its inputs changed (--fresh forces it, --reuse
// keeps the last one). Requests off localhost are aborted unless --net. The PNGs go to .agent/shots (--out), named `<n>-<route>[-<scheme>][-tap<k>].png`.
import path from "node:path";

import type { Page } from "playwright";

import { runScript, type Log } from "../log.ts";
import { openApp, slugOf, type App, type Problems } from "./app.ts";
import { layoutOf } from "../game/scene-source.ts";
import { momentShots, sceneDump, type SceneShot } from "./scene.ts";
import { parseShotArgs, routesOf, SCENE_ROUTE, type ShotArgs } from "./shot-args.ts";
import { ensureExport, serveExport } from "./web-export.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

function report(log: Log, problems: Problems): number {
  for (const line of problems.errors) log.error(`  uncaught: ${line}`);
  for (const line of problems.console) log.warn(`  console ${line}`);
  for (const line of problems.requests) log.warn(`  request ${line}`);
  if (problems.blocked > 0) log.debug(`  ${problems.blocked} request${problems.blocked === 1 ? "" : "s"} off localhost blocked (--net lets them through)`);
  return problems.errors.length;
}

async function describe(log: Log, app: App, page: Page, args: ShotArgs): Promise<void> {
  if (args.ids) log.info(`  testIDs: ${(await app.testIds(page)).join(" ")}`);
  if (args.text) log.info(`  text:\n${(await page.locator("body").innerText()).replace(/^/gm, "    ")}`);
}

// The table (landscape or portrait), or the closed table's sentence when the scene did not open.
const SCENE_WAIT = '[data-testid="table"], [data-testid="table-portrait"], [data-testid="table-closed"]';

// A shot of a route, or of a scene (the route is the scene's, the PNG is named for the scene).
type Target = { route: string; label: string; scene?: SceneShot };

function targetsOf(routes: readonly string[], scenes: readonly SceneShot[]): Target[] {
  if (scenes.length > 0) return scenes.map((scene) => ({ route: SCENE_ROUTE, label: `scene-${scene.name}`, scene }));
  return routes.map((route) => ({ route, label: slugOf(route) }));
}

async function shoot(log: Log, app: App, args: ShotArgs, targets: readonly Target[], suffix: string): Promise<number> {
  let failures = 0;
  for (const [at, { route: where, label, scene }] of targets.entries()) {
    const route = scene ? `${where} (${scene.name})` : where;
    const name = `${at + 1}-${label}${suffix}`;
    let page: Page | undefined;
    try {
      page = await app.open(where, { wait: args.wait ?? (scene ? SCENE_WAIT : undefined), settle: args.settle, scene: scene?.dump });
      // The table opens on its quest card, as it does for a game reopened (`Continue`): the shot is of the table behind it.
      if (scene && (await app.testIds(page)).includes("quest-advance-progress")) await app.tap(page, "quest-advance-progress", args.settle);
      if (scene && (await app.testIds(page)).includes("table-closed")) throw new Error("the scene route opened no table (is this the e2e-test export, with the scene on the page?)");
      if (scene?.note) log.info(`  shows: ${scene.note}`);
      log.info(`${route}: ${path.relative(ROOT, await app.shot(page, name, args.fullPage))}`);
      await describe(log, app, page, args);
      for (const [tapAt, target] of args.taps.entries()) {
        await app.tap(page, target, args.settle);
        log.info(`${route} after tap ${target}: ${path.relative(ROOT, await app.shot(page, `${name}-tap${tapAt + 1}`, args.fullPage))}`);
        await describe(log, app, page, args);
      }
    } catch (error) {
      failures += 1;
      log.error(`${route}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      if (page) log.info(`  as it was: ${path.relative(ROOT, await app.shot(page, `${name}-failed`, args.fullPage))}`);
    } finally {
      if (page) {
        failures += report(log, app.problems(page));
        await page.close();
      }
    }
  }
  return failures;
}

// The scenes the flags ask for, built in Node once (the page gets each as JSON): `--scene` one layout, `--moment` a scenario's committed moments.
async function scenesOf(args: ShotArgs): Promise<SceneShot[]> {
  if (args.moment) return momentShots(args.moment);
  if (!args.scene) return [];
  const { scenarioId, layout, file } = args.scene;
  const cwd = process.env.INIT_CWD ?? process.cwd();
  return [{ name: scenarioId, dump: sceneDump(scenarioId, layoutOf(file ? `@${file}` : (layout ?? undefined), cwd)) }];
}

async function main(log: Log): Promise<void> {
  const args = parseShotArgs(process.argv.slice(2), ROOT);
  const scenes = await scenesOf(args);
  const served = args.base ? null : await serveExport(ensureExport(log, { fresh: args.fresh, reuse: args.reuse }));
  const base = args.base ?? served?.base ?? "";
  let failures = 0;
  try {
    for (const scheme of args.schemes) {
      const app = await openApp({ base, scheme, size: args.size, network: args.network, out: args.out });
      try {
        // A fixture is written once per context: each scheme's context has its own storage.
        const landed = args.fixture ? await app.seed(args.fixture, args.at) : null;
        const suffix = args.schemes.length > 1 ? `-${scheme}` : "";
        failures += await shoot(log, app, args, targetsOf(routesOf(args, landed), scenes), suffix);
      } finally {
        await app.close();
      }
    }
  } finally {
    served?.server.close();
  }
  if (failures > 0) throw new Error(`${failures} problem${failures === 1 ? "" : "s"} on the pages above`);
}

await runScript("browser:shot", main, { done: false });
