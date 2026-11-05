import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");

/** The files under src, scripts and test that are tracked or new and not ignored (what a commit of the tree would hold), repo-relative with forward slashes. A file that is tracked
 * but deleted in the tree is left out. */
export function tracked(): string[] {
  const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "src", "scripts", "test"], { cwd: ROOT, encoding: "utf8" });
  return [...new Set(listed.split("\0").filter(Boolean))].filter((file) => existsSync(path.join(ROOT, file)));
}
