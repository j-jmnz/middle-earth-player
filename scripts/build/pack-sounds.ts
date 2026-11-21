import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { isSoundSlot, SOUND_SLOTS, type SoundSlot } from "../../src/ui/sound/slots.ts";
import { SOUND_CACHE_DIR, SOUND_PACK_DIR } from "../data/paths.ts";
import { sha256 } from "../data/sources/fetch.ts";
import { bytes, isDirectRun, runPack, type Log } from "../log.ts";
import { SOUND_PICKS, type SoundPick } from "./sound-picks.ts";

// The sound effects are not in git and come from no online source: they are cut from the player's own Darkest Dungeon II install
// (user decision, 2026-11-21; docs/design-system-table.md, Sound). Two steps:
// `pnpm assets sounds --from <folder>` cuts each slot's pick (sound-picks.ts) from the folder of unpacked banks (one subfolder a bank,
// `<n>-<event>.ogg` as vgmstream names them) into .cache/audio/sfx, with a manifest of every file's sha256 and its source's;
// `pnpm assets sounds` copies the cached files into assets/sounds, where the app's require.context finds them (src/ui/sound/bundled.ts).
// A checkout or a release build without the cache bundles none, and the app plays none.

export type SoundManifestEntry = {
  slot: SoundSlot;
  file: string;
  sha256: string;
  source: { game: string; bank: string; event: string; sha256: string };
  seconds: number;
  lufs: number;
};

const MANIFEST = "manifest.json";
// The tail is kept until the level stays under 1% of the peak, plus this much, then faded out.
const TAIL_SECONDS = 0.12;

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

/** Cuts, levels and encodes each slot's pick into `cacheDir` and writes the manifest. */
export function cutSounds(from: string, cacheDir: string, log: Log): SoundManifestEntry[] {
  mkdirSync(cacheDir, { recursive: true });
  const manifest: SoundManifestEntry[] = [];
  for (const slot of SOUND_SLOTS) {
    const pick = SOUND_PICKS[slot];
    const source = findSource(from, pick);
    if (!source) throw new Error(`${slot}: ${pick.bank}/<n>-${pick.event}.ogg is not in ${from}`);
    const pcm = ffmpeg(["-i", source, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"]);
    const end = Math.min(soundEnd(new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2)), 8000) + TAIL_SECONDS, pick.maxSeconds);
    const fade = Math.min(0.15, end / 3);
    const file = `${slot}.m4a`;
    const target = path.join(cacheDir, file);
    const filter = `atrim=0:${end.toFixed(3)},afade=t=out:st=${(end - fade).toFixed(3)}:d=${fade.toFixed(3)},loudnorm=I=${pick.lufs}:TP=-1.5:LRA=11`;
    ffmpeg(["-y", "-i", source, "-ac", "1", "-ar", "44100", "-af", filter, "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", target]);
    manifest.push({ slot, file, sha256: sha256(readFileSync(target)), source: { game: "Darkest Dungeon II", bank: `${pick.bank}.bank`, event: pick.event, sha256: sha256(readFileSync(source)) }, seconds: Number(end.toFixed(2)), lufs: pick.lufs });
    log.debug(`${slot}: ${pick.event}, ${end.toFixed(2)} s`);
  }
  writeFileSync(path.join(cacheDir, MANIFEST), `${JSON.stringify(manifest, null, 1)}\n`);
  log.info(`cut ${manifest.length} sounds into ${cacheDir}`);
  return manifest;
}

/**
 * Copies every cached sound at its manifest's sha256 into `outDir` and removes any other file there but `.gitkeep`. With no
 * manifest the folder is emptied and nothing is bundled. A file whose bytes differ from the manifest fails the pack.
 */
export function packSounds(cacheDir: string, outDir: string, log: Log): SoundManifestEntry[] {
  mkdirSync(outDir, { recursive: true });
  const manifestPath = path.join(cacheDir, MANIFEST);
  const manifest = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, "utf8")) as SoundManifestEntry[]) : [];
  const keep = new Set([".gitkeep"]);
  for (const entry of manifest) {
    if (!isSoundSlot(entry.slot) || entry.file !== `${entry.slot}.m4a`) throw new Error(`${manifestPath}: ${entry.file} is not a sound slot's file`);
    const body = readFileSync(path.join(cacheDir, entry.file));
    if (sha256(body) !== entry.sha256) throw new Error(`${entry.file} in ${cacheDir} does not match its manifest sha256. Cut the sounds again with --from.`);
    copyFileSync(path.join(cacheDir, entry.file), path.join(outDir, entry.file));
    keep.add(entry.file);
  }
  for (const file of readdirSync(outDir)) if (!keep.has(file)) rmSync(path.join(outDir, file), { recursive: true, force: true });
  const total = manifest.reduce((sum, entry) => sum + readFileSync(path.join(outDir, entry.file)).length, 0);
  if (manifest.length === 0) log.warn(`no sounds in ${cacheDir}, so this bundle carries none. Cut them with pnpm assets sounds --from <folder>.`);
  else log.info(`packed ${manifest.length} sounds (${bytes(total)}) into ${outDir}; restart Metro with --clear to bundle them`);
  return manifest;
}

function argument(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

// --optional (pnpm assets all): a failed pack is a warning, so the other packs still run.
if (isDirectRun(import.meta.url)) {
  runPack("pack-sounds", "sounds not packed, so this bundle carries none", (log) => {
    const from = argument("--from");
    if (from) cutSounds(path.resolve(from), SOUND_CACHE_DIR, log);
    packSounds(SOUND_CACHE_DIR, SOUND_PACK_DIR, log);
  });
}
