// A branch that holds desktop work leaves every phone-only file as it was (docs/architecture.md, Screens; user instruction, 2026-11-16):
// the web gets its own variants, and a shared file gains only branches a phone cannot run. The changed files are the working tree's and the new
// files' against the merge base with origin/main; after a squash merge the diff is empty, and a branch with no desktop file is not held to it.
import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";

import { isDesktopWork, isPhoneOnly, phoneFilesTouchedByDesktop } from "./phone-files.ts";
import { ROOT } from "./tracked.ts";

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

// The files that differ from the merge base with origin/main, or null when git or the base is not there (a shallow checkout).
function changedSinceBase(): string[] | null {
  try {
    const base = git("merge-base", "HEAD", "origin/main").trim();
    if (!base) return null;
    const changed = git("diff", "--name-only", base).split("\n");
    const added = git("ls-files", "--others", "--exclude-standard").split("\n");
    return [...new Set([...changed, ...added])].filter(Boolean);
  } catch {
    return null;
  }
}

describe("phone-only files", () => {
  test("which files are which", () => {
    expect(["src/play/canvas/table-canvas.native.tsx", "src/x/use.ios.ts", "a.android.tsx", "modules/skia/x.ts", "app.json", "plugins/p.js", "eas.json"].every(isPhoneOnly)).toBe(true);
    expect(["src/play/canvas/table-canvas.tsx", "src/play/spotlight/burn.ts", "package.json"].some(isPhoneOnly)).toBe(false);
    expect(["desktop/main.ts", "src/ui/skia/skia-web.ts", "src/x/y.canvaskit.tsx"].every(isDesktopWork)).toBe(true);
  });

  test("a change with desktop work names the phone files it touches; one without is not held", () => {
    expect(phoneFilesTouchedByDesktop(["src/ui/skia/skia-web.ts", "src/a.native.ts", "src/b.ts"])).toEqual(["src/a.native.ts"]);
    expect(phoneFilesTouchedByDesktop(["src/a.native.ts", "src/b.ts"])).toEqual([]);
  });

  test("no phone-only file differs from the merge base on a branch with desktop work", (context) => {
    const changed = changedSinceBase();
    if (!changed) context.skip("no git history to the merge base with origin/main (a shallow checkout)");
    const touched = phoneFilesTouchedByDesktop(changed ?? []);
    expect(touched, `desktop work must leave these phone files untouched: ${touched.join(", ")}`).toEqual([]);
  });
});
