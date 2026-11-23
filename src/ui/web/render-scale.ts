// The web app's drawing scale and frame meter (docs/plans/pwa-iphone-ipad.md, Risks only a device can answer): two test controls a player turns on from the address,
// so a device says what a headless browser cannot. `?scale=1` (or 1.5) makes the table's canvases draw at that many pixels for each CSS pixel in place of the device's
// (an iPad's 2 is four times the pixels of 1), `?fps=1` shows the frame rate and the first error the page reports, with where it was thrown; `?scale=0` and `?fps=0` turn each off. Both are kept in localStorage, since they are read
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

function startMeter(): void {
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  box.style.cssText = "position:fixed;left:4px;bottom:4px;z-index:2147483647;max-width:90vw;padding:2px 6px;border-radius:4px;background:#000c;color:#fff;font:12px/16px monospace;pointer-events:none;white-space:pre-wrap";
  const rate = document.createElement("div");
  const fault = document.createElement("div");
  fault.style.color = "#ffb4a8";
  box.append(rate, fault);
  document.body.appendChild(box);
  watchErrors((text) => {
    fault.textContent = text;
  });
  let gaps: number[] = [];
  let last = performance.now();
  let shown = last;
  const frame = (now: number) => {
    gaps.push(now - last);
    last = now;
    if (now - shown >= 1000) {
      rate.textContent = meterLine(gaps, window.devicePixelRatio);
      gaps = [];
      shown = now;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

let applied = false;

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
  if (meter) startMeter();
}
