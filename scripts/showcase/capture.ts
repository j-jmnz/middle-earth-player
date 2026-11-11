// `pnpm assets capture --app <App.app>`: takes the README showcase's captures (docs/plans/readme-showcase.md, Capture flows) on the iOS simulators, on
// macOS with Xcode and Maestro. The app is a Release simulator build with EXPO_PUBLIC_SHOWCASE=1 and EXPO_PUBLIC_E2E_SEED=1 and every picture packed
// (`pnpm assets`), as .github/workflows/showcase.yml builds it. For each device (shots.ts) it boots the newest simulator of that kind, sets a clean
// status bar, installs the app, and runs each of the device's flows in .maestro/showcase/ once per theme, with THEME and DEVICE. What a flow writes
// (a screenshot, a recording) lands in --out (default .cache/showcase/raw) as <device>-<theme>-<shot>.png or .mp4, with capture.json saying which
// captures were taken and which failed. A flow that fails is run once more; the script fails when any capture is still missing.
//
// Flags: --out <dir>, --only <shot,shot>, --device <iphone|ipad>, --theme <dark|light>.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { runScript, verbose, type Log } from "../log.ts";
import { captureName, SHOTS, type Device, type Shot, type Theme } from "./shots.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const FLOWS = path.join(ROOT, ".maestro", "showcase");

// The simulator each device is captured on: the newest one of its kind that Xcode offers (the names move with each Xcode).
const KINDS: Readonly<Record<Device, RegExp>> = { iphone: /^iPhone \d+ Pro$/, ipad: /^iPad Pro 13-inch/ };
const THEMES: readonly Theme[] = ["dark", "light"];

function flag(name: string): string | null {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? (process.argv[at + 1] ?? null) : null;
}

function run(log: Log, command: string, args: readonly string[], cwd: string = ROOT): boolean {
  log.debug(`${command} ${args.join(" ")}`);
  const child = spawnSync(command, args, { cwd, stdio: verbose() ? "inherit" : "pipe", encoding: "utf8" });
  if (child.status === 0) return true;
  if (!verbose()) log.warn(`${command} ${args[0] ?? ""} failed:\n${child.stdout ?? ""}${child.stderr ?? ""}`);
  return false;
}

type SimDevice = { name: string; udid: string; isAvailable: boolean };

function simulator(device: Device): SimDevice {
  const listed = spawnSync("xcrun", ["simctl", "list", "devices", "available", "-j"], { encoding: "utf8" });
  if (listed.status !== 0) throw new Error(`xcrun simctl list failed: ${listed.stderr}`);
  const runtimes = (JSON.parse(listed.stdout) as { devices: Record<string, SimDevice[]> }).devices;
  // The newest iOS runtime first, then the highest model number in it.
  const ios = Object.entries(runtimes).filter(([runtime]) => runtime.includes("iOS")).sort(([left], [right]) => right.localeCompare(left, undefined, { numeric: true }));
  for (const [, devices] of ios) {
    const found = devices.filter((item) => item.isAvailable && KINDS[device].test(item.name)).sort((left, right) => right.name.localeCompare(left.name, undefined, { numeric: true }))[0];
    if (found) return found;
  }
  throw new Error(`No available ${device} simulator matches ${KINDS[device]}`);
}

function prepare(log: Log, sim: SimDevice, app: string): void {
  // `boot` fails on a simulator that is already booted, which is fine; `bootstatus -b` waits until it has.
  run(log, "xcrun", ["simctl", "boot", sim.udid]);
  if (!run(log, "xcrun", ["simctl", "bootstatus", sim.udid, "-b"])) throw new Error(`${sim.name} did not boot`);
  run(log, "xcrun", ["simctl", "status_bar", sim.udid, "override", "--time", "9:41", "--dataNetwork", "wifi", "--wifiMode", "active", "--wifiBars", "3", "--cellularMode", "active", "--cellularBars", "4", "--batteryState", "charged", "--batteryLevel", "100"]);
  if (!run(log, "xcrun", ["simctl", "install", sim.udid, app])) throw new Error(`The app did not install on ${sim.name}`);
}

// Every file under `dir` with one of `extensions`, newest first.
function written(dir: string, extensions: readonly string[]): string[] {
  if (!existsSync(dir)) return [];
  const walk = (at: string): string[] => readdirSync(at).flatMap((name) => {
    const full = path.join(at, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  return walk(dir).filter((file) => extensions.includes(path.extname(file))).sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
}

// Runs one flow and moves what it wrote into `out` under its capture name. Maestro writes a screenshot or a recording into the folder it runs in, or
// into its test output folder, by version; both are searched.
function capture(log: Log, sim: SimDevice, device: Device, theme: Theme, shot: Shot, out: string): boolean {
  const name = captureName(device, theme, shot.id);
  const extension = shot.kind === "gif" ? ".mp4" : ".png";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const work = mkdtempSync(path.join(tmpdir(), "showcase-"));
    const flow = path.join(FLOWS, `${shot.id}.yaml`);
    const ok = run(log, "maestro", ["--device", sim.udid, "test", "--test-output-dir", path.join(work, "output"), "-e", `THEME=${theme}`, "-e", `DEVICE=${device}`, flow], work);
    const file = written(work, [extension]).find((item) => path.basename(item, extension) === name);
    if (ok && file) {
      copyFileSync(file, path.join(out, `${name}${extension}`));
      rmSync(work, { recursive: true, force: true });
      log.info(`${name}${extension}`);
      return true;
    }
    log.warn(`${name}: attempt ${attempt} ${ok ? `wrote no ${extension}` : "failed"}`);
    rmSync(work, { recursive: true, force: true });
  }
  return false;
}

void runScript("showcase-capture", (log) => {
  const app = flag("app");
  if (!app || !existsSync(app)) throw new Error("Usage: pnpm assets capture --app <App.app> [--out <dir>] [--only <shot,shot>] [--device <iphone|ipad>] [--theme <dark|light>]");
  const out = path.resolve(flag("out") ?? path.join(ROOT, ".cache", "showcase", "raw"));
  mkdirSync(out, { recursive: true });
  const only = flag("only")?.split(",") ?? null;
  const devices = (["iphone", "ipad"] as const).filter((device) => (flag("device") ?? device) === device);
  const themes = THEMES.filter((theme) => (flag("theme") ?? theme) === theme);
  const results: { name: string; device: Device; theme: Theme; shot: string; ok: boolean }[] = [];
  const simulators: Record<string, string> = {};
  for (const device of devices) {
    const shots = SHOTS.filter((shot) => shot.devices.includes(device) && (!only || only.includes(shot.id)));
    if (shots.length === 0) continue;
    const sim = simulator(device);
    simulators[device] = sim.name;
    log.step(`prepare ${sim.name}`, () => prepare(log, sim, app));
    for (const theme of themes) {
      for (const shot of shots) results.push({ name: captureName(device, theme, shot.id), device, theme, shot: shot.id, ok: capture(log, sim, device, theme, shot, out) });
    }
    run(log, "xcrun", ["simctl", "shutdown", sim.udid]);
  }
  writeFileSync(path.join(out, "capture.json"), `${JSON.stringify({ simulators, results }, null, 2)}\n`);
  const failed = results.filter((result) => !result.ok).map((result) => result.name);
  if (failed.length > 0) throw new Error(`${failed.length} of ${results.length} captures failed: ${failed.join(", ")}`);
  log.info(`${results.length} captures in ${out}`);
});
