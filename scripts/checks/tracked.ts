import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");

/** The files under `paths` (src, scripts, test, desktop and discord unless given) that are tracked or new and not ignored (what a commit of the tree would hold), repo-relative with forward
 * slashes. A file that is tracked but deleted in the tree is left out, and so is a link to a folder (a worktree's linked `.cache`): only a regular file is read. */
export function tracked(paths: readonly string[] = ["src", "scripts", "test", "desktop", "discord"]): string[] {
  const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", ...paths], { cwd: ROOT, encoding: "utf8" });
  return [...new Set(listed.split("\0").filter(Boolean))].filter((file) => existsSync(path.join(ROOT, file)) && statSync(path.join(ROOT, file)).isFile());
}

/** A record id (`01026:action:1`) or a printed line id (`01026:A:1`), as a whole token. */
export const NAME = /(?<![\w:])(\d{2,6}:[A-Za-z]+:\d+)(?![\w])/g;

/** The test files and test helpers: every tracked .ts or .tsx file under test/, and every *.test file under src/. */
export function testFiles(): string[] {
  return tracked(["src", "test"]).filter((file) => /\.(ts|tsx)$/.test(file) && (file.startsWith("test/") || /\.test\.tsx?$/.test(file)));
}

const STUB_COMMENT = /^[ \t]*\/\/ (?:records |\d{2,6}:[A-Za-z]+:\d+ printed: ).*$/gm;

/** The source without what `pnpm scenario tests` writes for a record no test names yet: each row that holds a `todo` (a stub, test/harness/card-spec.ts, stubProblem) and the `// <line> printed:`
 * and `// records` comments of a stub. A stub names no line to the coverage checks until its row is filled and its `todo` deleted. */
export function withoutStubs(source: string): string {
  let out = source.replace(STUB_COMMENT, "");
  for (let at = out.search(/\btodo:/); at >= 0; at = out.search(/\btodo:/)) {
    // The row is the braces around the `todo`: back to the unmatched `{`, forward to its `}`.
    let start = at;
    for (let depth = 0; start > 0; start--) {
      const char = out[start - 1];
      if (char === "}") depth++;
      else if (char === "{" && depth-- === 0) break;
    }
    let end = at;
    for (let depth = 1; end < out.length && depth > 0; end++) {
      if (out[end] === "{") depth++;
      else if (out[end] === "}") depth--;
    }
    // A `todo:` with no braces around it is cut alone, so the loop ends.
    out = start > 0 ? `${out.slice(0, start - 1)}${out.slice(end)}` : `${out.slice(0, at)}${out.slice(at + 5)}`;
  }
  return out;
}

/** Every record id and line id that a test file names anywhere, comments included, except what a stub row names (withoutStubs). */
export function namedInTests(): Set<string> {
  const named = new Set<string>();
  for (const file of testFiles()) for (const found of withoutStubs(readFileSync(path.join(ROOT, file), "utf8")).matchAll(NAME)) named.add(found[1]!);
  return named;
}
