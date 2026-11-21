// What the sound effect and music packs share (scripts/build/pack-sounds.ts, pack-music.ts): ffmpeg, the source they pin in
// data/sources.json, and the copy of every pinned file into the app's assets from .cache or the asset mirror. Neither kind has an
// online source: both are cut from the player's own files, so the mirror is their only copy online (docs/development.md, Asset mirror).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { sha256, type SourceFile, type SourceRecord } from "../data/sources/fetch.ts";
import { bytes, type Log } from "../log.ts";

type Sources = { sources: Record<string, SourceRecord> };

/** Runs ffmpeg and returns what it wrote to stdout; a missing ffmpeg or a failed run throws with its output. */
export function ffmpeg(args: string[]): Buffer {
  const run = spawnSync("ffmpeg", ["-v", "error", ...args], { maxBuffer: 256 * 1024 * 1024 });
  if (run.error) throw new Error(`ffmpeg is needed to cut the audio (${run.error.message})`);
  if (run.status !== 0) throw new Error(`ffmpeg ${args.join(" ")} failed: ${run.stderr.toString()}`);
  return run.stdout;
}

/** The source that pins `files`, its own pin the sha256 of theirs. */
export function audioSource(id: string, site: string, files: SourceFile[]): SourceRecord {
  return { id, site, pin: { kind: "sha256", value: sha256(files.map((file) => file.sha256).join("\n")) }, fetchedAt: new Date().toISOString(), files };
}

/** Writes a source into data/sources.json beside the others, in the same order and form `pnpm data sync` writes. */
export function writeSource(sourcesPath: string, record: SourceRecord): void {
  const { sources } = JSON.parse(readFileSync(sourcesPath, "utf8")) as Sources;
  const next = Object.fromEntries(Object.entries({ ...sources, [record.id]: record }).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(sourcesPath, `${JSON.stringify({ sources: next }, null, 2)}\n`);
}

export type PackPinnedOptions = {
  sourcesPath: string;
  cacheDir: string;
  outDir: string;
  /** The asset mirror's reader (mirrorReader): a body at the hash, or null. */
  mirror?: (hash: string) => Promise<Uint8Array | null>;
};

/** What is packed: the source's id (and its pins' folder), the names it accepts, and what a log line calls one. */
export type PinnedKind<Name extends string> = { source: string; isName: (name: string) => name is Name; noun: string };

/**
 * Copies every file the kind's source pins (`<source>/<name>.m4a`) into `outDir`, from `cacheDir` at its pin or else from the mirror
 * (kept in `cacheDir` after), and removes any other file there but `.gitkeep`. A file in neither is left out with a warning; with no
 * such source nothing is bundled.
 */
export async function packPinned<Name extends string>(kind: PinnedKind<Name>, options: PackPinnedOptions, log: Log): Promise<Name[]> {
  const { sourcesPath, cacheDir, outDir } = options;
  mkdirSync(outDir, { recursive: true });
  const { sources } = JSON.parse(readFileSync(sourcesPath, "utf8")) as Sources;
  const pins = sources[kind.source]?.files ?? [];
  const keep = new Set([".gitkeep"]);
  const packed: Name[] = [];
  const missing: string[] = [];
  let fromMirror = 0;
  let total = 0;
  for (const pin of pins) {
    const name = new RegExp(`^${kind.source}/(.+)\\.m4a$`).exec(pin.path)?.[1] ?? "";
    if (!kind.isName(name)) throw new Error(`${sourcesPath}: ${pin.path} is not a ${kind.noun}'s file`);
    const file = `${name}.m4a`;
    const cached = path.join(cacheDir, file);
    let body: Uint8Array | null = existsSync(cached) ? new Uint8Array(readFileSync(cached)) : null;
    if (body && sha256(body) !== pin.sha256) body = null;
    if (!body && options.mirror) {
      body = await options.mirror(pin.sha256);
      if (body) {
        mkdirSync(cacheDir, { recursive: true });
        writeFileSync(cached, body);
        fromMirror += 1;
      }
    }
    if (!body) {
      missing.push(name);
      continue;
    }
    writeFileSync(path.join(outDir, file), body);
    keep.add(file);
    packed.push(name);
    total += body.length;
  }
  for (const file of readdirSync(outDir)) if (!keep.has(file)) rmSync(path.join(outDir, file), { recursive: true, force: true });
  if (pins.length === 0) log.warn(`${sourcesPath} pins no ${kind.noun}s, so this bundle carries none. Cut them with --from <folder>.`);
  if (missing.length > 0) log.warn(`${missing.length} pinned ${kind.noun}${missing.length === 1 ? " is" : "s are"} in neither ${cacheDir} nor the mirror, so this bundle plays none for ${missing.join(", ")}`);
  if (packed.length > 0) log.notice(`packed ${packed.length} ${kind.noun}s (${bytes(total)}; ${fromMirror} from the mirror) into ${outDir}; restart Metro with --clear to bundle them`);
  return packed;
}

/** The value after `name` on the command line. */
export function argument(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
}
