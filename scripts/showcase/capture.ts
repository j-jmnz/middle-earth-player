// `pnpm assets capture`: takes the README showcase's captures (docs/showcase.md, Capture flows) on the iOS simulators, on macOS with Xcode and
// Maestro. The app is a Release simulator build with EXPO_PUBLIC_SHOWCASE=1 and EXPO_PUBLIC_E2E_SEED=1 and every picture packed: `--build` makes it
// (expo prebuild, then xcodebuild into .cache/showcase/build; run `pnpm assets` first), `--app <App.app>` takes one already built. For each device
// (shots.ts) it boots the newest simulator of that kind, sets a clean status bar, installs the app, and runs each of the device's flows in
// .maestro/showcase/ once per theme, with THEME and DEVICE. What a flow writes (a screenshot, a recording) lands in --out (default
// .cache/showcase/raw) as <device>-<theme>-<shot>.png or .mp4, with capture.json saying which captures were taken and which failed. A flow that
// fails is run once more, with Maestro's debug output kept in <out>/failures/; the script fails when any capture is still missing, and stops early
// when its first two captures both fail.
//
// It logs each stage as it starts and ends (the build's steps, the simulators, each capture as [n/total] with its time), and while a long step runs
// (prebuild, xcodebuild, a flow) a line every HEARTBEAT seconds with the step's latest output line, so a run of an hour shows where it is. A step
// that fails prints the end of its output; --verbose streams every tool's whole output instead (user request, 2026-11-11).
//
// A capture whose file is already in --out, taken from the same inputs as now (its `key` in capture.json: the app's JavaScript bundle and asset
// list, the simulator, the flow and the showcase subflows, and the fixture file it opens), is kept and not taken again (user request,
// 2026-11-11); --force takes every capture again.
//
// Flags: --build or --app <App.app>, --out <dir>, --only <shot,shot>, --device <iphone|ipad>, --theme <dark|light>, --ios <version>, --force,
// --verbose. After a failed flow, the ids and words on screen are logged (Maestro's hierarchy), and the hierarchy kept with its debug output.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { duration, runScript, verbose, type Log } from "../log.ts";
import { FIXTURE_REGISTRY } from "../../src/campaign/fixtures/registry.ts";
import { screenWords } from "./screen.ts";
import { captureName, SHOTS, type Device, type Shot, type Theme } from "./shots.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const FLOWS = path.join(ROOT, ".maestro", "showcase");

// The simulator each device is captured on: the newest one of its kind that Xcode offers (the names move with each Xcode).
const KINDS: Readonly<Record<Device, RegExp>> = { iphone: /^iPhone \d+ Pro$/, ipad: /^iPad Pro 13-inch/ };
const THEMES: readonly Theme[] = ["dark", "light"];
const captures = (count: number) => `${count} capture${count === 1 ? "" : "s"}`;
// How often a long step says it is still running (s), and how many of its last output lines a failure prints.
const HEARTBEAT = 30;
const TAIL = 40;

function flag(name: string): string | null {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? (process.argv[at + 1] ?? null) : null;
}

// A short command, its output kept unless it fails.
function run(log: Log, command: string, args: readonly string[], cwd: string = ROOT): boolean {
  log.debug(`${command} ${args.join(" ")}`);
  const child = spawnSync(command, args, { cwd, stdio: verbose() ? "inherit" : "pipe", encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (child.status === 0) return true;
  if (!verbose()) log.warn(`${command} ${args.slice(0, 2).join(" ")} failed:\n${lastLines(`${child.stdout ?? ""}${child.stderr ?? ""}`, TAIL)}`);
  return false;
}

function lastLines(text: string, count: number): string {
  return text.split("\n").map((line) => line.trimEnd()).filter((line) => line !== "").slice(-count).join("\n");
}

// The line a heartbeat shows: the step's latest output line that says something, cut to fit.
function latest(text: string): string {
  const line = text.split("\n").map((item) => item.replace(/\x1b\[[0-9;]*m/g, "").trim()).filter((item) => item !== "").at(-1) ?? "";
  return line.length > 140 ? `${line.slice(0, 137)}...` : line;
}

/**
 * A long step: runs `command`, says every HEARTBEAT seconds that it is still running with its latest output line, and when it ends how long it
 * took. A failure prints the last TAIL lines of its output. With --verbose the output streams as it comes and there is no heartbeat.
 */
function runLong(log: Log, label: string, command: string, args: readonly string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; quiet?: boolean } = {}): Promise<boolean> {
  log.debug(`${command} ${args.join(" ")}`);
  const started = performance.now();
  if (!options.quiet) log.info(`${label}...`);
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd ?? ROOT, env: options.env ?? process.env, stdio: verbose() ? "inherit" : "pipe" });
    let output = "";
    const keep = (chunk: Buffer) => {
      // Only the end is ever read: keep the last 256 KB.
      output = (output + chunk.toString("utf8")).slice(-256 * 1024);
    };
    child.stdout?.on("data", keep);
    child.stderr?.on("data", keep);
    const beat = verbose()
      ? null
      : setInterval(() => {
          const last = latest(output);
          log.info(`${label}: still running, ${duration(performance.now() - started)}${last ? ` (${last})` : ""}`);
        }, HEARTBEAT * 1000);
    child.on("close", (code) => {
      if (beat) clearInterval(beat);
      const took = duration(performance.now() - started);
      if (code === 0) {
        if (!options.quiet) log.info(`${label}: done in ${took}`);
        resolve(true);
        return;
      }
      log.warn(`${label}: failed after ${took} (exit ${code ?? "signal"})${verbose() ? "" : `, its last lines:\n${lastLines(output, TAIL)}`}`);
      resolve(false);
    });
    child.on("error", (error) => {
      if (beat) clearInterval(beat);
      log.warn(`${label}: could not start ${command}: ${error.message}`);
      resolve(false);
    });
  });
}

// The showcase build: the native project generated, then a Release build for the simulator with the showcase's variables, which Metro inlines
// when Xcode bundles the JavaScript. The pictures must already be packed (`pnpm assets` rewrites scan-map.ts with them).
async function buildApp(log: Log): Promise<string> {
  const scanMap = readFileSync(path.join(ROOT, "src", "screens", "images", "scan-map.ts"), "utf8");
  const packed = [...(scanMap.split("export const scanAssets")[1] ?? "").matchAll(/moduleId/g)].length;
  if (packed === 0) throw new Error("No card picture is packed: run pnpm assets first (the first run downloads about 5 GB)");
  log.info(`build 1/3: ${packed} card pictures are packed`);
  const env = { ...process.env, EXPO_PUBLIC_E2E_SEED: "1", EXPO_PUBLIC_SHOWCASE: "1" };
  if (!(await runLong(log, "build 2/3: expo prebuild (the native project in ios/, with its CocoaPods)", "pnpm", ["exec", "expo", "prebuild", "--platform", "ios"], { env }))) throw new Error("expo prebuild failed");
  const workspace = readdirSync(path.join(ROOT, "ios")).find((name) => name.endsWith(".xcworkspace"));
  if (!workspace) throw new Error("expo prebuild wrote no ios/*.xcworkspace");
  const derived = path.join(ROOT, ".cache", "showcase", "build");
  const args = ["-workspace", path.join("ios", workspace), "-scheme", path.basename(workspace, ".xcworkspace"), "-configuration", "Release", "-sdk", "iphonesimulator", "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", derived, "CODE_SIGNING_ALLOWED=NO", "build"];
  if (!(await runLong(log, "build 3/3: xcodebuild Release for the simulator (often 15 to 30 minutes, longest on the first run)", "xcodebuild", args, { env }))) throw new Error("xcodebuild failed: run again with --verbose for its whole output");
  const products = path.join(derived, "Build", "Products", "Release-iphonesimulator");
  const app = readdirSync(products).find((name) => name.endsWith(".app"));
  if (!app) throw new Error(`No .app in ${products}`);
  log.info(`built ${path.join(products, app)}`);
  return path.join(products, app);
}

type SimDevice = { name: string; udid: string; isAvailable: boolean };

function sha(...parts: readonly (string | Buffer)[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\0");
  return hash.digest("hex").slice(0, 16);
}

// What the app draws: its JavaScript bundle and the name and size of every file in it (the packed pictures, the fonts), so a rebuild of the
// same code and pictures has the same fingerprint and a changed picture, screen or rule does not.
function appFingerprint(app: string): string {
  const files: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at).sort()) {
      const full = path.join(at, name);
      const info = statSync(full);
      if (info.isDirectory()) walk(full);
      else if (!/^(_CodeSignature|embedded\.mobileprovision)$/.test(name)) files.push(`${path.relative(app, full)} ${info.size}`);
    }
  };
  walk(app);
  const bundle = path.join(app, "main.jsbundle");
  return sha(existsSync(bundle) ? readFileSync(bundle) : "", files.join("\n"));
}

// The inputs of one capture besides the app and the simulator: its flow, the showcase subflows every flow runs through, and the fixture file it opens.
function flowFingerprint(shot: Shot): string {
  const flow = readFileSync(path.join(FLOWS, `${shot.id}.yaml`), "utf8");
  const subflows = readdirSync(path.join(ROOT, ".maestro", "subflows")).filter((name) => name.startsWith("showcase-")).sort().map((name) => readFileSync(path.join(ROOT, ".maestro", "subflows", name), "utf8"));
  const fixture = /(?:FIXTURE: |e2e\/)([\w-]+)/.exec(flow)?.[1];
  const entry = fixture ? FIXTURE_REGISTRY.find((item) => (item.names as readonly string[]).includes(fixture)) : undefined;
  const saves = entry ? readFileSync(path.join(ROOT, "src", "campaign", "fixtures", `${"file" in entry ? entry.file : entry.scenarioId}.json`), "utf8") : "";
  return sha(flow, ...subflows, saves);
}

type Result = { name: string; device: Device; theme: Theme; shot: string; ok: boolean; key: string; kept?: boolean };

function earlier(out: string): Map<string, Result> {
  const file = path.join(out, "capture.json");
  if (!existsSync(file)) return new Map();
  const read = JSON.parse(readFileSync(file, "utf8")) as { results?: Result[] };
  return new Map((read.results ?? []).filter((result) => result.ok && result.key).map((result) => [result.name, result]));
}

function simulator(device: Device): SimDevice {
  const listed = spawnSync("xcrun", ["simctl", "list", "devices", "available", "-j"], { encoding: "utf8" });
  if (listed.status !== 0) throw new Error(`xcrun simctl list failed: ${listed.stderr}`);
  const runtimes = (JSON.parse(listed.stdout) as { devices: Record<string, SimDevice[]> }).devices;
  // The newest iOS runtime first, then the highest model number in it.
  // --ios <version> keeps the runtimes of that iOS version (18 or 18.2), when the newest one does not suit the tools.
  const version = flag("ios")?.replace(".", "-");
  const ios = Object.entries(runtimes).filter(([runtime]) => runtime.includes("iOS") && (!version || new RegExp(`iOS-${version}(-|$)`).test(runtime))).sort(([left], [right]) => right.localeCompare(left, undefined, { numeric: true }));
  for (const [runtime, devices] of ios) {
    const found = devices.filter((item) => item.isAvailable && KINDS[device].test(item.name)).sort((left, right) => right.name.localeCompare(left.name, undefined, { numeric: true }))[0];
    if (found) return { ...found, name: `${found.name} (${runtime.split(".").at(-1)?.replace(/-/g, " ").replace(/^iOS (\d+) (\d+)/, "iOS $1.$2") ?? runtime})` };
  }
  throw new Error(`No available ${device} simulator matches ${KINDS[device]}${version ? ` on iOS ${flag("ios")}` : ""}: install an iOS runtime in Xcode, Settings, Components (\`xcrun simctl list runtimes\` lists them)`);
}

async function prepare(log: Log, sim: SimDevice, app: string): Promise<void> {
  log.info(`${sim.name}: booting`);
  // `boot` fails on a simulator that is already booted, which is fine; `bootstatus -b` waits until it has.
  spawnSync("xcrun", ["simctl", "boot", sim.udid], { stdio: "ignore" });
  spawnSync("open", ["-a", "Simulator"], { stdio: "ignore" });
  if (!(await runLong(log, `${sim.name}: waiting for it to boot`, "xcrun", ["simctl", "bootstatus", sim.udid, "-b"], { quiet: true }))) throw new Error(`${sim.name} did not boot`);
  log.info(`${sim.name}: status bar set to 9:41, full bars`);
  run(log, "xcrun", ["simctl", "status_bar", sim.udid, "override", "--time", "9:41", "--dataNetwork", "wifi", "--wifiMode", "active", "--wifiBars", "3", "--cellularMode", "active", "--cellularBars", "4", "--batteryState", "charged", "--batteryLevel", "100"]);
  if (!(await runLong(log, `${sim.name}: installing the app`, "xcrun", ["simctl", "install", sim.udid, app]))) throw new Error(`The app did not install on ${sim.name}`);
}

// Every file under `dir` with one of `extensions`, newest first.
function written(dir: string, extensions: readonly string[]): string[] {
  if (!existsSync(dir)) return [];
  const walk = (at: string): string[] =>
    readdirSync(at).flatMap((name) => {
      const full = path.join(at, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  return walk(dir).filter((file) => extensions.includes(path.extname(file))).sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
}

// What is on the simulator's screen after a failed flow, from Maestro's hierarchy: written beside the debug output, and its ids and words
// logged, so the log alone says where the app was (a screen still loading, an error, another screen than the flow expected).
function onScreen(log: Log, sim: SimDevice, label: string, kept: string): void {
  const read = spawnSync("maestro", ["--device", sim.udid, "hierarchy"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const json = read.stdout.slice(read.stdout.indexOf("{"));
  try {
    const words = screenWords(JSON.parse(json));
    mkdirSync(kept, { recursive: true });
    writeFileSync(path.join(kept, "hierarchy.json"), json);
    log.warn(`${label}: on screen after the failure: ${words.length > 0 ? words.slice(0, 40).join(" ") : "nothing Maestro can read (the app may have crashed, or still be on its splash screen)"}`);
  } catch {
    log.warn(`${label}: Maestro could not read the screen after the failure${read.stderr ? `: ${lastLines(read.stderr, 3)}` : ""}`);
  }
}

// Runs one flow and moves what it wrote into `out` under its capture name. Maestro writes a screenshot or a recording into the folder it runs in, or
// into its test output folder, by version; both are searched.
async function capture(log: Log, sim: SimDevice, device: Device, theme: Theme, shot: Shot, out: string, step: string): Promise<boolean> {
  const name = captureName(device, theme, shot.id);
  const extension = shot.kind === "gif" ? ".mp4" : ".png";
  const started = performance.now();
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const work = mkdtempSync(path.join(tmpdir(), "showcase-"));
    const flow = path.join(FLOWS, `${shot.id}.yaml`);
    const label = `${step} ${name}${attempt > 1 ? `, attempt ${attempt}` : ""}`;
    log.info(`${label}: ${shot.kind === "gif" ? "recording" : "taking"} ${shot.caption}`);
    const ok = await runLong(log, label, "maestro", ["--device", sim.udid, "test", "--test-output-dir", path.join(work, "output"), "-e", `THEME=${theme}`, "-e", `DEVICE=${device}`, flow], { cwd: work, quiet: true });
    const file = written(work, [extension]).find((item) => path.basename(item, extension) === name);
    if (ok && file) {
      copyFileSync(file, path.join(out, `${name}${extension}`));
      rmSync(work, { recursive: true, force: true });
      log.info(`${step} ${name}${extension}: taken in ${duration(performance.now() - started)}`);
      return true;
    }
    if (ok) log.warn(`${label}: the flow passed but wrote no ${extension}`);
    // Maestro's debug output (its log, the screen at the failure and its UI hierarchy) is kept, out of the temporary folder.
    const kept = path.join(out, "failures", `${name}-attempt-${attempt}`);
    if (existsSync(path.join(work, "output"))) {
      cpSync(path.join(work, "output"), kept, { recursive: true });
      log.warn(`${label}: Maestro's debug output (screenshot and UI hierarchy) is in ${kept}`);
    }
    if (!ok) onScreen(log, sim, label, kept);
    rmSync(work, { recursive: true, force: true });
  }
  log.warn(`${step} ${name}: failed twice, left out (run it alone with --only ${shot.id} --device ${device} --theme ${theme} --verbose)`);
  return false;
}

void runScript("showcase-capture", async (log) => {
  const given = flag("app");
  const app = process.argv.includes("--build") ? await buildApp(log) : given;
  if (!app || !existsSync(app)) throw new Error("Usage: pnpm assets capture --build | --app <App.app> [--out <dir>] [--only <shot,shot>] [--device <iphone|ipad>] [--theme <dark|light>] [--ios <version>] [--force] [--verbose]");
  const out = path.resolve(flag("out") ?? path.join(ROOT, ".cache", "showcase", "raw"));
  mkdirSync(out, { recursive: true });
  // The debug output of an earlier run's failures would read as this run's.
  rmSync(path.join(out, "failures"), { recursive: true, force: true });
  const only = flag("only")?.split(",") ?? null;
  const devices = (["iphone", "ipad"] as const).filter((device) => (flag("device") ?? device) === device);
  const themes = THEMES.filter((theme) => (flag("theme") ?? theme) === theme);
  const shotsOf = (device: Device) => SHOTS.filter((shot) => shot.devices.includes(device) && (!only || only.includes(shot.id)));
  const total = devices.reduce((sum, device) => sum + shotsOf(device).length * themes.length, 0);
  if (total === 0) throw new Error("No shot matches --only, --device and --theme (scripts/showcase/shots.ts lists the shots)");
  log.info(`${captures(total)} to take: ${devices.join(" and ")}, ${themes.join(" and ")} theme${themes.length > 1 ? "s" : ""}, into ${out}`);
  const results: Result[] = [];
  const simulators: Record<string, string> = {};
  const before = process.argv.includes("--force") ? new Map<string, Result>() : earlier(out);
  const appKey = appFingerprint(app);
  // capture.json is written after every capture, so a run stopped halfway keeps what it took; it also keeps the earlier runs' captures this one did not touch.
  const save = () => {
    const touched = new Set(results.map((result) => result.name));
    const all = [...[...before.values()].filter((result) => !touched.has(result.name)), ...results];
    writeFileSync(path.join(out, "capture.json"), `${JSON.stringify({ simulators: { ...simulators }, results: all }, null, 2)}\n`);
  };
  for (const device of devices) {
    const shots = shotsOf(device);
    if (shots.length === 0) continue;
    const sim = simulator(device);
    simulators[device] = sim.name;
    const keyOf = (theme: Theme, shot: Shot) => sha(appKey, sim.name, theme, flowFingerprint(shot));
    const unchanged = (theme: Theme, shot: Shot) => {
      const name = captureName(device, theme, shot.id);
      return before.get(name)?.key === keyOf(theme, shot) && existsSync(path.join(out, `${name}${shot.kind === "gif" ? ".mp4" : ".png"}`));
    };
    const todo = themes.flatMap((theme) => shots.map((shot) => ({ theme, shot }))).filter(({ theme, shot }) => !unchanged(theme, shot));
    log.info(`${device}: ${captures(shots.length * themes.length)} on ${sim.name}, ${todo.length} to take${todo.length < shots.length * themes.length ? `, ${shots.length * themes.length - todo.length} unchanged since the last run and kept (--force takes them again)` : ""}`);
    for (const theme of themes) {
      for (const shot of shots) {
        if (todo.some((item) => item.theme === theme && item.shot === shot)) continue;
        const name = captureName(device, theme, shot.id);
        log.info(`[${results.length + 1}/${total}] ${name}: unchanged, kept`);
        results.push({ name, device, theme, shot: shot.id, ok: true, key: keyOf(theme, shot), kept: true });
      }
    }
    save();
    if (todo.length === 0) continue;
    await prepare(log, sim, app);
    for (const { theme, shot } of todo) {
      const step = `[${results.length + 1}/${total}]`;
      results.push({ name: captureName(device, theme, shot.id), device, theme, shot: shot.id, ok: await capture(log, sim, device, theme, shot, out, step), key: keyOf(theme, shot) });
      save();
      // Two failures before any capture is taken are almost always one cause (the app, the build, a step every flow shares): stop there
      // rather than fail every capture the same way for an hour.
      const taken = results.filter((result) => !result.kept);
      if (taken.length === 2 && taken.every((result) => !result.ok) && todo.length > 2) {
        run(log, "xcrun", ["simctl", "shutdown", sim.udid]);
        throw new Error(`The first two captures failed, so the run stops: look at ${path.join(out, "failures")}, fix it, then run again`);
      }
    }
    log.info(`${sim.name}: shutting down`);
    run(log, "xcrun", ["simctl", "shutdown", sim.udid]);
  }
  save();
  const failed = results.filter((result) => !result.ok).map((result) => result.name);
  if (failed.length > 0) throw new Error(`${failed.length} of ${results.length} captures failed: ${failed.join(", ")}`);
  const kept = results.filter((result) => result.kept).length;
  log.info(`${captures(results.length)} in ${out} (${results.length - kept} taken, ${kept} kept); next: pnpm assets showcase`);
});
