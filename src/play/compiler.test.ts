import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The React Compiler (app.json experiments.reactCompiler) silently skips a component or hook it cannot compile, and a skipped
// one gets no automatic memoization. This runs it in memory over every non-test .ts/.tsx file in src/ui, src/play and src/screens
// (it only compiles components and hooks, so a file with no hook call and no JSX is skipped unread) and fails on any CompileError, listing file:line and the reason.
// Babel ships no types and the repo adds none, so the two calls this uses are typed here.
const load = createRequire(import.meta.url);
const { transformSync } = load("@babel/core") as { transformSync(code: string, options: object): unknown };
const reactCompiler = (load("babel-plugin-react-compiler") as { default: unknown }).default;
const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(file);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [file] : [];
  });
}

interface Loc {
  start: { line: number };
}
interface Detail {
  reason?: string;
  description?: string | null;
  loc?: Loc | symbol | null;
  details?: { loc?: Loc | symbol | null }[];
}
interface Event {
  kind: string;
  fnLoc?: Loc | null;
  detail?: Detail & { options?: Detail };
}

function bailouts(file: string): string[] {
  const code = fs.readFileSync(file, "utf8");
  if (!/\buse[A-Z]|<[A-Za-z]/.test(code)) return [];
  const found: string[] = [];
  const logger = {
    logEvent(_filename: string | null, event: Event) {
      if (event.kind !== "CompileError") return;
      const detail = event.detail?.options ?? event.detail;
      // The error's own line when the compiler has one (a suppression comment, a statement), else the start of the function.
      const own = [detail?.loc, ...(detail?.details ?? []).map((d) => d.loc)].find((l): l is Loc => typeof l === "object" && l !== null);
      const line = (own ?? event.fnLoc)?.start.line ?? 0;
      found.push(`${path.relative(src, file)}:${line} ${detail?.reason ?? "unknown"}${detail?.description ? ` (${detail.description})` : ""}`);
    },
  };
  transformSync(code, {
    filename: file,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [[reactCompiler, { target: "19", logger }]],
  });
  return found;
}

describe("React Compiler coverage", () => {
  it("compiles every component and hook in src/ui, src/play and src/screens", () => {
    const files = [...sources(path.join(src, "ui")), ...sources(path.join(src, "play")), ...sources(path.join(src, "screens"))];
    expect(files.length).toBeGreaterThan(50);
    const failures = files.flatMap(bailouts);
    expect(failures).toEqual([]);
  }, 120_000);
});
