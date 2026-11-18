// The package scripts' dispatcher: `pnpm <group> <command> [args]` runs the command's steps in order, each a child
// process with the arguments after the command, and stops at the first that fails (docs/development.md, Commands).
// `pnpm <group>` alone lists the group's commands; `assets` alone runs every pack, and `test` with no command
// (or with a file filter) is a plain `vitest run`.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runScript, type Log } from "./log.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Vitest is found when a test step runs, not on import: the release workflow's plan job runs `pnpm release` without
// installing the dependencies (.github/workflows/release.yml).
const VITEST = "vitest";

/** One child process: a script under `scripts/` (or `vitest`), the node flags and leading arguments it needs, and its env. */
export type Step = { script: string; node?: string[]; args?: string[]; env?: Record<string, string> };
export type Command = { steps: Step[]; about: string };

const catalog: Step = { script: "build/catalog.ts" };
const booklets: Step = { script: "build/pack-booklets.ts" };
const scans: Step = { script: "build/pack-scans.ts" };
const canvaskit: Step = { script: "build/pack-canvaskit.ts" };
const pdfjs: Step = { script: "build/pack-pdfjs.ts" };

export const GROUPS: Record<string, Record<string, Command>> = {
  assets: {
    all: { steps: [catalog, canvaskit, pdfjs, booklets, scans], about: "catalog, canvaskit, pdfjs, booklets and scans in order (`--optional` lets a pack fail)" },
    catalog: { steps: [catalog], about: "writes assets/catalog.db and src/catalog/version.ts" },
    canvaskit: { steps: [canvaskit], about: "copies CanvasKit's wasm to public/canvaskit.wasm for the web table" },
    pdfjs: { steps: [pdfjs], about: "copies pdf.js's worker and data to public/pdfjs for the web booklet reader" },
    booklets: { steps: [booklets], about: "packs the booklet PDFs into assets/booklets" },
    scans: { steps: [scans], about: "packs every card picture into assets/scans" },
    capture: { steps: [{ script: "showcase/capture.ts" }], about: "takes the README showcase's captures on the iOS simulators (--app <App.app>, macOS)" },
    showcase: { steps: [{ script: "showcase/build.ts" }], about: "turns the captures into the README's images, GIFs and contact sheet" },
    banner: { steps: [{ script: "showcase/banner.ts" }], about: "draws the README's banner in both themes into .github/readme" },
  },
  data: {
    sync: { steps: [{ script: "data/sync.ts" }], about: "refreshes data/raw and .cache (the only networked command)" },
    build: { steps: [{ script: "data/build.ts" }], about: "builds data/ and the generated code from data/raw, offline" },
    check: { steps: [{ script: "data/check.ts" }], about: "rebuilds into a temporary directory and fails on any difference" },
    "ledger-seed": { steps: [{ script: "data/ledger-seed.ts" }], about: "writes a scenario's missing ledger entries from the source text, readBy empty (<scenario-id> [--nightmare] for its Nightmare deck)" },
    query: { steps: [{ script: "data/query.ts", node: ["--disable-warning=ExperimentalWarning"] }], about: "runs SQL over cards, scenario_cards and rules" },
  },
  effects: {
    draft: { steps: [{ script: "data/effects/draft.ts" }], about: "writes .agent/drafts for printed lines no record owns" },
    render: { steps: [{ script: "data/effects/render.ts" }], about: "prints each card's lines with its records in plain English" },
    open: { steps: [{ script: "data/effects/open.ts" }], about: "rewrites src/effects/open-lines.ts" },
  },
  scenario: {
    new: { steps: [{ script: "tools/scenario-new.ts" }], about: "writes and registers a scenario's skeleton files (--dry-run first)" },
    pack: { steps: [{ script: "tools/author-pack.ts" }], about: "writes .agent/pack/<id>.md, the scenario author's context" },
    fixtures: { steps: [{ script: "e2e/fixtures.ts" }], about: "rewrites the save fixtures in src/campaign/fixtures" },
  },
  test: {
    all: { steps: [{ script: VITEST, args: ["run"] }], about: "vitest run (any arguments go to vitest)" },
    fast: { steps: [{ script: VITEST, args: ["run"], env: { VITEST_FAST: "1" } }], about: "vitest run without the slow files" },
    changed: { steps: [{ script: VITEST, args: ["run", "--changed"] }], about: "the tests that import a file changed since the last commit" },
    scenario: { steps: [{ script: "tools/test-scenario.ts" }], about: "one scenario's tests, goldens, checks and smokes" },
    smoke: { steps: [{ script: "card-smoke/run.ts" }], about: "plays seeded games with player cards' records" },
    encounter: { steps: [{ script: "card-smoke/encounter.ts" }], about: "plays a scenario's encounter cards and seeded games" },
    "phone-bundle": { steps: [{ script: "checks/phone-bundle.ts" }], about: "exports the Android and iOS bundles here and at the merge base with origin/main and fails unless each is byte-identical (--base <ref>, --keep, --if-desktop-work)" },
    a11y: { steps: [catalog, canvaskit, { script: "checks/a11y-web.ts" }], about: "audits the web screens with axe-core in Chromium" },
  },
  desktop: {
    dev: { steps: [{ script: "desktop/dev.ts" }], about: "opens Electron on the Metro web server (desktop/policy.ts allows localhost:8081 in this mode only)" },
    build: { steps: [{ script: "desktop/build.ts" }], about: "assets, the web export with EXPO_PUBLIC_DESKTOP=1 and the shell's bundle, in desktop/build (--skip-assets, --optional)" },
    pack: { steps: [{ script: "desktop/pack.ts" }], about: "electron-builder for this OS into desktop/out (APP_VERSION sets the version; --skip-build, --dir)" },
    smoke: { steps: [{ script: "checks/desktop-smoke.ts" }], about: "launches the desktop app on a seeded export and checks it (--skip-build, --app <packed app>, --require-bundle, --expect-version)" },
    stage: { steps: [{ script: "desktop/stage.ts" }], about: "the release job's installers from desktop/out, with a .sha256 each and the 2 GiB check (--tag, --out, --suffix, --github-output)" },
  },
  doc: {
    index: { steps: [{ script: "docs/index.ts" }], about: "regenerates docs/INDEX.md" },
    section: { steps: [{ script: "docs/index.ts", args: ["section"] }], about: 'prints one doc section: <file> "<heading>"' },
  },
  release: {
    plan: { steps: [{ script: "release/plan.ts" }], about: "prints the next tag and its notes (--dry-run)" },
    source: { steps: [{ script: "release/sideload-source.ts" }], about: "writes a release's SideStore and AltStore source" },
  },
};

// Groups whose leading arguments may name several commands (`pnpm assets catalog canvaskit pdfjs`).
const MULTI = new Set(["assets"]);

/** The command a group's arguments name, and the arguments left for its steps. A group with `all` runs it when the first argument names no command. */
export function resolve(group: string, args: readonly string[]): { command: Command; rest: string[] } | null {
  const commands = GROUPS[group];
  if (!commands) return null;
  const [first = "", ...rest] = args;
  const named = Object.hasOwn(commands, first) && first !== "all" ? commands[first] : undefined;
  if (named && MULTI.has(group)) {
    // `pnpm assets catalog canvaskit pdfjs` runs each named pack in the order given; the arguments after the last name go to every step.
    const steps = [...named.steps];
    let at = 0;
    while (at < rest.length) {
      const next = rest[at] ?? "";
      const more = Object.hasOwn(commands, next) && next !== "all" ? commands[next] : undefined;
      if (!more) break;
      steps.push(...more.steps);
      at += 1;
    }
    return { command: { steps, about: named.about }, rest: rest.slice(at) };
  }
  if (named) return { command: named, rest };
  const fallback = commands["all"];
  return fallback ? { command: fallback, rest: [...args] } : null;
}

function usage(group: string): string {
  const commands = GROUPS[group] ?? {};
  const names = Object.keys(commands).map((name) => (name === "all" ? `pnpm ${group}` : `pnpm ${group} ${name}`));
  const width = Math.max(0, ...names.map((name) => name.length));
  const lines = Object.values(commands).map((command, i) => `  ${(names[i] ?? "").padEnd(width)}  ${command.about}`);
  return [`usage: pnpm <${Object.keys(GROUPS).join("|")}> <command> [args]`, ...lines].join("\n");
}

/** The file a step runs: vitest's entry, or a script under `scripts/`. */
export function scriptPath(step: Step): string {
  if (step.script === VITEST) return path.join(path.dirname(createRequire(import.meta.url).resolve("vitest/package.json")), "vitest.mjs");
  return path.join(ROOT, "scripts", step.script);
}

function run(log: Log, steps: readonly Step[], rest: readonly string[]): void {
  for (const step of steps) {
    const file = scriptPath(step);
    const argv = [...(step.node ?? []), file, ...(step.args ?? []), ...rest];
    log.debug(`node ${argv.join(" ")}`);
    const child = spawnSync(process.execPath, argv, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...step.env } });
    if (child.status === 0) continue;
    process.exitCode = child.status ?? 1;
    return;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [group = "", ...args] = process.argv.slice(2);
  void runScript(group || "cli", (log) => {
    const resolved = resolve(group, args);
    if (resolved) return run(log, resolved.command.steps, resolved.rest);
    log.error(usage(group));
    process.exitCode = 1;
  }, { done: false });
}
