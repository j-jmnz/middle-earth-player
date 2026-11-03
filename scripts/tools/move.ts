import { existsSync, mkdirSync, readFileSync, renameSync, rmdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { runScript, type Log } from "../log.ts";

// Moves tracked files and rewrites every path that names them, so a folder can be reorganised in one command.
//
// Usage:
//   pnpm move <old> <new>          one file or folder
//   pnpm move <map.json>           { "old": "new", ... }: files, folders, or patterns with one `*` (in the file name)
//   --dry-run                      plan and report, change nothing; --verbose lists every move and rewrite
//   --no-companions                move only what the map names
//
// What it rewrites:
// - In code (.ts .tsx .js .mjs .cjs .mts): every quoted "./" or "../" string that resolves to a tracked file or folder:
//   import and export specifiers, import(), require(), vi.mock(), new URL("./x", import.meta.url), .sql imports. A
//   specifier keeps its style: with or without the extension, "/index" left implicit, a trailing slash kept.
// - In Markdown: relative link targets, "](../x.md#anchor)".
// - Everywhere it reads (code, docs, agent files, YAML, shell, root JSON configs): repository paths written out from the
//   root, "src/play/layout/layout.ts", "scripts/log.ts", a whole moved folder, or a file named without its extension; and a
//   file named by a tail of its path no other file shares ("families/sea/ships.ts", or "sea/ships.ts" when it is renamed).
//
// Companions: a moved file takes along, unless the map names them, its platform variants (x.native.ts, x.ios.tsx, ...)
// and its test (x.test.ts), so a `.native` pair never separates (docs/architecture.md, Modules).
//
// It cannot follow a path built at run time (path.join(dirname, ".."), a template literal); it lists the moved files that
// build one, to check by hand. data/, assets/, docs/INDEX.md (pnpm docs:index rewrites it), golden and fixture JSON are
// never read or rewritten.

const CODE = /\.(ts|tsx|js|mjs|cjs|mts)$/;
const MARKDOWN = /\.(md|mdc)$/;
const TEXT = /\.(ts|tsx|js|mjs|cjs|mts|md|mdc|ya?ml|sh)$/;
// JSON read for root-written paths: configs only, never data.
const CONFIG_JSON = new Set(["package.json", "tsconfig.json", "app.json", "eas.json", ".claude/settings.json", ".vscode/settings.json", ".vscode/extensions.json"]);
const NEVER = [/^data\//, /^assets\//, /^node_modules\//, /^docs\/INDEX\.md$/, /(^|\/)golden\//, /^src\/campaign\/fixtures\//, /^pnpm-lock\.yaml$/, /^scripts\/tools\/move\.test\.ts$/];

// Extensions an import may leave off, in the order a resolver tries them.
const IMPLICIT = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".native.ts", ".native.tsx"];
const INDEXES = ["/index.ts", "/index.tsx", "/index.js"];
const PLATFORMS = [".native", ".ios", ".android", ".web"];

export type Plan = {
  /** Old path to new path, every file that moves. */
  moves: Map<string, string>;
  /** New path to its full new text, every file whose text changes (at its new location when it moves). */
  writes: Map<string, string>;
  /** How many paths each file had rewritten, by its new path. */
  counts: Map<string, number>;
  /** What a person should look at: run-time paths in moved files, specifiers that resolve to nothing. */
  warnings: string[];
};

const posix = path.posix;

function stripExt(file: string): string {
  return file.replace(/\.[^./]+$/, "");
}

/** The map's entries as file moves: folders expand to every file under them, a `*` pattern matches within one name. */
export function expandEntries(entries: Record<string, string>, tracked: readonly string[], companions = true): Map<string, string> {
  const moves = new Map<string, string>();
  const add = (from: string, to: string) => {
    const earlier = moves.get(from);
    if (earlier !== undefined && earlier !== to) throw new Error(`${from} is mapped twice: ${earlier} and ${to}`);
    moves.set(from, to);
  };
  for (const [rawFrom, rawTo] of Object.entries(entries)) {
    const from = rawFrom.replace(/\/+$/, "");
    const to = rawTo.replace(/\/+$/, "");
    if (from.includes("*")) {
      if (from.split("*").length !== 2 || to.split("*").length !== 2) throw new Error(`a pattern takes exactly one * on each side: ${rawFrom}`);
      const [head, tail] = from.split("*") as [string, string];
      const [toHead, toTail] = to.split("*") as [string, string];
      let matched = 0;
      for (const file of tracked) {
        if (!file.startsWith(head) || !file.endsWith(tail) || file.length < head.length + tail.length) continue;
        const middle = file.slice(head.length, file.length - tail.length);
        if (middle.includes("/")) continue;
        add(file, `${toHead}${middle}${toTail}`);
        matched += 1;
      }
      if (matched === 0) throw new Error(`no tracked file matches ${rawFrom}`);
      continue;
    }
    if (tracked.includes(from)) {
      add(from, to);
      continue;
    }
    const under = tracked.filter((file) => file.startsWith(`${from}/`));
    if (under.length === 0) throw new Error(`${rawFrom} is neither a tracked file nor a folder with tracked files`);
    for (const file of under) add(file, `${to}${file.slice(from.length)}`);
  }
  if (companions) {
    const trackedSet = new Set(tracked);
    for (const [from, to] of [...moves]) {
      const ext = path.extname(from);
      if (!/^\.(ts|tsx|js)$/.test(ext) || /\.(test|native|ios|android|web)\.[^.]+$/.test(from)) continue;
      const base = from.slice(0, -ext.length);
      const toBase = to.slice(0, -path.extname(to).length);
      const suffixes = [...PLATFORMS.flatMap((platform) => [".ts", ".tsx", ".js"].map((e) => `${platform}${e}`)), ".test.ts", ".test.tsx", ...PLATFORMS.flatMap((platform) => [`${platform}.test.ts`, `${platform}.test.tsx`])];
      for (const suffix of suffixes) {
        const sibling = `${base}${suffix}`;
        if (trackedSet.has(sibling) && !moves.has(sibling)) moves.set(sibling, `${toBase}${suffix}`);
      }
    }
  }
  for (const [from, to] of [...moves]) if (from === to) moves.delete(from);
  return moves;
}

type Resolved = { kind: "file"; file: string; added: string } | { kind: "dir"; dir: string };

/** Where a relative specifier written in `fromFile` points, among the tracked files (old layout). */
function resolveRelative(fromFile: string, spec: string, files: ReadonlySet<string>, dirs: ReadonlySet<string>): Resolved | null {
  const joined = posix.normalize(posix.join(posix.dirname(fromFile), spec));
  if (joined.startsWith("../") || joined === "..") return null;
  const target = joined.replace(/\/+$/, "");
  if (files.has(target)) return { kind: "file", file: target, added: "" };
  for (const ext of IMPLICIT) if (files.has(`${target}${ext}`)) return { kind: "file", file: `${target}${ext}`, added: ext };
  for (const index of INDEXES) if (files.has(`${target}${index}`)) return { kind: "file", file: `${target}${index}`, added: index };
  if (target === "." || dirs.has(target)) return { kind: "dir", dir: target === "." ? "" : target };
  return null;
}

/** Every folder that holds a tracked file, at any depth. */
function foldersOf(files: Iterable<string>): Set<string> {
  const dirs = new Set<string>();
  for (const file of files) {
    let dir = posix.dirname(file);
    while (dir !== "." && !dirs.has(dir)) {
      dirs.add(dir);
      dir = posix.dirname(dir);
    }
  }
  return dirs;
}

/**
 * A folder's new path: unchanged while it still holds a file, the common new folder when all of its files moved together,
 * null when its files scattered (no one path names them any more).
 */
function folderMapper(tracked: readonly string[], moves: ReadonlyMap<string, string>): (dir: string) => string | null {
  const cache = new Map<string, string | null>();
  return (dir) => {
    const cached = cache.get(dir);
    if (cached !== undefined || cache.has(dir)) return cached ?? null;
    const prefix = dir === "" ? "" : `${dir}/`;
    const under = tracked.filter((file) => file.startsWith(prefix));
    let result: string | null = dir;
    // Still there while any file stays in it or lands somewhere under it again (sea-x.ts → sea/x.ts); otherwise moved
    // when every file kept its place inside it, scattered when not.
    const stays = under.some((file) => !moves.has(file) || moves.get(file)!.startsWith(prefix));
    if (!stays && under.length > 0) {
      const targets = under.map((file) => {
        const to = moves.get(file)!;
        const rest = file.slice(prefix.length);
        return to.endsWith(`/${rest}`) ? to.slice(0, -rest.length - 1) : null;
      });
      result = targets.every((target) => target !== null && target === targets[0]) ? targets[0]! : null;
    }
    cache.set(dir, result);
    return result;
  };
}

function relativeSpec(fromFile: string, to: string, trailingSlash: boolean): string {
  let rel = posix.relative(posix.dirname(fromFile), to);
  if (rel === "") rel = ".";
  if (!rel.startsWith("../") && rel !== ".." && rel !== ".") rel = `./${rel}`;
  if (rel === ".") rel = "./";
  return trailingSlash && !rel.endsWith("/") ? `${rel}/` : rel;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The whole move, computed without touching the disk: `read` gives a tracked file's text (null for a file it should not
 * read). Throws on a collision: two files to one path, or onto a tracked file that stays.
 */
export function planMove(tracked: readonly string[], entries: Record<string, string>, read: (file: string) => string | null, options: { companions?: boolean; exists?: (file: string) => boolean } = {}): Plan {
  const moves = expandEntries(entries, tracked, options.companions ?? true);
  const files = new Set(tracked);
  const dirs = foldersOf(tracked);
  const newOf = (file: string) => moves.get(file) ?? file;
  const newDir = folderMapper(tracked, moves);

  const seen = new Map<string, string>();
  for (const file of tracked) {
    const to = newOf(file);
    const other = seen.get(to);
    if (other !== undefined) throw new Error(`${other} and ${file} would both land on ${to}`);
    seen.set(to, file);
  }

  // Root-written paths: each moved file, its extensionless stem when no other file shares it, and each folder whose
  // files all moved together. One alternation, longest first, so "src/play/layout/slots.ts" never matches as
  // "src/play/layout/layout" plus a tail.
  const rootPaths = new Map<string, string>();
  for (const [from, to] of moves) rootPaths.set(from, to);
  const stems = new Map<string, Set<string>>();
  for (const file of tracked) {
    const stem = stripExt(file);
    const group = stems.get(stem) ?? new Set<string>();
    group.add(file);
    stems.set(stem, group);
  }
  for (const [stem, group] of stems) {
    if (!group.size || ![...group].some((file) => moves.has(file))) continue;
    const newStems = new Set([...group].map((file) => stripExt(newOf(file))));
    const extsKept = [...group].every((file) => path.extname(file) === path.extname(newOf(file)));
    if (newStems.size === 1 && extsKept) rootPaths.set(stem, [...newStems][0]!);
  }
  for (const dir of dirs) {
    const to = newDir(dir);
    if (to !== null && to !== dir) rootPaths.set(dir, to);
  }
  // A moved file named by the tail of its path ("families/defense/excess.ts", "rules/families/x.ts") when no other file
  // ends that way: the same tail of its new path. Named by its bare file name, when that is unique and changes: the
  // shortest tail of its new path, folder included, that no other file shares ("sea/ships.ts" → "sea/ships.ts").
  const tailCounts = (paths: Iterable<string>) => {
    const counts = new Map<string, number>();
    for (const file of paths) {
      const parts = file.split("/");
      for (let k = 1; k <= parts.length; k += 1) {
        const tail = parts.slice(-k).join("/");
        counts.set(tail, (counts.get(tail) ?? 0) + 1);
      }
    }
    return counts;
  };
  const oldTails = tailCounts(tracked);
  const newTails = tailCounts(tracked.map(newOf));
  for (const [from, to] of moves) {
    const parts = from.split("/");
    for (let k = 1; k < parts.length; k += 1) {
      const tail = parts.slice(-k).join("/");
      if (oldTails.get(tail) !== 1 || rootPaths.has(tail)) continue;
      if (k >= 2) {
        const head = parts.slice(0, -k).join("/") + "/";
        rootPaths.set(tail, to.startsWith(head) ? to.slice(head.length) : to);
        continue;
      }
      if (posix.basename(to) === tail) continue;
      const newParts = to.split("/");
      for (let j = 2; j <= newParts.length; j += 1) {
        const newTail = newParts.slice(-j).join("/");
        if (newTails.get(newTail) === 1) {
          rootPaths.set(tail, newTail);
          break;
        }
      }
    }
  }
  const rootPattern = rootPaths.size === 0 ? null : new RegExp(`(?<![\\w./@-])(${[...rootPaths.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})(?![\\w-]|\\.[\\w])`, "g");

  const writes = new Map<string, string>();
  const counts = new Map<string, number>();
  const warnings: string[] = [];

  for (const file of tracked) {
    const name = file;
    const isConfig = CONFIG_JSON.has(name);
    if (!isConfig && (!TEXT.test(name) || NEVER.some((pattern) => pattern.test(name)))) continue;
    const text = read(file);
    if (text === null) continue;
    const to = newOf(file);
    const moved = to !== file;
    let count = 0;

    // A relative string, re-aimed from the file's new place at its target's new place.
    const rewriteRelative = (spec: string, markdown: boolean): string => {
      const hashAt = markdown ? spec.search(/[#?]/) : spec.search(/\?/);
      const bare = hashAt >= 0 ? spec.slice(0, hashAt) : spec;
      const tail = hashAt >= 0 ? spec.slice(hashAt) : "";
      // An untracked file on disk (a build output: assets/catalog.db) never moves, but a moved file's path to it does.
      const untracked = (): Resolved | null => {
        const target = posix.normalize(posix.join(posix.dirname(file), bare)).replace(/\/+$/, "");
        return moved && !target.startsWith("../") && options.exists?.(target) ? { kind: "file", file: target, added: "" } : null;
      };
      const resolved = resolveRelative(file, bare, files, dirs) ?? untracked();
      if (!resolved) {
        if (moved && !markdown) warnings.push(`${file}: "${spec}" resolves to no tracked file; check it by hand`);
        return spec;
      }
      let target: string;
      if (resolved.kind === "file") {
        const newTarget = newOf(resolved.file);
        if (!moved && newTarget === resolved.file) return spec;
        if (resolved.added && !newTarget.endsWith(resolved.added)) {
          warnings.push(`${file}: "${spec}" now names ${newTarget}, whose extension changed; written in full`);
          target = newTarget;
        } else target = resolved.added ? newTarget.slice(0, -resolved.added.length) : newTarget;
      } else {
        const mapped = newDir(resolved.dir);
        if (mapped === null) {
          warnings.push(`${file}: "${spec}" names ${resolved.dir}/, whose files scattered; check it by hand`);
          return spec;
        }
        if (!moved && mapped === resolved.dir) return spec;
        target = mapped === "" ? "." : mapped;
      }
      let written = relativeSpec(to, target, bare.endsWith("/"));
      // A Markdown link written bare ("brief.md") stays bare.
      if (markdown && !bare.startsWith(".") && written.startsWith("./")) written = written.slice(2);
      const next = `${written}${tail}`;
      if (next !== spec) count += 1;
      return next;
    };

    let next = text;
    if (CODE.test(name)) {
      next = next.replace(/(["'])(\.\.?\/[^"'\n\\]*)\1/g, (_whole, quote: string, spec: string) => `${quote}${rewriteRelative(spec, false)}${quote}`);
      if (moved && /`\.\.?\//.test(text)) warnings.push(`${file}: builds a relative path in a template literal; check it by hand`);
      if (moved && posix.dirname(file).split("/").length !== posix.dirname(to).split("/").length && /(import\.meta\.url|__dirname|import\.meta\.dirname)[\s\S]{0,200}["']\.\.["']/.test(text)) {
        warnings.push(`${file}: moved to another depth and builds a path from its own folder with ".."; check it by hand`);
      }
    } else if (MARKDOWN.test(name)) {
      next = next.replace(/\]\((?!https?:|mailto:|#|\/)([^)\s]+)\)/g, (_whole, spec: string) => `](${rewriteRelative(spec, true)})`);
    }
    if (rootPattern) {
      next = next.replace(rootPattern, (match: string) => {
        const replaced = rootPaths.get(match);
        if (replaced === undefined || replaced === match) return match;
        count += 1;
        return replaced;
      });
    }
    if (next !== text) {
      writes.set(to, next);
      counts.set(to, count);
    }
  }
  return { moves, writes, counts, warnings };
}

// ---- Applying a plan ----

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function removeEmptyFolders(dir: string): void {
  let current = dir;
  while (current !== ROOT && current.startsWith(ROOT)) {
    try {
      if (readdirSync(current).length > 0) return;
      rmdirSync(current);
    } catch {
      return;
    }
    current = path.dirname(current);
  }
}

function applyPlan(plan: Plan, log: Log): void {
  for (const [from, to] of plan.moves) {
    if (plan.moves.has(to)) throw new Error(`${from} → ${to} lands on a file that also moves; split it into two runs`);
    if (existsSync(path.join(ROOT, to))) throw new Error(`${to} already exists (untracked?); nothing was moved`);
  }
  for (const [from, to] of plan.moves) {
    mkdirSync(path.join(ROOT, path.dirname(to)), { recursive: true });
    renameSync(path.join(ROOT, from), path.join(ROOT, to));
    log.debug(`${from} → ${to}`);
  }
  for (const from of plan.moves.keys()) removeEmptyFolders(path.join(ROOT, path.dirname(from)));
  for (const [file, text] of plan.writes) writeFileSync(path.join(ROOT, file), text);
  // Stage the moves so git records them as renames; chunks keep the argument list short.
  const paths = [...plan.moves.keys(), ...plan.moves.values()];
  for (let start = 0; start < paths.length; start += 500) git(["add", "--all", "--", ...paths.slice(start, start + 500)]);
}

function entriesFrom(args: readonly string[]): Record<string, string> {
  if (args.length === 2) return { [args[0]!]: args[1]! };
  if (args.length === 1 && args[0]!.endsWith(".json")) return JSON.parse(readFileSync(path.resolve(args[0]!), "utf8")) as Record<string, string>;
  throw new Error("usage: pnpm move <old> <new> | pnpm move <map.json> [--dry-run] [--no-companions]");
}

function main(log: Log): void {
  const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith("--")));
  const entries = entriesFrom(process.argv.slice(2).filter((arg) => !arg.startsWith("--")));
  const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  const read = (file: string): string | null => {
    try {
      return readFileSync(path.join(ROOT, file), "utf8");
    } catch {
      return null;
    }
  };
  const plan = planMove(tracked, entries, read, { companions: !flags.has("--no-companions"), exists: (file) => existsSync(path.join(ROOT, file)) });
  const rewrites = [...plan.counts.values()].reduce((sum, count) => sum + count, 0);
  for (const [file, count] of plan.counts) log.debug(`${file}: ${count} path${count === 1 ? "" : "s"}`);
  for (const warning of plan.warnings) log.warn(warning);
  if (flags.has("--dry-run")) {
    for (const [from, to] of plan.moves) log.debug(`${from} → ${to}`);
    log.info(`dry run: ${plan.moves.size} files would move, ${rewrites} paths in ${plan.writes.size} files would be rewritten`);
    return;
  }
  applyPlan(plan, log);
  log.info(`${plan.moves.size} files moved, ${rewrites} paths rewritten in ${plan.writes.size} files`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("move", main, { done: false });
