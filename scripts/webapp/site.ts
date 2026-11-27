// What `pnpm webapp build` adds to the web export so Cloudflare serves it (docs/plans/pwa-iphone-ipad.md, Cloudflare fit): the `_headers` file, the list of dynamic
// pages the Worker reads (webapp/worker.ts) and the `.assetsignore` of what is not uploaded. Pure, so site.test.ts runs it.
import { CSP } from "../../desktop/serve.ts";

/** Cloudflare's limit for one static asset. A larger file is not uploaded; the plan serves it from R2. */
export const ASSET_FILE_LIMIT = 25 * 1024 * 1024;
/** Cloudflare's limit of static assets for one Worker version on the paid plan. */
export const ASSET_COUNT_LIMIT = 100_000;

/**
 * The `_headers` file. Safari has no COEP `credentialless`, so the page is isolated with `require-corp` (expo-sqlite's synchronous calls need SharedArrayBuffer), which
 * every file of the app's own origin passes. The CSP is the desktop's. The hashed files never change under their name, so a browser keeps them for good.
 */
export function headersFile(): string {
  const all = [
    "Cross-Origin-Opener-Policy: same-origin",
    "Cross-Origin-Embedder-Policy: require-corp",
    "Cross-Origin-Resource-Policy: same-origin",
    `Content-Security-Policy: ${CSP}`,
    "X-Content-Type-Options: nosniff",
    "X-Robots-Tag: noindex",
  ];
  const immutable = ["Cache-Control: public, max-age=31536000, immutable"];
  const block = (pattern: string, lines: readonly string[]) => [pattern, ...lines.map((line) => `  ${line}`)].join("\n");
  return `${[block("/*", all), block("/_expo/static/*", immutable), block("/assets/*", immutable)].join("\n\n")}\n`;
}

/** The export's pages that have a parameter (`table/[saveId].html`), from its files' paths relative to the export, sorted. */
export function dynamicPages(files: readonly string[]): string[] {
  return files
    .map((file) => file.split("\\").join("/"))
    .filter((file) => file.endsWith(".html") && /(^|\/)\[[^\]/]+\]/.test(file))
    .sort();
}

export type SiteFile = { path: string; size: number };

/** The files Cloudflare cannot hold as static assets, largest first. */
export function oversize(files: readonly SiteFile[]): SiteFile[] {
  return files.filter((file) => file.size > ASSET_FILE_LIMIT).sort((a, b) => b.size - a.size);
}

/** The `.assetsignore` file: the oversize files and the browser scripts' stamp, one path for each line, rooted at the export. */
export function assetsIgnore(files: readonly SiteFile[]): string {
  return `${[".inputs-stamp", ...oversize(files).map((file) => `/${file.path}`)].join("\n")}\n`;
}

/** The icon iOS puts on the Home Screen, at the export's root. */
export const TOUCH_ICON = "apple-touch-icon.png";
// What makes iOS open the page from the Home Screen as an app of its own (no Safari bars, its own storage), before the web app has a manifest
// (docs/plans/pwa-iphone-ipad.md, Phase 1: the web app build).
const HOME_SCREEN_TAGS = [
  '<meta name="apple-mobile-web-app-capable" content="yes"/>',
  '<meta name="mobile-web-app-capable" content="yes"/>',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black"/>',
  '<meta name="apple-mobile-web-app-title" content="Middle-Earth"/>',
  `<link rel="apple-touch-icon" href="/${TOUCH_ICON}"/>`,
].join("");

/** A page of the export with the Home Screen tags at the end of its head; a page that has them, or no head, is returned as it is. */
export function withHomeScreenTags(html: string): string {
  if (html.includes("apple-mobile-web-app-capable") || !html.includes("</head>")) return html;
  return html.replace("</head>", `${HOME_SCREEN_TAGS}</head>`);
}

/** The test meter's early script, at the export's root (EARLY_SCRIPT). */
export const EARLY_FILE = "meter-early.js";

/**
 * What the test meter cannot time from inside the bundle: by the time the app's code runs, React has made the channel its work comes through and the page's
 * listeners are set. This script is the first the page runs. Only while the meter is on (`?fps=1`, or its stored choice: src/ui/web/render-scale.ts), it times
 * each outermost task by what started it and sums them in `window.__early.work`, which the meter reads each second: `sched` is a message of a channel (React's
 * rendering and commits), `timer` a timeout or interval, `worker` a worker's message (the database's answers), and `ev.<type>` an event's listeners. It also
 * says which build the page is (`window.__early.build`), and ten seconds after the page's start it posts one note to the site's log on its own: what the page
 * shows, the files that failed and the first errors. A page whose app never starts (no saves, no canvas) is read from that note.
 */
export function earlyScript(build: string): string {
  return EARLY_SCRIPT.replace("__BUILD__", build.replace(/[^\w .:-]/g, ""));
}

const EARLY_SCRIPT = `(function () {
  try {
    var asked = new URLSearchParams(location.search).get("fps");
    var on = asked !== null ? asked !== "0" : localStorage.getItem("middle-earth-player.frame-meter") === "1";
    if (!on) return;
  } catch (error) {
    return;
  }
  var early = (window.__early = { work: {}, build: "__BUILD__" });
  var errors = [];
  function keep(error) {
    if (errors.length < 5) errors.push(String((error && (error.stack || error.message)) || error).slice(0, 500));
  }
  window.addEventListener("error", function (event) {
    keep(event.error || event.message);
  });
  window.addEventListener("unhandledrejection", function (event) {
    keep(event.reason);
  });
  var logged = console.error;
  console.error = function () {
    for (var i = 0; i < arguments.length; i += 1) if (arguments[i] instanceof Error) keep(arguments[i]);
    return logged.apply(console, arguments);
  };
  setTimeout(function () {
    var failed = [];
    try {
      performance.getEntriesByType("resource").forEach(function (entry) {
        if (entry.responseStatus >= 400) failed.push(entry.responseStatus + " " + entry.name.split("/").pop());
      });
    } catch (error) {}
    var shown = document.body ? document.body.innerText.replace(/\\s+/g, " ").slice(0, 500) : "";
    var note = [
      "early " + early.build + "  " + new Date().toISOString() + "  " + location.pathname,
      navigator.userAgent,
      "isolated " + self.crossOriginIsolated + "  canvases " + document.querySelectorAll("canvas").length,
      "page: " + shown,
    ];
    if (failed.length) note.push("failed: " + failed.slice(0, 12).join(", "));
    if (errors.length) note.push("errors: " + errors.join(" || "));
    fetch("/_meter", { method: "POST", body: note.join("\\n"), keepalive: true }).catch(function () {});
  }, 10000);
  var depth = 0;
  function timed(name, run) {
    return function () {
      if (depth > 0) return run.apply(this, arguments);
      depth += 1;
      var started = performance.now();
      try {
        return run.apply(this, arguments);
      } finally {
        depth -= 1;
        var done = early.work[name] || (early.work[name] = [0, 0]);
        done[0] += performance.now() - started;
        done[1] += 1;
      }
    };
  }
  function wrapHandler(proto, name) {
    var own = Object.getOwnPropertyDescriptor(proto, "onmessage");
    if (!own || !own.set || !own.get) return;
    Object.defineProperty(proto, "onmessage", {
      configurable: true,
      get: own.get,
      set: function (handler) {
        own.set.call(this, typeof handler === "function" ? timed(name, handler) : handler);
      },
    });
  }
  wrapHandler(MessagePort.prototype, "sched");
  if (window.Worker) wrapHandler(Worker.prototype, "worker");
  ["setTimeout", "setInterval"].forEach(function (method) {
    var original = window[method];
    window[method] = function (handler) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof handler === "function") args[0] = timed("timer", handler);
      return original.apply(window, args);
    };
  });
  var wrapped = new WeakMap();
  var add = EventTarget.prototype.addEventListener;
  var remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (typeof listener !== "function") return add.call(this, type, listener, options);
    var byType = wrapped.get(listener) || {};
    wrapped.set(listener, byType);
    var name = this instanceof Worker ? "worker" : this instanceof MessagePort ? "sched" : "ev." + type;
    byType[type] = byType[type] || timed(name, listener);
    return add.call(this, type, byType[type], options);
  };
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    var byType = typeof listener === "function" ? wrapped.get(listener) : undefined;
    return remove.call(this, type, (byType && byType[type]) || listener, options);
  };
})();
`;

/** A page of the export with the early script first in its head; a page that has it, or no head, is returned as it is. */
export function withEarlyMeter(html: string): string {
  if (html.includes(EARLY_FILE) || !html.includes("<head>")) return html;
  return html.replace("<head>", `<head><script src="/${EARLY_FILE}"></script>`);
}
