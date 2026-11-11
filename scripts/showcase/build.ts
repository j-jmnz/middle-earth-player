// `pnpm assets showcase`: turns the README showcase's captures (capture.ts, default .cache/showcase/raw) into the images the README shows
// (docs/plans/readme-showcase.md, Post-process), in --out (default .cache/showcase/out): each still as WebP with the device's rounded corners, each
// recording as a looping GIF, a contact sheet of them all (contact.png) to look at before they are published, and manifest.json naming each file's
// shot, device, theme and the commit it was taken from. Needs ffmpeg for the GIFs.
//
// The table is landscape: a table capture that comes out portrait (the simulator's framebuffer keeps the device's own orientation) is turned a
// quarter turn, clockwise unless --turn ccw.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";

import { runScript, type Log } from "../log.ts";
import { captureName, SHOTS, type Device, type Shot, type Theme } from "./shots.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

/** The width a still is published at, in pixels, and its corner radius as a share of that width. */
export const STILL: Readonly<Record<Device, { width: number; corner: number }>> = { iphone: { width: 540, corner: 0.105 }, ipad: { width: 1200, corner: 0.03 } };
/** The GIF widths tried in turn until the file is under GIF_BUDGET bytes, and its frame rate. */
export const GIF_WIDTHS = [960, 800, 680, 560] as const;
export const GIF_BUDGET = 6 * 1024 * 1024;
const GIF_FPS = 12;

function flag(name: string): string | null {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? (process.argv[at + 1] ?? null) : null;
}

/** The quarter turn a table capture needs to stand landscape: none when it already does. */
export function turnFor(shot: Shot, width: number, height: number, counter: boolean): 0 | 90 | 270 {
  if (!shot.id.startsWith("table-") || width >= height) return 0;
  return counter ? 270 : 90;
}

// A rounded-rectangle mask of `width` x `height` with corners of `radius` pixels.
function mask(width: number, height: number, radius: number): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`);
}

async function still(source: string, target: string, shot: Shot, device: Device, counter: boolean): Promise<{ width: number; height: number }> {
  const meta = await sharp(source).metadata();
  const turn = turnFor(shot, meta.width ?? 0, meta.height ?? 0, counter);
  const turned = await sharp(source).rotate(turn).toBuffer();
  const sized = await sharp(turned).resize({ width: STILL[device].width }).toBuffer({ resolveWithObject: true });
  const { width, height } = sized.info;
  const radius = Math.round(width * STILL[device].corner);
  await sharp(sized.data).composite([{ input: mask(width, height, radius), blend: "dest-in" }]).webp({ quality: 86, alphaQuality: 90 }).toFile(target);
  return { width, height };
}

function probe(source: string): { width: number; height: number } {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", source], { encoding: "utf8" }).trim();
  const [width = 0, height = 0] = out.split("x").map(Number);
  return { width, height };
}

// The recording as a looping GIF at the largest width in GIF_WIDTHS that fits the budget, and its first frame for the contact sheet.
function gif(log: Log, source: string, target: string, first: string, shot: Shot, counter: boolean): { width: number; bytes: number } {
  const size = probe(source);
  const turn = turnFor(shot, size.width, size.height, counter);
  const rotate = turn === 90 ? "transpose=1," : turn === 270 ? "transpose=2," : "";
  for (const width of GIF_WIDTHS) {
    const filter = `${rotate}fps=${GIF_FPS},scale=${width}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
    const made = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", source, "-filter_complex", filter, "-loop", "0", target], { encoding: "utf8" });
    if (made.status !== 0) throw new Error(`ffmpeg failed on ${source}: ${made.stderr}`);
    const bytes = statSync(target).size;
    if (bytes <= GIF_BUDGET || width === GIF_WIDTHS[GIF_WIDTHS.length - 1]) {
      if (bytes > GIF_BUDGET) log.warn(`${path.basename(target)} is ${Math.round(bytes / 1024)} KB, over the budget at its smallest width`);
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", target, "-frames:v", "1", first]);
      return { width, bytes };
    }
  }
  throw new Error("unreachable");
}

// Every capture on one sheet, 360 px tiles in rows of four, labelled by file name.
async function contactSheet(tiles: readonly { file: string; label: string }[], target: string): Promise<void> {
  const tile = 360;
  const label = 28;
  const columns = 4;
  const rows = Math.max(1, Math.ceil(tiles.length / columns));
  const parts = await Promise.all(
    tiles.map(async (item, at) => {
      const image = await sharp(item.file).resize({ width: tile, height: tile, fit: "inside", background: "#00000000" }).png().toBuffer();
      const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${label}"><text x="4" y="20" font-family="sans-serif" font-size="16" fill="#ddd">${item.label}</text></svg>`);
      const left = (at % columns) * tile;
      const top = Math.floor(at / columns) * (tile + label);
      return [
        { input: image, left, top },
        { input: text, left, top: top + tile },
      ];
    }),
  );
  await sharp({ create: { width: columns * tile, height: rows * (tile + label), channels: 4, background: "#202326" } }).composite(parts.flat()).png().toFile(target);
}

void runScript("showcase-build", async (log) => {
  const raw = path.resolve(flag("from") ?? path.join(ROOT, ".cache", "showcase", "raw"));
  const out = path.resolve(flag("out") ?? path.join(ROOT, ".cache", "showcase", "out"));
  const counter = flag("turn") === "ccw";
  if (!existsSync(raw)) throw new Error(`No captures in ${raw}: run pnpm assets capture first`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const frames = path.join(tmpdir(), `showcase-frames-${process.pid}`);
  mkdirSync(frames, { recursive: true });
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
  const taken = existsSync(path.join(raw, "capture.json")) ? (JSON.parse(readFileSync(path.join(raw, "capture.json"), "utf8")) as { simulators?: Record<string, string> }) : {};
  const files: { file: string; shot: string; device: Device; theme: Theme; kind: Shot["kind"]; width: number; height?: number; bytes: number }[] = [];
  const tiles: { file: string; label: string }[] = [];
  const missing: string[] = [];
  const present = new Set(readdirSync(raw));
  for (const shot of SHOTS) {
    for (const device of shot.devices) {
      for (const theme of ["dark", "light"] as const) {
        const name = captureName(device, theme, shot.id);
        const source = path.join(raw, `${name}${shot.kind === "gif" ? ".mp4" : ".png"}`);
        if (!present.has(path.basename(source))) {
          missing.push(name);
          continue;
        }
        if (shot.kind === "still") {
          const target = path.join(out, `${name}.webp`);
          const size = await still(source, target, shot, device, counter);
          files.push({ file: path.basename(target), shot: shot.id, device, theme, kind: "still", ...size, bytes: statSync(target).size });
          tiles.push({ file: target, label: name });
        } else {
          const target = path.join(out, `${name}.gif`);
          const first = path.join(frames, `${name}.png`);
          const made = gif(log, source, target, first, shot, counter);
          files.push({ file: path.basename(target), shot: shot.id, device, theme, kind: "gif", width: made.width, bytes: made.bytes });
          tiles.push({ file: first, label: `${name} (GIF)` });
        }
        log.debug(`${name}: ${Math.round((files.at(-1)?.bytes ?? 0) / 1024)} KB`);
      }
    }
  }
  if (tiles.length > 0) await contactSheet(tiles, path.join(out, "contact.png"));
  rmSync(frames, { recursive: true, force: true });
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  writeFileSync(path.join(out, "manifest.json"), `${JSON.stringify({ commit, simulators: taken.simulators ?? {}, total, files, missing }, null, 2)}\n`);
  if (missing.length > 0) log.warn(`${missing.length} captures missing: ${missing.join(", ")}`);
  log.info(`${files.length} files, ${Math.round(total / 1024)} KB, in ${out}`);
});
