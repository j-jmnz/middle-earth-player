import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { isSoundSlot, SOUND_SLOTS, type SoundSlot } from "../../src/ui/sound/slots.ts";
import { mirrorFromEnv, mirrorReader } from "../data/mirror/client.ts";
import { DATA_DIR, SOUND_CACHE_DIR, SOUND_PACK_DIR } from "../data/paths.ts";
import { sha256, type SourceFile, type SourceRecord } from "../data/sources/fetch.ts";
import { bytes, isDirectRun, runPack, type Log } from "../log.ts";
import { SOUND_PICKS, type SoundPick } from "./sound-picks.ts";

// The sound effects are not in git and come from no online source: they are cut from the player's own Darkest Dungeon II install
// (user decision, 2026-11-21; docs/design-system-table.md, Sound), and every release carries them (user decision, 2026-11-21).
// `pnpm assets sounds --from <folder>` cuts each slot's pick (sound-picks.ts) from the folder of unpacked banks (one subfolder a bank,
// `<n>-<event>.ogg` as vgmstream names them) into .cache/audio/sfx and pins each file by sha256 as the `sounds` source of
// data/sources.json; `pnpm data mirror push sounds` then puts them in the asset mirror, which is their only copy online.
// `pnpm assets sounds` copies each pinned file into assets/sounds, where the phone's require.context finds them
// (src/ui/sound/bundled.native.ts): from .cache when it holds the pin, else from the mirror. A sound found in neither is left out,
// with a warning, and the app plays none for it.

export const SOUND_SOURCE = "sounds";
const SITE = "Darkest Dungeon II (the player's own install, cut by pnpm assets sounds --from)";
// The tail is kept until the level stays under 1% of the peak, plus this much, then faded out.
const TAIL_SECONDS = 0.12;

type Sources = { sources: Record<string, SourceRecord> };

/** The pick's source file in the unpacked banks: `<bank>/<n>-<event>.ogg`. */
export function findSource(from: string, pick: SoundPick): string | undefined {
  const folder = path.join(from, pick.bank);
  if (!existsSync(folder)) return undefined;
  const name = readdirSync(folder).find((file) => file.replace(/^[0-9]+-/, "") === `${pick.event}.ogg`);
  return name ? path.join(folder, name) : undefined;
}

function ffmpeg(args: string[]): Buffer {
  const run = spawnSync("ffmpeg", ["-v", "error", ...args], { maxBuffer: 64 * 1024 * 1024 });
  if (run.error) throw new Error(`ffmpeg is needed to cut the sounds (${run.error.message})`);
  if (run.status !== 0) throw new Error(`ffmpeg ${args.join(" ")} failed: ${run.stderr.toString()}`);
  return run.stdout;
}

/** Where the sound's tail falls under 1% of its peak, in seconds, read from a 8 kHz mono decode in 10 ms windows. */
export function soundEnd(samples: Int16Array, rate: number): number {
  const window = Math.round(rate / 100);
  const levels: number[] = [];
  for (let start = 0; start < samples.length; start += window) {
    let level = 0;
    for (let i = start; i < Math.min(start + window, samples.length); i += 1) level = Math.max(level, Math.abs(samples[i] ?? 0));
    levels.push(level);
  }
  const peak = Math.max(1, ...levels);
  const last = levels.findLastIndex((level) => level > peak * 0.01);
  return ((last < 0 ? 0 : last) + 1) * (window / rate);
}

/** Cuts, levels and encodes each slot's pick into `cacheDir`, and returns the `sounds` source that pins every file. */
export function cutSounds(from: string, cacheDir: string, log: Log): SourceRecord {
  mkdirSync(cacheDir, { recursive: true });
  const files: SourceFile[] = [];
  for (const slot of SOUND_SLOTS) {
    const pick = SOUND_PICKS[slot];
    const source = findSource(from, pick);
    if (!source) throw new Error(`${slot}: ${pick.bank}/<n>-${pick.event}.ogg is not in ${from}`);
    const pcm = ffmpeg(["-i", source, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"]);
    const end = Math.min(soundEnd(new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2)), 8000) + TAIL_SECONDS, pick.maxSeconds);
    const fade = Math.min(0.15, end / 3);
    const target = path.join(cacheDir, `${slot}.m4a`);
    const filter = `atrim=0:${end.toFixed(3)},afade=t=out:st=${(end - fade).toFixed(3)}:d=${fade.toFixed(3)},loudnorm=I=${pick.lufs}:TP=-1.5:LRA=11`;
    ffmpeg(["-y", "-i", source, "-ac", "1", "-ar", "44100", "-af", filter, "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", target]);
    const body = readFileSync(target);
    // No URL can fetch it: the file's "url" names the bank and the event it was cut from.
    files.push({ path: `sounds/${slot}.m4a`, url: `${pick.bank}.bank#${pick.event}`, sha256: sha256(body), bytes: body.length });
    log.debug(`${slot}: ${pick.event}, ${end.toFixed(2)} s`);
  }
  log.info(`cut ${files.length} sounds into ${cacheDir}`);
  return { id: SOUND_SOURCE, site: SITE, pin: { kind: "sha256", value: sha256(files.map((file) => file.sha256).join("\n")) }, fetchedAt: new Date().toISOString(), files };
}

/** Writes the `sounds` source into data/sources.json beside the others, in the same order and form `pnpm data sync` writes. */
export function writeSoundSource(sourcesPath: string, record: SourceRecord): void {
  const { sources } = JSON.parse(readFileSync(sourcesPath, "utf8")) as Sources;
  const next = Object.fromEntries(Object.entries({ ...sources, [record.id]: record }).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(sourcesPath, `${JSON.stringify({ sources: next }, null, 2)}\n`);
}

export type PackSoundsOptions = {
  sourcesPath: string;
  cacheDir: string;
  outDir: string;
  /** The asset mirror's reader (mirrorReader): a body at the hash, or null. */
  mirror?: (hash: string) => Promise<Uint8Array | null>;
};

/**
 * Copies every sound the `sounds` source pins into `outDir`, from `cacheDir` at its pin or else from the mirror (kept in `cacheDir`
 * after), and removes any other file there but `.gitkeep`. A sound in neither is left out with a warning; with no `sounds` source
 * nothing is bundled.
 */
export async function packSounds(options: PackSoundsOptions, log: Log): Promise<SoundSlot[]> {
  const { sourcesPath, cacheDir, outDir } = options;
  mkdirSync(outDir, { recursive: true });
  const { sources } = JSON.parse(readFileSync(sourcesPath, "utf8")) as Sources;
  const pins = sources[SOUND_SOURCE]?.files ?? [];
  const keep = new Set([".gitkeep"]);
  const packed: SoundSlot[] = [];
  const missing: string[] = [];
  let fromMirror = 0;
  let total = 0;
  for (const pin of pins) {
    const slot = /^sounds\/(.+)\.m4a$/.exec(pin.path)?.[1] ?? "";
    if (!isSoundSlot(slot)) throw new Error(`${sourcesPath}: ${pin.path} is not a sound slot's file`);
    const file = `${slot}.m4a`;
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
      missing.push(slot);
      continue;
    }
    writeFileSync(path.join(outDir, file), body);
    keep.add(file);
    packed.push(slot);
    total += body.length;
  }
  for (const file of readdirSync(outDir)) if (!keep.has(file)) rmSync(path.join(outDir, file), { recursive: true, force: true });
  if (pins.length === 0) log.warn(`${sourcesPath} pins no sounds, so this bundle carries none. Cut them with pnpm assets sounds --from <folder>.`);
  if (missing.length > 0) log.warn(`${missing.length} pinned sound${missing.length === 1 ? " is" : "s are"} in neither ${cacheDir} nor the mirror, so this bundle plays none for ${missing.join(", ")}`);
  if (packed.length > 0) log.notice(`packed ${packed.length} sounds (${bytes(total)}; ${fromMirror} from the mirror) into ${outDir}; restart Metro with --clear to bundle them`);
  return packed;
}
function argument(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

// --optional (pnpm assets all): a failed pack is a warning, so the other packs still run.
if (isDirectRun(import.meta.url)) {
  runPack("pack-sounds", "sounds not packed, so this bundle carries none", async (log) => {
    const sourcesPath = path.join(DATA_DIR, "sources.json");
    const from = argument("--from");
    if (from) {
      writeSoundSource(sourcesPath, cutSounds(path.resolve(from), SOUND_CACHE_DIR, log));
      log.notice(`pinned the sounds in ${sourcesPath}: commit it, then run pnpm data mirror push sounds`);
    }
    await packSounds({ sourcesPath, cacheDir: SOUND_CACHE_DIR, outDir: SOUND_PACK_DIR, mirror: mirrorReader(mirrorFromEnv(), log) }, log);
  });
}
