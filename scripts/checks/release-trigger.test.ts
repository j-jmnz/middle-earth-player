import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT } from "./tracked.ts";

// A release is only ever started by hand (.claude/rules/release-standards.md, Who releases): release.yml and the EAS e2e workflow
// run on workflow_dispatch alone, and no other workflow makes a tag or a GitHub release.
const GITHUB = path.join(ROOT, ".github", "workflows");
const EAS = path.join(ROOT, ".eas", "workflows");

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

  it("starts the EAS e2e workflow by hand only", () => {
    expect(triggers(path.join(EAS, "e2e.yml"))).toEqual(["workflow_dispatch"]);
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

  it("has the web export, the three-OS desktop build and a publish that waits for it", () => {
    expect([...all.keys()]).toEqual(expect.arrayContaining(["plan", "checks", "assets", "android", "ios", "web", "desktop", "cleanup", "publish"]));
    expect(all.get("desktop")).toMatch(/needs: \[plan, web\]/);
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
    expect(all.get("cleanup")).toContain("if: ${{ !cancelled() }}");
  });

  it("starts the web export beside the assets job and waits for it, as the native builds do", () => {
    for (const job of ["web", "android", "ios"]) expect(all.get(job), job).toContain(".github/scripts/wait-for-assets.sh");
    expect(all.get("web")).toMatch(/needs: \[plan\]/);
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
