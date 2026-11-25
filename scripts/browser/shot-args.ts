// The flags of `pnpm browser shot` (scripts/browser/shot.ts), parsed apart from the run so a test can read them.
import path from "node:path";

import { flagValue, flagValues } from "../args.ts";
import { LANDSCAPE, PORTRAIT, type Scheme, type Size } from "./app.ts";

export type ShotArgs = {
  /** The routes to open, in order. `{save}` in one is the fixture's save id. None: the fixture's landing route, or `/`. */
  routes: string[];
  fixture: string | null;
  /** `--scene <scenario-id> '<layout json>'` (or `--scene-file <path>`): a table built from a layout (test/harness/layout.ts), shown read-only on the table of a standalone game, `standalone-e2e-scene`. */
  scene: { scenarioId: string; layout: string | null; file: string | null } | null;
  /** `--moment <scenario-id>[/<name>]`: the committed moments of `test/scenarios/<id>/screens.ts`, one or all. */
  moment: string | null;
  /** `--at <n>`: the fixture's first n intents only. */
  at: number | undefined;
  wait: string | null;
  /** Tapped in order on every route, each followed by a shot. */
  taps: string[];
  schemes: Scheme[];
  size: Size;
  fullPage: boolean;
  ids: boolean;
  text: boolean;
  settle: number | undefined;
  network: boolean;
  /** A running server to open (`pnpm web` is http://localhost:8081) in place of the static export. */
  base: string | null;
  out: string;
  fresh: boolean;
  reuse: boolean;
};

const VALUED = new Set(["--fixture", "--scene", "--scene-file", "--moment", "--at", "--wait", "--tap", "--size", "--settle", "--base", "--out"]);
const BARE = new Set(["--dark", "--both", "--landscape", "--full-page", "--ids", "--text", "--net", "--fresh", "--reuse", "--verbose", "--quiet"]);

function sizeOf(value: string): Size {
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) throw new Error(`--size takes <width>x<height>, not ${value}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function atOf(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`--at takes a count of intents, not ${value}`);
  return Number(value);
}

export function parseShotArgs(args: readonly string[], root: string): ShotArgs {
  const routes: string[] = [];
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at] ?? "";
    // The layout of `--scene <id>` is the next argument when it is JSON (it is not a route).
    if (arg === "--scene" && args[at + 2]?.startsWith("{")) at += 2;
    else if (VALUED.has(arg)) at += 1;
    else if (arg.startsWith("--") && !BARE.has(arg)) throw new Error(`unknown flag ${arg}`);
    else if (!arg.startsWith("--")) routes.push(arg.startsWith("/") ? arg : `/${arg}`);
  }
  const size = flagValue(args, "--size");
  const settle = flagValue(args, "--settle");
  const schemes: Scheme[] = args.includes("--both") ? ["light", "dark"] : args.includes("--dark") ? ["dark"] : ["light"];
  const sceneId = flagValue(args, "--scene");
  const layoutAt = args.indexOf("--scene") + 2;
  const sceneFile = flagValue(args, "--scene-file") ?? null;
  if (sceneFile && !sceneId) throw new Error("--scene-file goes with --scene <scenario-id>");
  const moment = flagValue(args, "--moment") ?? null;
  if ((sceneId && args[layoutAt]?.startsWith("{") ? 1 : 0) + (sceneFile ? 1 : 0) > 1) throw new Error("give the layout inline or as --scene-file, not both");
  if ([sceneId, moment, flagValue(args, "--fixture")].filter((one) => one != null).length > 1) throw new Error("--scene, --moment and --fixture are three ways to open a table: give one");
  return {
    routes,
    fixture: flagValue(args, "--fixture") ?? null,
    scene: sceneId ? { scenarioId: sceneId, layout: args[layoutAt]?.startsWith("{") ? (args[layoutAt] ?? null) : null, file: sceneFile } : null,
    moment,
    at: atOf(flagValue(args, "--at")),
    wait: flagValue(args, "--wait") ?? null,
    taps: flagValues(args, "--tap"),
    schemes,
    size: size ? sizeOf(size) : args.includes("--landscape") ? LANDSCAPE : PORTRAIT,
    fullPage: args.includes("--full-page"),
    ids: args.includes("--ids"),
    text: args.includes("--text"),
    settle: settle === undefined ? undefined : Number(settle),
    network: args.includes("--net"),
    base: flagValue(args, "--base") ?? null,
    out: path.resolve(root, flagValue(args, "--out") ?? ".agent/shots"),
    fresh: args.includes("--fresh"),
    reuse: args.includes("--reuse"),
  };
}

/** The route of a scene: the standalone table of the game `standalone-e2e-scene` (src/screens/session/web/scene-dump.ts). */
export const SCENE_ROUTE = "/standalone/table/standalone-e2e-scene";

/** The routes a run opens, once the fixture (if any) has landed on `landed`. */
export function routesOf(parsed: Pick<ShotArgs, "routes">, landed: string | null): string[] {
  if (parsed.routes.length === 0) return [landed ?? "/"];
  const save = landed?.split("/").filter(Boolean).at(-1);
  return parsed.routes.map((route) => {
    if (!route.includes("{save}")) return route;
    if (!save) throw new Error(`${route} names {save}: pass --fixture <name>`);
    return route.replaceAll("{save}", save);
  });
}
