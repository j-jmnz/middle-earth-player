// The web app's drawing scale and frame meter (docs/plans/pwa-iphone-ipad.md, Risks only a device can answer): two test controls a player turns on from the address,
// so a device says what a headless browser cannot. `?scale=1` (or 1.5) makes the table's canvases draw at that many pixels for each CSS pixel in place of the device's
// (an iPad's 2 is four times the pixels of 1), `?fps=1` shows the frame rate, a log of the last minute (a tap on the meter stops it and copies the log) and the first error the page reports, with where it was thrown; `?scale=0` and `?fps=0` turn each off. Both are kept in localStorage, since they are read
// before any database opens. Skia's web views read window.devicePixelRatio when they are made, so the scale is set before CanvasKit loads (skia-web-load.ts).
const SCALE_KEY = "middle-earth-player.render-scale";
const FPS_KEY = "middle-earth-player.frame-meter";

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
 * One second of the meter: its frame rate, its longest frame, how many of its frames took over two frames' time, how long its frames ran late in all (`late`: what
 * each took beyond a sixtieth of a second), and how long the animation frame callbacks ran (`raf`: the animations and the canvases' drawing). A second whose `late`
 * is far over its `raf` lost its time outside the drawing: React's work, the engine, a save, or the browser's own layout, painting and graphics. `draw` is how
 * long Skia took to record the canvases' scenes again, and `draws` how many times it did (watchDraws).
 */
export type Second = { fps: number; worst: number; slow: number; late: number; raf: number; draw: number; draws: number };

// A frame over this is one the eye sees as a stutter at 60 frames a second.
const SLOW_MS = 34;
// A frame at 60 frames a second.
const FRAME_MS = 1000 / 60;
// How many seconds the log keeps.
export const LOG_SECONDS = 60;

/** A second's frames as its log entry. */
export function secondOf(gaps: readonly number[], raf: number = 0, draw: number = 0, draws: number = 0): Second {
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  return {
    fps: total > 0 ? Math.round((1000 * gaps.length) / total) : 0,
    worst: Math.round(Math.max(0, ...gaps)),
    slow: gaps.filter((gap) => gap > SLOW_MS).length,
    late: Math.round(gaps.reduce((sum, gap) => sum + Math.max(0, gap - FRAME_MS), 0)),
    raf: Math.round(raf),
    draw: Math.round(draw),
    draws,
  };
}

/** The log in one line: the slowest second, the mean, the longest frame and the slow frames of the seconds kept. */
export function summaryLine(log: readonly Second[]): string {
  if (log.length === 0) return "no log yet";
  const mean = Math.round(log.reduce((sum, second) => sum + second.fps, 0) / log.length);
  const slow = log.reduce((sum, second) => sum + second.slow, 0);
  return `last ${log.length} s: lowest ${Math.min(...log.map((second) => second.fps))} fps  mean ${mean}  worst ${Math.max(...log.map((second) => second.worst))} ms  slow frames ${slow}`;
}

/** The log as text to send: the summary, then each second's frame rate and longest frame, oldest first. */
export function logText(log: readonly Second[], scale: number): string {
  return [`x${scale}  ${summaryLine(log)}`, ...log.map((second, index) => `${String(index + 1).padStart(2)}  ${second.fps} fps  worst ${second.worst} ms  late ${second.late}  raf ${second.raf}  draw ${second.draw}/${second.draws}`)].join("\n");
}

// How long the animation frame callbacks ran since the meter last read it. Every caller asks the window for a frame at call time, so wrapping it here times them all.
let rafBusy = 0;

// How long Skia took to record scenes since the meter last read it, and how many it recorded.
let drawBusy = 0;
let drawCount = 0;

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
      drawBusy += performance.now() - started;
      drawCount += 1;
      return picture;
    };
    return recorder;
  };
}

function watchFrames(): void {
  const frame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    frame((now) => {
      const started = performance.now();
      try {
        callback(now);
      } finally {
        rafBusy += performance.now() - started;
      }
    });
}

function startMeter(): void {
  watchFrames();
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  box.style.cssText = "position:fixed;left:4px;bottom:4px;z-index:2147483647;max-width:90vw;max-height:80vh;overflow:auto;padding:2px 6px;border-radius:4px;background:#000c;color:#fff;font:12px/16px monospace;pointer-events:none;white-space:pre-wrap";
  const rate = document.createElement("div");
  const fault = document.createElement("div");
  fault.style.color = "#ffb4a8";
  box.append(rate, fault);
  // Beside the body, not in it: an open sheet makes the body's other children inert (modal-layers.ts), and the meter must still take its tap.
  document.documentElement.appendChild(box);
  watchErrors((text) => {
    fault.textContent = text;
  });
  const summary = document.createElement("div");
  box.insertBefore(summary, fault);
  // A tap stops the meter where it stands, so its numbers can be read or photographed, and copies the log; a second tap clears the log and goes on.
  box.style.pointerEvents = "auto";
  box.style.cursor = "pointer";
  let gaps: number[] = [];
  let log: Second[] = [];
  let paused = false;
  let last = performance.now();
  let shown = last;
  box.addEventListener("click", (event) => {
    event.stopPropagation();
    paused = !paused;
    if (paused) {
      const text = logText(log, window.devicePixelRatio);
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
        log = [...log, secondOf(gaps, rafBusy, drawBusy, drawCount)].slice(-LOG_SECONDS);
        rafBusy = 0;
        drawBusy = 0;
        drawCount = 0;
        rate.textContent = `${meterLine(gaps, window.devicePixelRatio)}  (tap to stop)`;
        summary.textContent = summaryLine(log);
        gaps = [];
        shown = now;
      }
    }
    last = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

let applied = false;
// Whether the meter shows, once the controls are applied.
let metering = false;

/** Reads the two controls from the address and storage and applies them, once. Only the web app's build calls it. */
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
}
