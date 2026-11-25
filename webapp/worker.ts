// The web app's Worker (docs/plans/pwa-iphone-ipad.md, Cloudflare fit). Cloudflare answers a request that names a file of the export from the static assets, with the
// headers of `_headers`, and never runs this code. It runs for the rest: a route with a parameter gets its page, and any other path the app's not-found page.
// A Worker module exports its handlers and nothing else, so the path is in routes.ts.
import { handleMeter, METER_PATH, type MeterStore } from "./meter.ts";
import { assetPath, matchRoute, ROUTES_PATH } from "./routes.ts";

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** The test site's store of meter logs (meter.ts); the permanent site has none. */
  METER?: MeterStore;
}

// One read for each isolate: a deploy starts new isolates, so the list is never older than the assets beside it.
let pages: Promise<string[]> | null = null;

async function loadPages(env: Env, origin: string): Promise<string[]> {
  const response = await env.ASSETS.fetch(new Request(new URL(ROUTES_PATH, origin)));
  if (!response.ok) throw new Error(`${ROUTES_PATH}: ${response.status}`);
  return (await response.json()) as string[];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // The test meter's logs, where the deploy keeps them.
    if (url.pathname === METER_PATH && env.METER) return handleMeter(request, env.METER, Date.now(), crypto.randomUUID().slice(0, 8));
    if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
    pages ??= loadPages(env, url.origin);
    let list: string[];
    try {
      list = await pages;
    } catch (error) {
      pages = null;
      throw error;
    }
    const page = matchRoute(url.pathname, list);
    // A route's page is answered as the asset server answers it, headers and status: the isolation pair and the CSP of `_headers`, and a 304 when the browser
    // already holds the page (a reload asks with If-None-Match).
    if (page) return env.ASSETS.fetch(new Request(new URL(assetPath(page), url.origin), { method: request.method, headers: request.headers }));
    // The not-found page is asked for whole, with none of the request's conditions, so its body always goes with the 404.
    const missing = await env.ASSETS.fetch(new Request(new URL(assetPath("+not-found.html"), url.origin), { method: request.method }));
    return new Response(missing.body, { status: 404, headers: missing.headers });
  },
};
