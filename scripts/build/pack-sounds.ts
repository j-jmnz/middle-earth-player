import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { isSoundSlot, SOUND_SLOTS, type SoundSlot } from "../../src/ui/sound/slots.ts";
import { mirrorFromEnv, mirrorReader } from "../data/mirror/client.ts";
import { DATA_DIR, SOUND_CACHE_DIR, SOUND_PACK_DIR } from "../data/paths.ts";
import { sha256, type SourceFile, type SourceRecord } from "../data/sources/fetch.ts";
import { isDirectRun, runPack, type Log } from "../log.ts";
import { argument, audioSource, ffmpeg, packPinned, writeSource, type PackPinnedOptions } from "./pack-audio.ts";
import { SOUND_PICKS, type SoundPick } from "./sound-picks.ts";

// The sound effects are not in git and come from no online source: they are cut from the player's own Darkest Dungeon II install
// (user decision, 2026-11-21; docs/design-system-table.md, Sound), and every release carries them (user decision, 2026-11-21).
// `pnpm assets sounds --from <folder> --hearthstone <folder>` cuts each slot's pick (sound-picks.ts) from the folder of unpacked banks (one
// subfolder a bank, `<n>-<event>.ogg` as vgmstream names them) or the folder of Hearthstone's sounds into .cache/audio/sfx and pins each file by sha256 as the `sounds` source of
// data/sources.json; `pnpm data mirror push sounds` then puts them in the asset mirror, which is their only copy online.
// `pnpm assets sounds` copies each pinned file into assets/sounds, where the phone's require.context finds them
// (src/ui/sound/bundled.native.ts): from .cache when it holds the pin, else from the mirror. A sound found in neither is left out,
// with a warning, and the app plays none for it.

export const SOUND_SOURCE = "sounds";
const SITE = "Darkest Dungeon II and Hearthstone (the player's own copies, cut by pnpm assets sounds --from and --hearthstone)";
// The silence before the sound is cut off (soundStart). The tail is kept until the level stays under 1% of the peak, plus this much, then faded out.
const TAIL_SECONDS = 0.12;

/** Where the player's copies are: the folder of unpacked Darkest Dungeon II banks, and the folder of Hearthstone's sounds. */
export type SoundFolders = { dd2: string; hearthstone?: string };

/** The pick's source file: `<bank>/<n>-<event>.ogg` in the unpacked banks, or `<event>.ogg` anywhere in the Hearthstone folder. */
export function findSource(folders: SoundFolders, pick: SoundPick): string | undefined {
  if (pick.game === "hearthstone") {
    if (!folders.hearthstone || !existsSync(folders.hearthstone)) return undefined;
    const name = (readdirSync(folders.hearthstone, { recursive: true }) as string[]).find((file) => path.basename(file) === `${pick.event}.ogg`);
    return name ? path.join(folders.hearthstone, name) : undefined;
  }
  const folder = path.join(folders.dd2, pick.bank);
  if (!existsSync(folder)) return undefined;
  const name = readdirSync(folder).find((file) => file.replace(/^[0-9]+-/, "") === `${pick.event}.ogg`);
  return name ? path.join(folder, name) : undefined;
}

// The peak level of each 10 ms window of a mono decode.
function windowLevels(samples: Int16Array, window: number): number[] {
  const levels: number[] = [];
  for (let start = 0; start < samples.length; start += window) {
    let level = 0;
    for (let i = start; i < Math.min(start + window, samples.length); i += 1) level = Math.max(level, Math.abs(samples[i] ?? 0));
    levels.push(level);
  }
  return levels;
}

/** Where the sound's tail falls under 1% of its peak, in seconds, read from a 8 kHz mono decode in 10 ms windows. */
export function soundEnd(samples: Int16Array, rate: number): number {
  const window = Math.round(rate / 100);
  const levels = windowLevels(samples, window);
  const peak = Math.max(1, ...levels);
  const last = levels.findLastIndex((level) => level > peak * 0.01);
  return ((last < 0 ? 0 : last) + 1) * (window / rate);
}

/**
 * Where the sound begins, in seconds: the start of the first 10 ms window over 1% of its peak. The silence a source file holds before
 * it is cut off, so the sound is heard at the moment it is played.
 */
export function soundStart(samples: Int16Array, rate: number): number {
  const window = Math.round(rate / 100);
  const levels = windowLevels(samples, window);
  const peak = Math.max(1, ...levels);
  const first = levels.findIndex((level) => level > peak * 0.01);
  return Math.max(0, first) * (window / rate);
}

/**
 * When a sound is heard after its file starts to play, in seconds: `silence` to the first 10 ms window over 1% of its peak, `attack`
 * to the first over half of it. A file cut by cutSounds has no silence; a long attack is the pick's own slow rise.
 */
export function soundOnset(samples: Int16Array, rate: number): { silence: number; attack: number } {
  const window = Math.round(rate / 100);
  const levels = windowLevels(samples, window);
  const peak = Math.max(1, ...levels);
  return { silence: soundStart(samples, rate), attack: Math.max(0, levels.findIndex((level) => level > peak * 0.5)) * (window / rate) };
}

// The most silence a packed file may start with (two windows: the cut is made on a 10 ms window, and the encoder smears its edge),
// and the attack past which the check names the pick as slow to rise.
export const SILENCE_MAX_SECONDS = 0.02;
const SLOW_ATTACK_SECONDS = 0.08;

/**
 * Reads every packed sound in `dir` and lists when each is heard (soundOnset), the latest first. Returns the slots that start with more
 * than SILENCE_MAX_SECONDS of silence: the ones heard after the moment they are played, which a new cut (`--from`) fixes.
 */
export function checkSounds(dir: string, log: Log): string[] {
  const names = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith(".m4a")).sort() : [];
  const rows = names.map((file) => {
    const pcm = ffmpeg(["-i", path.join(dir, file), "-ac", "1", "-ar", "8000", "-f", "s16le", "-"]);
    return { slot: file.replace(/\.m4a$/, ""), ...soundOnset(new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2)), 8000) };
  });
  rows.sort((a, b) => b.silence - a.silence || b.attack - a.attack);
  const ms = (seconds: number) => `${Math.round(seconds * 1000)} ms`;
  for (const { slot, silence, attack } of rows) {
    const line = `${slot}: silence ${ms(silence)}, half its peak at ${ms(attack)}`;
    if (silence > SILENCE_MAX_SECONDS) log.warn(`${line}: starts late, cut it again`);
    else if (attack - silence > SLOW_ATTACK_SECONDS) log.notice(`${line}: rises slowly, which is the pick's own sound`);
    else log.info(line);
  }
  const late = rows.filter((row) => row.silence > SILENCE_MAX_SECONDS).map((row) => row.slot);
  log.notice(`${rows.length} sounds read, ${late.length} start with more than ${ms(SILENCE_MAX_SECONDS)} of silence`);
  return late;
}

/** The filter that cuts a source to `start`..`end` (seconds), fades its tail out and levels it to `lufs`. */
export function cutFilter(start: number, end: number, lufs: number): string {
  const length = end - start;
  const fade = Math.min(0.15, length / 3);
  return `atrim=${start.toFixed(3)}:${end.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=out:st=${(length - fade).toFixed(3)}:d=${fade.toFixed(3)},loudnorm=I=${lufs}:TP=-1.5:LRA=11`;
}

/** Cuts, levels and encodes each slot's pick into `cacheDir`, and returns the `sounds` source that pins every file. */
export function cutSounds(from: SoundFolders, cacheDir: string, log: Log): SourceRecord {
  mkdirSync(cacheDir, { recursive: true });
  const files: SourceFile[] = [];
  for (const slot of SOUND_SLOTS) {
    const pick = SOUND_PICKS[slot];
    const source = findSource(from, pick);
    if (!source) throw new Error(pick.game === "hearthstone" ? `${slot}: ${pick.event}.ogg is not in ${from.hearthstone ?? "the Hearthstone folder (--hearthstone)"}` : `${slot}: ${pick.bank}/<n>-${pick.event}.ogg is not in ${from.dd2}`);
    const pcm = ffmpeg(["-i", source, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"]);
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
    const start = soundStart(samples, 8000);
    const end = Math.min(soundEnd(samples, 8000) + TAIL_SECONDS, start + pick.maxSeconds);
    const target = path.join(cacheDir, `${slot}.m4a`);
    ffmpeg(["-y", "-i", source, "-ac", "1", "-ar", "44100", "-af", cutFilter(start, end, pick.lufs), "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", target]);
    const body = readFileSync(target);
    // No URL can fetch it: the file's "url" names the bank and the event it was cut from, or the Hearthstone sound.
    const origin = pick.game === "hearthstone" ? `hearthstone#${pick.event}` : `${pick.bank}.bank#${pick.event}`;
    files.push({ path: `sounds/${slot}.m4a`, url: origin, sha256: sha256(body), bytes: body.length });
    log.debug(`${slot}: ${pick.event}, ${(end - start).toFixed(2)} s, ${Math.round(start * 1000)} ms of silence cut from its start`);
  }
  log.info(`cut ${files.length} sounds into ${cacheDir}`);
  return audioSource(SOUND_SOURCE, SITE, files);
}

/** Copies every pinned sound into `outDir` (packPinned). */
export function packSounds(options: PackPinnedOptions, log: Log): Promise<SoundSlot[]> {
  return packPinned({ source: SOUND_SOURCE, isName: isSoundSlot, noun: "sound" }, options, log);
}

// --optional (pnpm assets all): a failed pack is a warning, so the other packs still run.
if (isDirectRun(import.meta.url)) {
  runPack("pack-sounds", "sounds not packed, so this bundle carries none", async (log) => {
    const sourcesPath = path.join(DATA_DIR, "sources.json");
    // --check reads the packed files and fails on one that starts with silence; it packs nothing.
    if (process.argv.includes("--check")) {
      if (!existsSync(SOUND_PACK_DIR) || !readdirSync(SOUND_PACK_DIR).some((file) => file.endsWith(".m4a"))) throw new Error(`no sound is packed in ${SOUND_PACK_DIR}: run pnpm assets sounds first`);
      const late = checkSounds(SOUND_PACK_DIR, log);
      if (late.length > 0) throw new Error(`${late.length} sounds start late: ${late.join(", ")}`);
      return;
    }
    const from = argument("--from");
    const hearthstone = argument("--hearthstone");
    if (from) {
      const cut = cutSounds({ dd2: path.resolve(from), hearthstone: hearthstone ? path.resolve(hearthstone) : undefined }, SOUND_CACHE_DIR, log);
      // The cut is read back before it is pinned: every file must start at its sound.
      const late = checkSounds(SOUND_CACHE_DIR, log);
      if (late.length > 0) throw new Error(`${late.length} cut sounds still start late: ${late.join(", ")}`);
      writeSource(sourcesPath, cut);
      log.notice(`pinned the sounds in ${sourcesPath}: commit it, then run pnpm data mirror push sounds`);
    }
    await packSounds({ sourcesPath, cacheDir: SOUND_CACHE_DIR, outDir: SOUND_PACK_DIR, mirror: mirrorReader(mirrorFromEnv(), log) }, log);
  });
}
