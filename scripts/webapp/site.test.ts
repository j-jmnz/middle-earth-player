import { describe, expect, it } from "vitest";

import { ASSET_FILE_LIMIT, assetsIgnore, dynamicPages, headersFile, earlyScript, oversize, withEarlyMeter, withHomeScreenTags } from "./site.ts";

describe("what the web app adds to the export for Cloudflare", () => {
  it("isolates every page with require-corp, which Safari supports", () => {
    const headers = headersFile();
    expect(headers.startsWith("/*\n")).toBe(true);
    expect(headers).toContain("  Cross-Origin-Opener-Policy: same-origin\n");
    expect(headers).toContain("  Cross-Origin-Embedder-Policy: require-corp\n");
    expect(headers).not.toContain("credentialless");
    expect(headers).toContain("  Content-Security-Policy: default-src 'none'");
  });

  it("keeps each line under Cloudflare's 2,000 characters", () => {
    for (const line of headersFile().split("\n")) expect(line.length).toBeLessThan(2000);
  });

  it("lists the pages that have a parameter", () => {
    expect(dynamicPages(["index.html", "table/[saveId].html", "(tabs)/decks.html", "briefing/[saveId]/[scenarioId].html", "assets/[x].png", "+not-found.html"])).toEqual([
      "briefing/[saveId]/[scenarioId].html",
      "table/[saveId].html",
    ]);
  });

  it("leaves out a file over the asset limit", () => {
    const files = [
      { path: "assets/book.pdf", size: ASSET_FILE_LIMIT + 1 },
      { path: "canvaskit.wasm", size: ASSET_FILE_LIMIT },
    ];
    expect(oversize(files).map((file) => file.path)).toEqual(["assets/book.pdf"]);
    expect(assetsIgnore(files)).toBe(".inputs-stamp\n/assets/book.pdf\n");
  });

  it("adds the Home Screen tags to a page once", () => {
    const tagged = withHomeScreenTags("<html><head><title>x</title></head><body></body></html>");
    expect(tagged).toContain('<meta name="apple-mobile-web-app-capable" content="yes"/>');
    expect(tagged).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png"/></head>');
    expect(withHomeScreenTags(tagged)).toBe(tagged);
    expect(withHomeScreenTags("no head")).toBe("no head");
  });

  it("puts the early script first in a page's head, once", () => {
    const page = withEarlyMeter("<html><head><title>x</title></head><body></body></html>");
    expect(page).toBe('<html><head><script src="/meter-early.js"></script><title>x</title></head><body></body></html>');
    expect(withEarlyMeter(page)).toBe(page);
    expect(withEarlyMeter("no head")).toBe("no head");
  });

  it("names the build in the early script, and the script parses", () => {
    const script = earlyScript('abc1234 2026-11-26T01:30"; alert(1); "');
    expect(script).toContain('build: "abc1234 2026-11-26T01:30 alert1 "');
    expect(() => new Function(script)).not.toThrow();
  });

  it("allows the page's copies of the music as media", () => {
    expect(headersFile()).toContain("media-src 'self' blob:");
  });
});
