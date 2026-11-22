import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT } from "./tracked.ts";

// A release is only ever started by hand (docs/agents/release-standards.md, Who releases): release.yml runs on
// workflow_dispatch alone, and no other workflow makes a tag or a GitHub release.
const GITHUB = path.join(ROOT, ".github", "workflows");

function workflows(dir: string): string[] {
  return readdirSync(dir).filter((name) => /\.ya?ml$/.test(name)).map((name) => path.join(dir, name));
}

/** The event names under a workflow's top-level `on:` block (the keys indented one level below it). */
function triggers(file: string): string[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const start = lines.findIndex((line) => /^on:\s*$/.test(line));
  if (start < 0) return [];
  const block = lines.slice(start + 1);
  const end = block.findIndex((line) => /^\S/.test(line));
  return (end < 0 ? block : block.slice(0, end)).flatMap((line) => /^ {2}([a-z_]+):/.exec(line)?.[1] ?? []);
}

describe("release trigger", () => {
  it("starts release.yml by hand only", () => {
    expect(triggers(path.join(GITHUB, "release.yml"))).toEqual(["workflow_dispatch"]);
  });

  it("makes tags and GitHub releases only in release.yml", () => {
    const others = workflows(GITHUB).filter((file) => path.basename(file) !== "release.yml");
    const releasing = others.filter((file) => /gh release|git tag|git push[^\n]*--tags|action-gh-release/.test(readFileSync(file, "utf8")));
    expect(releasing.map((file) => path.basename(file))).toEqual([]);
  });
});

// The release workflow's desktop jobs (docs/releasing.md, Jobs). Read as text, with no YAML dependency: a job is the lines from its two-space key to the next one.
function jobs(file: string): Map<string, string> {
  const lines = readFileSync(file, "utf8").split("\n");
  const out = new Map<string, string>();
  let name: string | undefined;
  let inJobs = false;
  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) inJobs = true;
    else if (inJobs && /^\S/.test(line)) inJobs = false;
    const key = inJobs ? /^ {2}([a-z][a-z0-9_-]*):\s*$/.exec(line)?.[1] : undefined;
    if (key) {
      name = key;
      out.set(name, "");
    } else if (name && inJobs) out.set(name, `${out.get(name)}${line}\n`);
  }
  return out;
}

describe("release.yml desktop jobs", () => {
  const all = jobs(path.join(GITHUB, "release.yml"));

  // publish waits on `checks` (test.yml), so a desktop job there would let a desktop failure hold back the phone builds.
  it("runs no desktop check inside the checks the phone builds wait on", () => {
    const checks = jobs(path.join(GITHUB, "test.yml"));
    expect(all.get("checks")).toContain("uses: ./.github/workflows/test.yml");
    expect(all.get("publish")).toContain("needs.checks.result == 'success'");
    for (const [name, body] of checks) if (/desktop/.test(name)) expect(body, name).toMatch(/^ {4}if: github\.event_name != 'workflow_dispatch'$/m);
  });

  it("has the web export, the three-OS desktop build and a publish that waits for it", () => {
    expect([...all.keys()]).toEqual(expect.arrayContaining(["plan", "checks", "assets", "android", "ios", "web", "desktop", "cleanup", "publish"]));
    expect(all.get("desktop")).toMatch(/needs: \[plan\]/);
    for (const os of ["ubuntu-latest", "macos-latest", "windows-latest"]) expect(all.get("desktop")).toContain(os);
    expect(all.get("publish")).toMatch(/needs: \[[^\]]*\bdesktop\b/);
    expect(all.get("cleanup")).toMatch(/needs: \[[^\]]*\bdesktop\b/);
    expect(all.get("publish")).toContain("pattern: desktop-*");
  });

  it("lets a failed desktop build leave the phone release alone, and still cleans up", () => {
    const publish = all.get("publish") ?? "";
    const cond = /^\s*if: (.*)$/m.exec(publish)?.[1] ?? "";
    expect(cond).toContain("!cancelled()");
    expect(cond).toContain("!inputs.dry_run");
    for (const job of ["plan", "checks", "assets", "android", "ios"]) expect(cond, job).toContain(`needs.${job}.result == 'success'`);
    expect(cond).not.toMatch(/needs\.(desktop|web)\.result == 'success'/);
    expect(publish).toContain("needs.desktop.result == 'success'");
    expect(publish).toContain("--desktop-missing");
    expect(all.get("cleanup")).toContain("if: ${{ !cancelled() && inputs.add_desktop_from_run == '' }}");
    // TestFlight follows publish alone: the implicit success() would skip it when the desktop build failed.
    const tfCond = /^\s*if: (.*)$/m.exec(all.get("testflight") ?? "")?.[1] ?? "";
    expect(tfCond).toContain("!cancelled()");
    expect(tfCond).toContain("needs.publish.result == 'success'");
  });

  // docs/releasing.md, Add the desktop app to a release: a rerun adds the desktop files to the release it finds out, and a run
  // started with add_desktop_from_run builds nothing and adds them from that release's run.
  it("adds the desktop app to a release that went out without it", () => {
    const publish = all.get("publish") ?? "";
    expect(publish).toContain('git rev-parse --verify --quiet "refs/tags/$TAG"');
    expect(publish).toContain("run: .github/scripts/add-desktop.sh");
    expect(publish).toContain("overwrite: true");
    expect(/^\s*if: (.*)$/m.exec(all.get("testflight") ?? "")?.[1]).toContain("needs.publish.outputs.added != 'true'");
    expect(all.get("plan")).toContain("if: ${{ inputs.add_desktop_from_run == '' }}");
    const add = all.get("add-desktop") ?? "";
    expect(add).toContain("if: ${{ inputs.add_desktop_from_run != '' }}");
    expect(add).toContain("run-id: ${{ inputs.add_desktop_from_run }}");
    expect(add).toContain("run: .github/scripts/add-desktop.sh");
    expect(add).not.toMatch(/\bneeds:/);
  });

  it("starts the web export beside the assets job and waits for it, as the native builds do", () => {
    for (const job of ["web", "android", "ios"]) expect(all.get(job), job).toContain(".github/scripts/wait-for-artifact.sh assets assets");
    expect(all.get("web")).toMatch(/needs: \[plan\]/);
  });

  // The desktop legs install and fetch Electron while the web job exports, and wait for web-dist only before they pack.
  it("starts the desktop legs beside the web export and waits for it before the download", () => {
    const desktop = all.get("desktop") ?? "";
    const wait = desktop.indexOf(".github/scripts/wait-for-artifact.sh web-dist web");
    expect(wait).toBeGreaterThan(desktop.indexOf("uses: ./.github/actions/install"));
    expect(wait).toBeLessThan(desktop.indexOf("name: web-dist"));
    expect(desktop).toContain("actions: read");
  });

  // docs/releasing.md, Caches: one action names, restores and places each Metro cache, under the runner's temp folder (the
  // cache action refuses a path with `..`, so the web job's cache was never saved), and the job saves what it names.
  it("keeps each build's Metro cache through the metro-cache action", () => {
    for (const job of ["android", "ios", "web"]) {
      const body = all.get(job) ?? "";
      expect(body, job).toContain("uses: ./.github/actions/metro-cache");
      expect(body, job).toContain("path: ${{ steps.metro.outputs.path }}");
      expect(body, job).toContain("key: ${{ steps.metro.outputs.key }}");
      expect(body, job).toMatch(/caches: .*\$\{\{ steps\.metro\.outputs\.key \}\}/);
      expect(body, job).not.toContain("EXPO_METRO_CACHE");
    }
  });

  // A job that hangs must not hold the one-release-at-a-time queue for GitHub's six-hour default.
  it("gives every job a timeout", () => {
    for (const file of ["release.yml", "test.yml"]) {
      for (const [name, body] of jobs(path.join(GITHUB, file))) {
        if (/^ {4}uses: /m.test(body)) continue;
        expect(body, `${file} ${name}`).toMatch(/^ {4}timeout-minutes: \d+$/m);
      }
    }
  });

  // hashFiles reads the checked-out lockfile: with CRLF on Windows its keys missed the cleanup job's list of keys to keep.
  it("checks Windows out with LF line ends before the desktop leg names its caches", () => {
    const desktop = all.get("desktop") ?? "";
    expect(desktop.indexOf("core.autocrlf false")).toBeGreaterThan(-1);
    expect(desktop.indexOf("core.autocrlf false")).toBeLessThan(desktop.indexOf("uses: actions/checkout"));
  });

  // The runner image has Chrome's libraries and xvfb; playwright install-deps then only adds fonts, for minutes.
  it("installs the Linux browser libraries only when they are missing", () => {
    const checks = jobs(path.join(GITHUB, "test.yml"));
    for (const [name, body] of [["desktop", all.get("desktop")], ["desktop-smoke", checks.get("desktop-smoke")], ["a11y-web", checks.get("a11y-web")]] as const) {
      expect(body, name).toContain(".github/scripts/linux-browser-deps.sh");
      expect(body, name).not.toMatch(/playwright install-deps|--with-deps/);
    }
  });

  it("downloads Electron's binary in the desktop job only", () => {
    for (const [name, body] of all) {
      if (name === "desktop") expect(body).not.toContain("ELECTRON_SKIP_BINARY_DOWNLOAD");
      else if (/(uses: \.\/\.github\/actions\/(install|pack-assets)|pnpm install)/.test(body)) expect(body, name).toContain('ELECTRON_SKIP_BINARY_DOWNLOAD: "1"');
    }
  });

  it("checks the installers, launches the packed app and keeps every OS's files for the release", () => {
    const desktop = all.get("desktop") ?? "";
    expect(desktop).toContain("pnpm desktop pack --skip-build");
    expect(desktop).toContain("pnpm --silent desktop stage");
    expect(desktop).toContain("pnpm desktop smoke --app");
    expect(desktop).toContain("--require-bundle");
    expect(desktop).toContain("name: desktop-${{ matrix.os }}");
    const publish = all.get("publish") ?? "";
    for (const glob of ["*-win-x64.*", "*-mac-universal.*", "*-linux-x64.*"]) expect(publish).toContain(glob);
  });
});
