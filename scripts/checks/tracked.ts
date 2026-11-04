import { execFileSync } from "node:child_process";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");

/** The tracked files under src, scripts and test, repo-relative with forward slashes. */
export function tracked(): string[] {
  return execFileSync("git", ["ls-files", "-z", "src", "scripts", "test"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
}
