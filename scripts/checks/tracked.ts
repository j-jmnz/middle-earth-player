import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");

/** The files under `paths` (src, scripts, test, desktop and discord unless given) that are tracked or new and not ignored (what a commit of the tree would hold), repo-relative with forward
 * slashes. A file that is tracked but deleted in the tree is left out. */
export function tracked(paths: readonly string[] = ["src", "scripts", "test", "desktop", "discord"]): string[] {
  const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", ...paths], { cwd: ROOT, encoding: "utf8" });
  return [...new Set(listed.split("\0").filter(Boolean))].filter((file) => existsSync(path.join(ROOT, file)));
}
