import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isMusicLoop, MUSIC_LOOPS, type MusicLoop } from "../../src/ui/sound/music-map.ts";
import { MUSIC_LEAD_SECONDS } from "../../src/ui/sound/music-lead.ts";
import { mirrorFromEnv, mirrorReader } from "../data/mirror/client.ts";
import { DATA_DIR, MUSIC_CACHE_DIR, MUSIC_PACK_DIR } from "../data/paths.ts";
import { sha256, type SourceFile, type SourceRecord } from "../data/sources/fetch.ts";
import { isDirectRun, runPack, type Log } from "../log.ts";
import { MUSIC_PICKS, type MusicPick } from "./music-picks.ts";
import { framesOf, longerLoop, onBeat, SEAM_RATE, WEAK_SEAM } from "./music-seam.ts";
import { argument, audioSource, ffmpeg, packPinned, writeSource, type PackPinnedOptions } from "./pack-audio.ts";

// The music loops (docs/design-system-table.md, Sound) are not in git and come from no online source: they are cut from the player's own
// copy of the film trilogy's score, and every release's phone builds carry them (user decision, 2026-11-21). `pnpm assets music --from
// <folder>` cuts each loop's pick (music-picks.ts) from the folder of tracks into .cache/audio/music and pins each file by sha256 as the
// `music` source of data/sources.json; `pnpm data mirror push music` puts them in the asset mirror. `pnpm assets music` copies each
// pinned file into assets/music (pack-audio.ts, packPinned), where the phone's require.context finds them (src/ui/sound/bundled.native.ts).
// Each file holds MUSIC_LEAD_SECONDS of the music before the loop's start, then the loop: the player crossfades one copy's last
// MUSIC_LEAD_SECONDS into the next copy's lead, so the repeat has no seam (src/ui/sound/music.ts).
// `--longer <factor>` with `--from` first looks in each track for a loop that many times as long around its pick (music-seam.ts),
// writes the new starts and ends into music-picks.ts, and cuts those: each new seam is then listened to before the picks are committed.

export const MUSIC_SOURCE = "music";
const SITE = "The Lord of the Rings film trilogy's score (the player's own copy, cut by pnpm assets music --from)";
const EXTENSIONS = [".opus", ".flac", ".mp3", ".m4a", ".ogg", ".wav"];
// The music sits under the loudest sound effects (-17 LUFS), so a strike or a sting stays clear over it.
export const MUSIC_LUFS = -20;

/** The pick's track in the folder or any folder under it (an album a folder): `<file>` with any audio extension. */
export function findTrack(from: string, pick: MusicPick): string | undefined {
  const names = existsSync(from) ? (readdirSync(from, { recursive: true }) as string[]) : [];
  const name = names.find((candidate) => EXTENSIONS.some((extension) => path.basename(candidate) === `${pick.file}${extension}`));
  return name ? path.join(from, name) : undefined;
}

/** The part of the track a loop's file holds, in seconds: the lead before the loop's start, then the loop. */
export function loopWindow(pick: MusicPick): { from: number; to: number } {
  if (pick.start < MUSIC_LEAD_SECONDS) throw new Error(`${pick.file}: a loop must start at least ${MUSIC_LEAD_SECONDS} s into its track`);
  if (pick.end <= pick.start + MUSIC_LEAD_SECONDS * 4) throw new Error(`${pick.file}: the loop is too short`);
  return { from: pick.start - MUSIC_LEAD_SECONDS, to: pick.end };
}

const seconds = (value: number) => `${value.toFixed(1)} s`;

/**
 * A pick `factor` times as long for each loop, where its track holds one (music-seam.ts): the passage around the old pick that
 * repeats best, its end set on the beat. A loop whose track has no room keeps its pick. Each line of the report names what to
 * listen to: a weak seam, a level far from the old loop's (another mood), a track too short for the whole length.
 */
export function longerPicks(from: string, picks: Record<MusicLoop, MusicPick>, factor: number, log: Log): Record<MusicLoop, MusicPick> {
  const next = { ...picks };
  for (const loop of MUSIC_LOOPS) {
    const pick = picks[loop];
    const track = findTrack(from, pick);
    if (!track) throw new Error(`${loop}: ${pick.file} is not in ${from}`);
    const pcm = ffmpeg(["-i", track, "-ac", "1", "-ar", String(SEAM_RATE), "-f", "s16le", "-"]);
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
    const found = longerLoop(framesOf(samples), samples.length / SEAM_RATE, pick, factor);
    if (!found) {
      log.warn(`${loop}: ${pick.file} has no room for a longer loop; kept at ${seconds(pick.end - pick.start)}`);
      continue;
    }
    const start = Math.round(found.start * 100) / 100;
    const end = Math.round(onBeat(samples, found.start, found.end) * 100) / 100;
    next[loop] = { file: pick.file, start, end };
    const notes = [found.seam > WEAK_SEAM ? "weak seam" : "", Math.abs(found.level) > 4 ? "another level" : "", found.short ? "the track is too short for the whole length" : ""].filter(Boolean);
    const line = `${loop}: ${seconds(pick.end - pick.start)} to ${seconds(end - start)} (${start} to ${end} of ${pick.file}), seam ${found.seam.toFixed(2)}, level ${found.level >= 0 ? "+" : ""}${found.level.toFixed(1)} dB`;
    if (notes.length > 0) log.warn(`${line}: ${notes.join(", ")}`);
    else log.notice(line);
  }
  return next;
}

/** music-picks.ts with each loop's start and end replaced by `picks`'. */
export function withPicks(source: string, picks: Record<MusicLoop, MusicPick>): string {
  let text = source;
  for (const loop of MUSIC_LOOPS) {
    const line = new RegExp(`(\\n  ${loop}: \\{ file: [^\\n]*?, start: )[0-9.]+(, end: )[0-9.]+`);
    if (!line.test(text)) throw new Error(`${loop}: no pick line in music-picks.ts`);
    text = text.replace(line, (_, head: string, mid: string) => `${head}${picks[loop].start}${mid}${picks[loop].end}`);
  }
  return text;
}

/** Cuts, levels and encodes each loop's pick into `cacheDir`, and returns the `music` source that pins every file. */
export function cutMusic(from: string, cacheDir: string, log: Log, picks: Record<MusicLoop, MusicPick> = MUSIC_PICKS): SourceRecord {
  mkdirSync(cacheDir, { recursive: true });
  const files: SourceFile[] = [];
  for (const loop of MUSIC_LOOPS) {
    const pick = picks[loop];
    const track = findTrack(from, pick);
    if (!track) throw new Error(`${loop}: ${pick.file} is not in ${from}`);
    const { from: start, to: end } = loopWindow(pick);
    const target = path.join(cacheDir, `${loop}.m4a`);
    // Seeking after the input decodes up to the start, so the cut lands on the sample the loop search found.
    ffmpeg(["-y", "-i", track, "-ss", start.toFixed(3), "-to", end.toFixed(3), "-ac", "2", "-ar", "44100", "-af", `loudnorm=I=${MUSIC_LUFS}:TP=-1.5:LRA=11`, "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", target]);
    const body = readFileSync(target);
    files.push({ path: `${MUSIC_SOURCE}/${loop}.m4a`, url: `${pick.file}#t=${pick.start},${pick.end}`, sha256: sha256(body), bytes: body.length });
    log.debug(`${loop}: ${pick.file}, ${(end - start).toFixed(1)} s`);
  }
  log.info(`cut ${files.length} loops into ${cacheDir}`);
  return audioSource(MUSIC_SOURCE, SITE, files);
}

/** Copies every pinned loop into `outDir` (packPinned). */
export function packMusic(options: PackPinnedOptions, log: Log): Promise<MusicLoop[]> {
  return packPinned({ source: MUSIC_SOURCE, isName: isMusicLoop, noun: "music loop" }, options, log);
}

// --optional (pnpm assets all): a failed pack is a warning, so the other packs still run.
if (isDirectRun(import.meta.url)) {
  runPack("pack-music", "music not packed, so this bundle carries none", async (log) => {
    const sourcesPath = path.join(DATA_DIR, "sources.json");
    const from = argument("--from");
    const longer = argument("--longer");
    if (longer && !from) throw new Error("--longer needs --from <folder of the score's tracks>");
    if (from) {
      let picks = MUSIC_PICKS;
      if (longer) {
        const factor = Number(longer);
        if (!(factor > 1 && factor <= 4)) throw new Error("--longer takes a factor over 1 and at most 4, such as 2");
        picks = longerPicks(path.resolve(from), MUSIC_PICKS, factor, log);
        const picksPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "music-picks.ts");
        writeFileSync(picksPath, withPicks(readFileSync(picksPath, "utf8"), picks));
        log.notice(`wrote the longer loops into ${picksPath}: listen to each seam before you commit it`);
      }
      writeSource(sourcesPath, cutMusic(path.resolve(from), MUSIC_CACHE_DIR, log, picks));
      log.notice(`pinned the music in ${sourcesPath}: commit it, then run pnpm data mirror push music`);
    }
    await packMusic({ sourcesPath, cacheDir: MUSIC_CACHE_DIR, outDir: MUSIC_PACK_DIR, mirror: mirrorReader(mirrorFromEnv(), log) }, log);
  });
}
