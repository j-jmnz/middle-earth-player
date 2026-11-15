// `pnpm assets showcase`: turns the README showcase's captures (capture.ts, default .cache/showcase/raw) into the images the README shows
// in --out (default .cache/showcase/out): each still as WebP with the device's rounded corners,
// a contact sheet of them all (contact.png) to look at before they are published, and manifest.json naming each file's
// shot, device, theme and the commit it was taken from. `--publish` then replaces the one commit of the `showcase` branch
// on origin with these files, and refuses while a capture is missing.
//
// A shot stands as orientationOf (shots.ts) says: a capture that comes out the other way (a simulator's framebuffer can keep the device's own
// orientation) is turned a quarter turn, clockwise unless --turn ccw.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";

import { runScript, type Log } from "../log.ts";
import { captureName, orientationOf, SHOTS, turnFor, type Device, type Shot, type Theme } from "./shots.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

/** The long side a still is published at, in pixels, and its corner radius as a share of its short side (the device's own rounding). */
export const STILL: Readonly<Record<Device, { long: number; corner: number }>> = { iphone: { long: 1170, corner: 0.105 }, ipad: { long: 1200, corner: 0.04 } };
function flag(name: string): string | null {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? (process.argv[at + 1] ?? null) : null;
}

// A rounded-rectangle mask of `width` x `height` with corners of `radius` pixels.
function mask(width: number, height: number, radius: number): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`);
}

async function still(source: string, target: string, shot: Shot, device: Device, counter: boolean): Promise<{ width: number; height: number }> {
  const meta = await sharp(source).metadata();
  const turn = turnFor(shot, device, meta.width ?? 0, meta.height ?? 0, counter);
  const turned = await sharp(source).rotate(turn).toBuffer();
  const landscape = orientationOf(shot.id, device) === "landscape";
  const sized = await sharp(turned).resize(landscape ? { width: STILL[device].long } : { height: STILL[device].long }).toBuffer({ resolveWithObject: true });
  const { width, height } = sized.info;
  const radius = Math.round(Math.min(width, height) * STILL[device].corner);
  await sharp(sized.data).composite([{ input: mask(width, height, radius), blend: "dest-in" }]).webp({ quality: 86, alphaQuality: 90 }).toFile(target);
  return { width, height };
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
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
  const taken = existsSync(path.join(raw, "capture.json")) ? (JSON.parse(readFileSync(path.join(raw, "capture.json"), "utf8")) as { simulators?: Record<string, string> }) : {};
  const files: { file: string; shot: string; device: Device; theme: Theme; width: number; height: number; bytes: number }[] = [];
  const tiles: { file: string; label: string }[] = [];
  const missing: string[] = [];
  const present = new Set(readdirSync(raw));
  for (const shot of SHOTS) {
    for (const device of shot.devices) {
      for (const theme of ["dark", "light"] as const) {
        const name = captureName(device, theme, shot.id);
        const source = path.join(raw, `${name}.png`);
        if (!present.has(path.basename(source))) {
          missing.push(name);
          continue;
        }
        const target = path.join(out, `${name}.webp`);
        const size = await still(source, target, shot, device, counter);
        files.push({ file: path.basename(target), shot: shot.id, device, theme, ...size, bytes: statSync(target).size });
        tiles.push({ file: target, label: name });
        log.debug(`${name}: ${Math.round((files.at(-1)?.bytes ?? 0) / 1024)} KB`);
      }
    }
  }
  if (tiles.length > 0) await contactSheet(tiles, path.join(out, "contact.png"));
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  writeFileSync(path.join(out, "manifest.json"), `${JSON.stringify({ commit, simulators: taken.simulators ?? {}, total, files, missing }, null, 2)}\n`);
  if (missing.length > 0) log.warn(`${missing.length} captures missing: ${missing.join(", ")}`);
  log.info(`${files.length} files, ${Math.round(total / 1024)} KB, in ${out}`);
  if (!process.argv.includes("--publish")) return;
  if (missing.length > 0) throw new Error("Not published: every capture must be taken first");
  publish(log, out, commit);
});

// Replaces the `showcase` branch on origin with one orphan commit of the images and the manifest (not the contact sheet), so the images never
// pile up in the history. It pushes with the remote and credentials of this checkout.
function publish(log: Log, out: string, commit: string): void {
  const remote = spawnSync("git", ["remote", "get-url", "origin"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
  if (!remote) throw new Error("No origin remote to publish to");
  const work = path.join(tmpdir(), `showcase-publish-${process.pid}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  for (const name of readdirSync(out)) if (name !== "contact.png") copyFileSync(path.join(out, name), path.join(work, name));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: work, stdio: "pipe" });
  git("init", "-q", "-b", "showcase");
  git("add", "-A");
  git("commit", "-q", "-m", `repo: README showcase captured from ${commit.slice(0, 12)}`);
  git("push", "-q", "--force", remote, "showcase:showcase");
  rmSync(work, { recursive: true, force: true });
  log.info(`published to the showcase branch of ${remote}`);
}
