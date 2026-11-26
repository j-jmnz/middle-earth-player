// The web app's slow-state probe, a test control (`?probe=1`, with the frame meter: src/ui/web/render-scale.ts; docs/development.md, The web app on Cloudflare).
// A device shows a slow state no headless browser does, with no script running, so the page finds its cause itself: when the frame rate stays low, it hides one
// kind of thing at a time for about a second (the animations paused, the fog's masked and blended layers, the canvases, the pictures, then everything), counts
// the frames with each hidden, and puts the rates in the meter's log. The kind whose absence brings the rate back is what the browser was drawing slowly; if the
// rate stays low with everything hidden, the cause is not drawing. The screen flickers while it runs. No browser here: `ProbeHost` is the page, so a test runs the rest.
import { describeTo } from "./meter-span.ts";

/** One thing to take away: its name in the log and the CSS that takes it away (`[data-probe]` is the fog's layers, marked by the host). */
export const PROBES: readonly (readonly [string, string])[] = [
  ["paused", "*,*::before,*::after{animation-play-state:paused!important}"],
  ["fog", "[data-probe]{visibility:hidden!important}"],
  ["canvas", "canvas{visibility:hidden!important}"],
  ["img", "img{visibility:hidden!important}"],
  ["all", "body{visibility:hidden!important}"],
];

// A second counts as slow under this share of the best rate seen, and a probe runs after this many slow seconds in a row.
const SLOW_SHARE = 0.7;
const SLOW_SECONDS = 3;
// How long a probe waits for the page to settle, how long it counts frames, the wait before the next run, and the most runs for a page.
const SETTLE_MS = 400;
const COUNT_MS = 1200;
const AGAIN_MS = 12_000;
const RUNS_MAX = 4;

export type ProbeHost = {
  /** Frames a second over the next `ms`. */
  rate(ms: number): Promise<number>;
  wait(ms: number): Promise<void>;
  /** Applies `css` to the page (null takes it away). */
  style(css: string | null): void;
};

/** Whether `rates`, the last seconds' frame rates (newest last), are a slow state against `best`, the highest rate seen. */
export function slowState(rates: readonly number[], best: number): boolean {
  const last = rates.slice(-SLOW_SECONDS);
  return last.length === SLOW_SECONDS && last.every((rate) => rate < best * SLOW_SHARE);
}

/** One run: the rate as the page is, with each probe's CSS applied, and as the page is again, as `name rate` pairs for the log. */
export async function runProbes(host: ProbeHost): Promise<string> {
  const parts = [`base ${Math.round(await host.rate(COUNT_MS))}`];
  for (const [name, css] of PROBES) {
    host.style(css);
    await host.wait(SETTLE_MS);
    parts.push(`${name} ${Math.round(await host.rate(COUNT_MS))}`);
    host.style(null);
    await host.wait(SETTLE_MS);
  }
  parts.push(`base ${Math.round(await host.rate(COUNT_MS))}`);
  return parts.join(", ");
}

function browserHost(): ProbeHost {
  const sheet = document.head.appendChild(document.createElement("style"));
  return {
    rate: (ms) =>
      new Promise((resolve) => {
        const started = performance.now();
        let frames = 0;
        const tick = (): void => {
          frames += 1;
          const spent = performance.now() - started;
          if (spent >= ms) resolve((frames * 1000) / spent);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    style(css) {
      if (css?.includes("[data-probe]")) {
        // The fog's layers have no name of their own: they are the elements with a mask or a blend.
        for (const element of document.body.querySelectorAll("*")) {
          const computed = getComputedStyle(element);
          const mask = computed.maskImage || computed.webkitMaskImage;
          if ((mask && mask !== "none") || computed.mixBlendMode !== "normal") element.setAttribute("data-probe", "");
        }
      }
      sheet.textContent = css ?? "";
    },
  };
}

/** Starts the probe on the page: it watches the frame rate, runs when the page is in a slow state, and gives each run's line to the meter's log. */
export function startSlowProbe(): void {
  const host = browserHost();
  const lines: string[] = [];
  describeTo("probe", () => lines.join(" || "));
  let best = 0;
  let rates: number[] = [];
  let busy = false;
  const watch = async (): Promise<void> => {
    const rate = await host.rate(1000);
    best = Math.max(best, rate);
    rates = [...rates.slice(-SLOW_SECONDS), rate];
    if (!busy && lines.length < RUNS_MAX && slowState(rates, best)) {
      busy = true;
      const line = await runProbes(host);
      lines.push(`${window.location.pathname.split("/")[1] || "home"} ${new Date().toISOString().slice(11, 19)}: ${line}`);
      rates = [];
      await host.wait(AGAIN_MS);
      busy = false;
    }
    void watch();
  };
  void watch();
}
