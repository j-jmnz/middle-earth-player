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
// The tail is kept until the level stays under 1% of the peak, plus this much, then faded out.
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
export function cutSounds(from: SoundFolders, cacheDir: string, log: Log): SourceRecord {
  mkdirSync(cacheDir, { recursive: true });
  const files: SourceFile[] = [];
  for (const slot of SOUND_SLOTS) {
    const pick = SOUND_PICKS[slot];
    const source = findSource(from, pick);
    if (!source) throw new Error(pick.game === "hearthstone" ? `${slot}: ${pick.event}.ogg is not in ${from.hearthstone ?? "the Hearthstone folder (--hearthstone)"}` : `${slot}: ${pick.bank}/<n>-${pick.event}.ogg is not in ${from.dd2}`);
    const pcm = ffmpeg(["-i", source, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"]);
    const end = Math.min(soundEnd(new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2)), 8000) + TAIL_SECONDS, pick.maxSeconds);
    const fade = Math.min(0.15, end / 3);
    const target = path.join(cacheDir, `${slot}.m4a`);
    const filter = `atrim=0:${end.toFixed(3)},afade=t=out:st=${(end - fade).toFixed(3)}:d=${fade.toFixed(3)},loudnorm=I=${pick.lufs}:TP=-1.5:LRA=11`;
    ffmpeg(["-y", "-i", source, "-ac", "1", "-ar", "44100", "-af", filter, "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", target]);
    const body = readFileSync(target);
    // No URL can fetch it: the file's "url" names the bank and the event it was cut from, or the Hearthstone sound.
    const origin = pick.game === "hearthstone" ? `hearthstone#${pick.event}` : `${pick.bank}.bank#${pick.event}`;
    files.push({ path: `sounds/${slot}.m4a`, url: origin, sha256: sha256(body), bytes: body.length });
    log.debug(`${slot}: ${pick.event}, ${end.toFixed(2)} s`);
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
    const from = argument("--from");
    const hearthstone = argument("--hearthstone");
    if (from) {
      writeSource(sourcesPath, cutSounds({ dd2: path.resolve(from), hearthstone: hearthstone ? path.resolve(hearthstone) : undefined }, SOUND_CACHE_DIR, log));
      log.notice(`pinned the sounds in ${sourcesPath}: commit it, then run pnpm data mirror push sounds`);
    }
    await packSounds({ sourcesPath, cacheDir: SOUND_CACHE_DIR, outDir: SOUND_PACK_DIR, mirror: mirrorReader(mirrorFromEnv(), log) }, log);
  });
}
