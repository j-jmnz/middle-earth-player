// What the app:// handler answers (desktop/serve.ts): the file a path names, its type, its headers and its ranges.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { answerFor, contentType, CSP, HYDRATE_SCRIPT_HASH, parseRange, resolveFile, responseHeaders } from "./serve.ts";
import { LATEST_RELEASE_URL } from "./policy.ts";

let root = "";
const put = (file: string) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), file);
};

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "serve-test-"));
  for (const file of ["index.html", "+not-found.html", "decks.html", "table/[saveId].html", "card/[code].html", "card/index.html", "assets/a.mjs", "secret.txt"]) put(file);
  // A file next to the export that a "../" must not reach.
  writeFileSync(path.join(path.dirname(root), "outside.txt"), "outside");
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(path.join(path.dirname(root), "outside.txt"), { force: true });
});

const at = (file: string) => path.join(root, file);

describe("resolveFile", () => {
  it("serves the file itself, its .html and its index.html", () => {
    expect(resolveFile(root, "/")).toBe(at("index.html"));
    expect(resolveFile(root, "/decks")).toBe(at("decks.html"));
    expect(resolveFile(root, "/assets/a.mjs")).toBe(at("assets/a.mjs"));
    expect(resolveFile(root, "/card")).toBe(at("card/index.html"));
  });

  it("falls to the [param].html beside a dynamic route", () => {
    expect(resolveFile(root, "/table/save-e2e-duo")).toBe(at("table/[saveId].html"));
    expect(resolveFile(root, "/card/01001")).toBe(at("card/[code].html"));
  });

  it("falls to the not-found page for an unknown path", () => {
    expect(resolveFile(root, "/nowhere")).toBe(at("+not-found.html"));
    expect(resolveFile(root, "/nowhere/deeper/still")).toBe(at("+not-found.html"));
  });

  it("falls to the not-found page for a path below a file", () => {
    expect(resolveFile(root, "/index.html/x")).toBe(at("+not-found.html"));
    expect(resolveFile(root, "/decks.html/x")).toBe(at("+not-found.html"));
  });

  it("does not climb out of the export folder", () => {
    for (const hostile of ["/../outside.txt", "/../../etc/passwd", "/a/../../outside.txt", "//../outside.txt", "/\0/secret.txt"]) {
      expect(resolveFile(root, hostile), hostile).toBe(at("+not-found.html"));
    }
    // A path that only reaches the export's own root (path.join stops ".." at "/") is served from inside it.
    expect(resolveFile(root, "/..").startsWith(root + path.sep)).toBe(true);
  });
});

describe("answerFor", () => {
  it("answers 200 for a page or a file and 404 with the not-found page for the rest", () => {
    expect(answerFor(root, "/decks")).toEqual({ file: at("decks.html"), status: 200 });
    expect(answerFor(root, "/nowhere")).toEqual({ file: at("+not-found.html"), status: 404 });
    expect(answerFor(root, "/assets/missing.jpg")).toEqual({ file: at("+not-found.html"), status: 404 });
    expect(answerFor(root, "/+not-found").status).toBe(200);
  });
});

describe("contentType", () => {
  it("types what the page loads: scripts and the pdf.js module worker, wasm and pdf", () => {
    expect(contentType("a/b.js")).toBe("text/javascript");
    expect(contentType("pdf.worker.min.mjs")).toBe("text/javascript");
    expect(contentType("canvaskit.wasm")).toBe("application/wasm");
    expect(contentType("learn-to-play.pdf")).toBe("application/pdf");
    expect(contentType("x.HTML")).toBe("text/html; charset=utf-8");
    expect(contentType("scan.jpg")).toBe("image/jpeg");
    expect(contentType("font.ttf")).toBe("font/ttf");
    expect(contentType("catalog.db")).toBe("application/octet-stream");
    expect(contentType("unknown.xyz")).toBe("application/octet-stream");
  });
});

describe("responseHeaders", () => {
  const headers = responseHeaders("a.html", 10);

  it("isolates the page: COOP same-origin and COEP credentialless", () => {
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["cross-origin-embedder-policy"]).toBe("credentialless");
  });

  it("carries the length, the type and the policy", () => {
    expect(headers["content-length"]).toBe("10");
    expect(headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(headers["content-security-policy"]).toBe(CSP);
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("CSP", () => {
  it("allows no remote host but RingsDB and the update check's one URL, no object, no framing and no unsafe script", () => {
    expect(CSP).toContain("default-src 'none'");
    expect(CSP).toContain(`connect-src 'self' https://ringsdb.com ${LATEST_RELEASE_URL}`);
    expect(CSP).toContain("object-src 'none'");
    expect(CSP).toContain("frame-ancestors 'none'");
    expect(CSP).toContain("'wasm-unsafe-eval'");
    expect(CSP).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    expect(CSP.match(/https?:\/\/[^\s;]+/g)).toEqual(["https://ringsdb.com", LATEST_RELEASE_URL]);
  });

  it("names the hash of the one inline script Expo Router writes", async () => {
    const { createHash } = await import("node:crypto");
    expect(HYDRATE_SCRIPT_HASH).toBe(`sha256-${createHash("sha256").update("globalThis.__EXPO_ROUTER_HYDRATE__=true;").digest("base64")}`);
  });
});

describe("parseRange", () => {
  it("reads a bytes range, open at the end or as a suffix", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=990-5000", 1000)).toEqual({ start: 990, end: 999 });
    expect(parseRange("bytes=-5000", 1000)).toEqual({ start: 0, end: 999 });
  });

  it("answers the whole file (null) for no header, a form it does not serve or a range outside the file", () => {
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange("items=0-1", 1000)).toBeNull();
    expect(parseRange("bytes=0-1,5-6", 1000)).toBeNull();
    expect(parseRange("bytes=-", 1000)).toBeNull();
    expect(parseRange("bytes=1000-", 1000)).toBeNull();
    expect(parseRange("bytes=50-10", 1000)).toBeNull();
    expect(parseRange("bytes=0-1", 0)).toBeNull();
  });
});
