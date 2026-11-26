// The web app's drawing scale and frame meter (docs/plans/pwa-iphone-ipad.md, Risks only a device can answer): test controls a player turns on from the address,
// so a device says what a headless browser cannot. `?scale=1` (or 1.5) makes the table's canvases draw at that many pixels for each CSS pixel in place of the device's
// (an iPad's 2 is four times the pixels of 1), `?fps=1` shows the frame rate, a log of the last minute (a tap on the meter stops it and copies the log) and the first error the page reports, with where it was thrown, and sends the log to the site (`/_meter`, webapp/meter.ts) when the site keeps one; `?scale=0` and `?fps=0` turn each off, and `?pics=0` leaves out every picture element of the screens (`?pics=1` brings them back), so a run says what the pictures cost; the log's head counts the loaded ones and their megapixels. All are kept in localStorage, since they are read
// before any database opens. Skia's web views read window.devicePixelRatio when they are made, so the scale is set before CanvasKit loads (skia-web-load.ts).
import { described, onSpan, type SpanName } from "./meter-span.ts";

const SCALE_KEY = "middle-earth-player.render-scale";
const FPS_KEY = "middle-earth-player.frame-meter";
const PICS_KEY = "middle-earth-player.no-pictures";

/**
 * The scale to draw at: the address's `scale` when it has one, else the stored one; null for the device's own. A scale under 1, at or over the device's,
 * or not a number, is the device's own.
 */
export function chosenScale(search: string, stored: string | null, device: number): number | null {
  const asked = new URLSearchParams(search).get("scale");
  const value = Number(asked ?? stored);
  return Number.isFinite(value) && value >= 1 && value < device ? value : null;
}

/** Whether the frame meter shows: the address's `fps` when it has one (`0` is off), else the stored choice. */
export function meterChosen(search: string, stored: string | null): boolean {
  const asked = new URLSearchParams(search).get("fps");
  return (asked ?? stored ?? "0") !== "0";
}

/** Whether the screens' pictures are left out: the address's `pics` when it has one (`0` leaves them out), else the stored choice. */
export function picturesHidden(search: string, stored: string | null): boolean {
  const asked = new URLSearchParams(search).get("pics");
  return asked === null ? stored === "1" : asked === "0";
}

/** The pictures the page holds, for the log's head: how many image elements have loaded, and the megapixels the browser decodes to draw them all. */
export function picturesLine(images: Iterable<{ naturalWidth: number; naturalHeight: number }>): string {
  let count = 0;
  let pixels = 0;
  for (const image of images) {
    if (image.naturalWidth === 0) continue;
    count += 1;
    pixels += image.naturalWidth * image.naturalHeight;
  }
  return `pics ${count} ${Math.round(pixels / 1e6)} MP`;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage is blocked: the choice lasts for this page only.
  }
}

/** The worst and the mean gap between frames, in milliseconds, as the meter's line. */
export function meterLine(gaps: readonly number[], scale: number): string {
  if (gaps.length === 0) return `-- fps  x${scale}`;
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  return `${Math.round((1000 * gaps.length) / total)} fps  worst ${Math.round(Math.max(...gaps))} ms  x${scale}`;
}

/** An error as the meter's second line: its name and message, then the first frames of its stack, so a photo of the screen says where it was thrown. */
export function errorLine(error: unknown): string {
  if (!(error instanceof Error)) return String(error).slice(0, 300);
  const frames = (error.stack ?? "")
    .split("\n")
    .map((frame) => frame.trim().replace(/https?:\/\/[^/]+\/(?:[^/\s]+\/)*/g, ""))
    .filter((frame) => frame !== "" && !frame.includes(error.message))
    .slice(0, 5);
  return [`${error.name}: ${error.message}`, ...frames].join("\n").slice(0, 700);
}

// The first error the page reports while the meter shows: React logs an error a boundary caught through console.error, and the window hears the rest.
function watchErrors(show: (text: string) => void): void {
  let seen = false;
  const report = (error: unknown) => {
    if (seen || !(error instanceof Error)) return;
    seen = true;
    show(errorLine(error));
  };
  const logged = console.error;
  console.error = (...args: unknown[]) => {
    report(args.find((arg) => arg instanceof Error));
    logged(...args);
  };
  window.addEventListener("error", (event) => report(event.error));
  window.addEventListener("unhandledrejection", (event) => report(event.reason));
}

/**
 * What the page did in a second beside drawing frames, by name: the milliseconds it took and how many times it ran. `raf` is the animation frame callbacks (the
 * animations and the canvases' drawing), `draw` Skia's recording of the canvases' scenes (watchDraws), `db` the page's waits on the database worker, `save` the
 * copies of the saves to storage, `audio` the audio players' blessing and making, `tap` the taps (their count; no time), `img` the pictures the browser decoded
 * (the time each took off the page), `tex` the whole pictures handed to the graphics chip and `texpx` their size in thousands of pixels (in place of a time), `sub`
 * the parts of a picture handed over (the letters' atlas), and `shader` the drawing programs it compiled and linked; `ctx` counts the WebGL contexts made, since each canvas has
 * its own and compiles its programs again (watchGraphics). `busy` is how long the page's
 * own thread was held, whatever held it: the sum of the waits over 20 ms between one message and the next of a channel that answers itself (watchBusy). A second
 * with a low frame rate and no `busy` was slowed by the browser or the graphics chip, not by the page's script.
 */
export type Work = Readonly<Record<string, readonly [ms: number, count: number]>>;

/** The order the log prints the page's own spans in; the early script's tasks follow them by name (scripts/webapp/site.ts, EARLY_SCRIPT). */
export const SPAN_ORDER: readonly SpanName[] = ["busy", "raf", "draw", "db", "save", "audio", "tap", "img", "tex", "texpx", "sub", "shader", "ctx"];

/**
 * One second of the meter: its frame rate, its longest frame, how many of its frames took over two frames' time, how long its frames ran late in all (`late`: what
 * each took beyond a sixtieth of a second), and its work. A second whose `late` is far over its `raf` lost its time outside the drawing callbacks.
 */
export type Second = { fps: number; worst: number; slow: number; late: number; work: Work };

// A frame over this is one the eye sees as a stutter at 60 frames a second.
const SLOW_MS = 34;
// A frame at 60 frames a second.
const FRAME_MS = 1000 / 60;
// How many seconds the log keeps.
export const LOG_SECONDS = 60;

// The names of some work in the log's order: the page's spans first, then the rest by name.
function namesOf(work: Work): string[] {
  const known: readonly string[] = SPAN_ORDER;
  return [...known.filter((name) => work[name]), ...Object.keys(work).filter((name) => !known.includes(name)).sort()];
}

/** A second's frames and work as its log entry. */
export function secondOf(gaps: readonly number[], work: Work = {}): Second {
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  const rounded: Record<string, readonly [number, number]> = {};
  for (const name of namesOf(work)) {
    const done = work[name];
    if (done) rounded[name] = [Math.round(done[0]), done[1]];
  }
  return {
    fps: total > 0 ? Math.round((1000 * gaps.length) / total) : 0,
    worst: Math.round(Math.max(0, ...gaps)),
    slow: gaps.filter((gap) => gap > SLOW_MS).length,
    late: Math.round(gaps.reduce((sum, gap) => sum + Math.max(0, gap - FRAME_MS), 0)),
    work: rounded,
  };
}

/** The log in one line: the slowest second, the mean, the longest frame and the slow frames of the seconds kept. */
export function summaryLine(log: readonly Second[]): string {
  if (log.length === 0) return "no log yet";
  const mean = Math.round(log.reduce((sum, second) => sum + second.fps, 0) / log.length);
  const slow = log.reduce((sum, second) => sum + second.slow, 0);
  return `last ${log.length} s: lowest ${Math.min(...log.map((second) => second.fps))} fps  mean ${mean}  worst ${Math.max(...log.map((second) => second.worst))} ms  slow frames ${slow}`;
}

/** A second as its line of the log: its frames, then each kind of work it had as `name ms/count`. */
export function secondLine(second: Second): string {
  const work = namesOf(second.work).flatMap((name) => {
    const done = second.work[name];
    return done ? [`${name} ${done[0]}/${done[1]}`] : [];
  });
  return [`${second.fps} fps  worst ${second.worst} ms  late ${second.late}`, ...work].join("  ");
}

/** The log as text to send: the summary, then each second, oldest first. */
export function logText(log: readonly Second[], scale: number): string {
  return [`x${scale}  ${summaryLine(log)}`, ...log.map((second, index) => `${String(index + 1).padStart(2)}  ${secondLine(second)}`)].join("\n");
}

// What the page did since the meter last read it.
let work: Record<string, [number, number]> = {};
// The size of the last copy of the saves to storage, for the meter's first line.
let savedBytes = 0;

// What the early script timed since the meter last read it (scripts/webapp/site.ts, EARLY_SCRIPT), added to this second's work and cleared.
function takeEarly(): void {
  const early = (window as { __early?: { work: Record<string, [number, number]> } }).__early;
  if (!early) return;
  for (const [name, done] of Object.entries(early.work)) {
    const mine = (work[name] ??= [0, 0]);
    mine[0] += done[0];
    mine[1] += done[1];
  }
  early.work = {};
}

function note(name: SpanName, ms: number): void {
  const done = (work[name] ??= [0, 0]);
  done[0] += ms;
  done[1] += 1;
}

type Recorder = { finishRecordingAsPicture: (...args: unknown[]) => unknown };

/**
 * Times each scene Skia records for a canvas: from the picture recorder it makes to the picture that recorder finishes (the two ends of Skia's own draw of a
 * canvas's tree, which walks every drawing command into CanvasKit). `skia` is the Skia API object. Does nothing unless the meter shows.
 */
export function watchDraws(skia: { PictureRecorder: () => unknown }): void {
  if (!metering) return;
  const make = skia.PictureRecorder.bind(skia);
  skia.PictureRecorder = () => {
    const started = performance.now();
    const recorder = make() as Recorder;
    const finish = recorder.finishRecordingAsPicture.bind(recorder);
    recorder.finishRecordingAsPicture = (...args) => {
      const picture = finish(...args);
      note("draw", performance.now() - started);
      return picture;
    };
    return recorder;
  };
}

// Every caller asks the window for a frame at call time, so wrapping it here times the callbacks all.
function watchFrames(): void {
  const frame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    frame((now) => {
      const started = performance.now();
      try {
        callback(now);
      } finally {
        note("raf", performance.now() - started);
      }
    });
}

// A method of a prototype, timed under `name` from here on. The call's own time is what the page waits for; the graphics chip's work after it is not in it.
function timeMethod(owner: object | undefined, method: string, name: SpanName): void {
  const original = (owner as Record<string, unknown> | undefined)?.[method];
  if (!owner || typeof original !== "function") return;
  (owner as Record<string, unknown>)[method] = function timedMethod(this: unknown, ...args: unknown[]) {
    const started = performance.now();
    try {
      return (original as (...rest: unknown[]) => unknown).apply(this, args);
    } finally {
      note(name, performance.now() - started);
    }
  };
}

// The size of each whole picture handed to the graphics chip, in thousands of pixels: the call's width and height when it names them, else its source's.
function sizeUploads(owner: object | undefined): void {
  const original = (owner as Record<string, unknown> | undefined)?.["texImage2D"];
  if (!owner || typeof original !== "function") return;
  (owner as Record<string, unknown>)["texImage2D"] = function sized(this: unknown, ...args: unknown[]) {
    const source = args[args.length - 1] as { width?: number; height?: number; videoWidth?: number } | null;
    const named = args.length >= 9 && typeof args[3] === "number" && typeof args[4] === "number";
    const pixels = named ? (args[3] as number) * (args[4] as number) : (source?.width ?? 0) * (source?.height ?? 0);
    note("texpx", pixels / 1000);
    return (original as (...rest: unknown[]) => unknown).apply(this, args);
  };
}

// How long the page's thread was held: a message channel answers itself, and a wait over BUSY_MS between two answers is time something held the thread.
const BUSY_MS = 20;
const BUSY_EVERY_MS = 5;

function watchBusy(): void {
  const channel = new MessageChannel();
  let last = performance.now();
  channel.port1.onmessage = () => {
    const now = performance.now();
    if (now - last > BUSY_MS) note("busy", now - last);
    last = now;
    // An answer every few milliseconds is enough, and leaves the thread to the page.
    setTimeout(() => channel.port2.postMessage(0), BUSY_EVERY_MS);
  };
  channel.port2.postMessage(0);
}

// The graphics side of a slow second: each picture the browser decodes for the table (createImageBitmap, timed to its answer), each picture handed to the
// graphics chip (texImage2D, texSubImage2D) and each drawing program compiled or linked, on either WebGL context.
function watchGraphics(): void {
  const decode = window.createImageBitmap?.bind(window) as ((...args: unknown[]) => Promise<ImageBitmap>) | undefined;
  if (decode) {
    (window as { createImageBitmap: unknown }).createImageBitmap = (...args: unknown[]) => {
      const started = performance.now();
      const decoded = decode(...args);
      void decoded.then(
        () => note("img", performance.now() - started),
        () => undefined,
      );
      return decoded;
    };
  }
  const contexts = window as { WebGL2RenderingContext?: { prototype: object }; WebGLRenderingContext?: { prototype: object } };
  for (const context of [contexts.WebGL2RenderingContext?.prototype, contexts.WebGLRenderingContext?.prototype]) {
    timeMethod(context, "texImage2D", "tex");
    sizeUploads(context);
    timeMethod(context, "texSubImage2D", "sub");
    timeMethod(context, "compileShader", "shader");
    timeMethod(context, "linkProgram", "shader");
  }
  window.addEventListener("pointerup", () => note("tap", 0), true);
  // A new WebGL context: every canvas makes one, and a context starts with no program compiled.
  const canvas = window.HTMLCanvasElement?.prototype as { getContext?: (...args: unknown[]) => unknown } | undefined;
  const getContext = canvas?.getContext;
  if (canvas && getContext) {
    const made = new WeakSet<object>();
    canvas.getContext = function counted(this: object, ...args: unknown[]) {
      if (String(args[0]).startsWith("webgl") && !made.has(this)) {
        made.add(this);
        note("ctx", 0);
      }
      return getContext.apply(this, args);
    };
  }
}

// How often the log goes to the site, and the most seconds one sending holds.
const SEND_EVERY_S = 10;

// Sends the seconds logged since the last sending to the site's `/_meter`, which keeps them only where the site was deployed with a store for them (the test
// site; webapp/meter.ts). A site with none refuses the post, and the meter stops sending.
function sender(): (log: readonly Second[], fault: string) => void {
  const session = Math.random().toString(36).slice(2, 8);
  let sending = true;
  let part = 0;
  return (log, fault) => {
    if (!sending || log.length === 0) return;
    part += 1;
    const build = (window as { __early?: { build?: string } }).__early?.build ?? "no early script";
    const head = `session ${session} part ${part}  ${new Date().toISOString()}  ${window.location.pathname}  ${window.innerWidth}x${window.innerHeight}  saves ${(savedBytes / 1048576).toFixed(1)} MB  ${picturesLine(document.images)}\n${navigator.userAgent}\nbuild ${build}`;
    const body = [head, logText(log, window.devicePixelRatio), fault].filter((text) => text !== "").join("\n");
    void fetch("/_meter", { method: "POST", body, headers: { "content-type": "text/plain" }, keepalive: true }).then(
      (response) => {
        if (!response.ok) sending = false;
      },
      () => undefined,
    );
  };
}

function startMeter(): void {
  watchFrames();
  watchGraphics();
  watchBusy();
  onSpan((name, ms, bytes) => {
    note(name, ms);
    if (name === "save" && bytes !== undefined) savedBytes = bytes;
  });
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  box.style.cssText =
    "position:fixed;left:4px;bottom:4px;z-index:2147483647;max-width:90vw;max-height:80vh;overflow:auto;padding:2px 6px;border-radius:4px;background:#000c;color:#fff;font:12px/16px monospace;pointer-events:none;white-space:pre-wrap";
  const rate = document.createElement("div");
  const summary = document.createElement("div");
  const fault = document.createElement("div");
  fault.style.color = "#ffb4a8";
  box.append(rate, summary, fault);
  // Beside the body, not in it: an open sheet makes the body's other children inert (modal-layers.ts), and the meter must still take its tap.
  document.documentElement.appendChild(box);
  watchErrors((text) => {
    fault.textContent = text;
  });
  // A tap stops the meter where it stands, so its numbers can be read or photographed, and copies the log; a second tap clears the log and goes on.
  box.style.pointerEvents = "auto";
  box.style.cursor = "pointer";
  const send = sender();
  let gaps: number[] = [];
  let log: Second[] = [];
  let unsent: Second[] = [];
  let paused = false;
  let last = performance.now();
  let shown = last;
  box.addEventListener("click", (event) => {
    event.stopPropagation();
    paused = !paused;
    if (paused) {
      const text = `saves ${(savedBytes / 1048576).toFixed(1)} MB\n${logText(log, window.devicePixelRatio)}`;
      rate.textContent = "STOPPED. Tap to clear and go on.";
      summary.textContent = text;
      void navigator.clipboard?.writeText(text).catch(() => undefined);
    } else {
      log = [];
      gaps = [];
      last = performance.now();
      shown = last;
      summary.textContent = summaryLine(log);
    }
  });
  const frame = (now: number) => {
    if (!paused) {
      gaps.push(now - last);
      if (now - shown >= 1000) {
        takeEarly();
        const second = secondOf(gaps, work);
        work = {};
        log = [...log, second].slice(-LOG_SECONDS);
        unsent = [...unsent, second];
        if (unsent.length >= SEND_EVERY_S) {
          // With the state of what describes itself now (the music's pieces), so a slow second can be set beside it.
          send(unsent, [...described(), fault.textContent ?? ""].filter((text) => text !== "").join("\n"));
          unsent = [];
        }
        rate.textContent = `${meterLine(gaps, window.devicePixelRatio)}  saves ${(savedBytes / 1048576).toFixed(1)} MB  (tap to stop)`;
        summary.textContent = summaryLine(log);
        gaps = [];
        shown = now;
      }
    }
    last = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // Leaving the page sends what is left.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    send(unsent, fault.textContent ?? "");
    unsent = [];
  });
}

let applied = false;
// Whether the meter shows, once the controls are applied.
let metering = false;

/** Reads the controls from the address and storage and applies them, once. Only the web app's build calls it. */
export function applyRenderControls(): void {
  if (applied || typeof window === "undefined") return;
  applied = true;
  const search = window.location.search;
  const params = new URLSearchParams(search);
  const scale = chosenScale(search, read(SCALE_KEY), window.devicePixelRatio);
  if (params.has("scale")) write(SCALE_KEY, scale === null ? null : String(scale));
  if (scale !== null) Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => scale });
  const meter = meterChosen(search, read(FPS_KEY));
  if (params.has("fps")) write(FPS_KEY, meter ? "1" : null);
  metering = meter;
  if (meter) startMeter();
  // No picture element is drawn or decoded (the table's canvases load theirs another way): a device run with and without them says what the pictures cost.
  const noPictures = picturesHidden(search, read(PICS_KEY));
  if (params.has("pics")) write(PICS_KEY, noPictures ? "1" : null);
  if (noPictures) document.head.appendChild(document.createElement("style")).textContent = "img{display:none!important}";
}
