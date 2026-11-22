// The web app's Worker (docs/plans/pwa-iphone-ipad.md, Cloudflare fit). Cloudflare answers a request that names a file of the export from the static assets, with the
// headers of `_headers`, and never runs this code. It runs for the rest: a route with a parameter gets its page, and any other path the app's not-found page.
// A Worker module exports its handlers and nothing else, so the path is in routes.ts.
import { assetPath, matchRoute, ROUTES_PATH } from "./routes.ts";

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
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
    if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
    const url = new URL(request.url);
    pages ??= loadPages(env, url.origin);
    let list: string[];
    try {
      list = await pages;
    } catch (error) {
      pages = null;
      throw error;
    }
    const page = matchRoute(url.pathname, list);
    const answer = await env.ASSETS.fetch(new Request(new URL(assetPath(page ?? "+not-found.html"), url.origin), { method: request.method, headers: request.headers }));
    // The page's own headers (the isolation pair and the CSP of `_headers`) go with it; only the status says whether the route exists.
    return new Response(answer.body, { status: page && answer.ok ? 200 : 404, headers: answer.headers });
  },
};
