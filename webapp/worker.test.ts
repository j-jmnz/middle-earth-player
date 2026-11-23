// The web app's Worker (webapp/worker.ts) over a stand-in for the asset server: a route with a parameter is answered as its page is, a reload's 304 included, and
// any other path with the not-found page and a 404.
import { describe, expect, it } from "vitest";

import worker, { type Env } from "./worker.ts";

function assets(): Env & { asked: { path: string; conditional: boolean }[] } {
  const asked: { path: string; conditional: boolean }[] = [];
  return {
    asked,
    ASSETS: {
      fetch: async (request: Request) => {
        const path = new URL(request.url).pathname;
        const conditional = request.headers.has("if-none-match");
        asked.push({ path, conditional });
        if (path === "/_expo/dynamic-routes.json") return Response.json(["table/[saveId].html"]);
        if (conditional) return new Response(null, { status: 304, headers: { etag: '"page"' } });
        return new Response(`<html>${path}</html>`, { headers: { "content-type": "text/html", "cross-origin-embedder-policy": "require-corp" } });
      },
    },
  };
}

describe("the web app's Worker", () => {
  it("answers a route with a parameter with its page and the page's headers", async () => {
    const env = assets();
    const response = await worker.fetch(new Request("https://app.example/table/abc"), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("cross-origin-embedder-policy")).toBe("require-corp");
    expect(await response.text()).toBe("<html>/table/%5BsaveId%5D</html>");
  });

  it("answers a reload that already holds the page with the asset server's 304", async () => {
    const response = await worker.fetch(new Request("https://app.example/table/abc", { headers: { "if-none-match": '"page"' } }), assets());
    expect(response.status).toBe(304);
  });

  it("answers any other path with the whole not-found page and a 404, whatever the request's conditions", async () => {
    const env = assets();
    const response = await worker.fetch(new Request("https://app.example/nowhere/at/all", { headers: { "if-none-match": '"page"' } }), env);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("<html>/%2Bnot-found</html>");
    expect(env.asked.at(-1)).toEqual({ path: "/%2Bnot-found", conditional: false });
  });

  it("refuses a method that changes something", async () => {
    const response = await worker.fetch(new Request("https://app.example/table/abc", { method: "POST" }), assets());
    expect(response.status).toBe(405);
  });
});
