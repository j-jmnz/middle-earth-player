// What the desktop app may reach and open (desktop/policy.ts): the bundle and the RingsDB deck import, the project's own pages in the system browser, nothing else.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { allowExternal, allowNavigation, allowPermission, allowRequest, DEV_ORIGIN, RINGSDB_PATHS } from "./policy.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP = "app://middle-earth-player";

describe("allowRequest", () => {
  it("lets the bundle and in-memory URLs through", () => {
    for (const url of [`${APP}/`, `${APP}/assets/scans/x.jpg`, `${APP}/_expo/static/js/web/entry.js`, "data:image/png;base64,AAAA", "blob:app://middle-earth-player/1234"]) expect(allowRequest(url, false)).toBe(true);
  });

  it("lets the RingsDB deck import through and no other path of RingsDB", () => {
    for (const url of ["https://ringsdb.com/api/public/decklist/68989.json", "https://ringsdb.com/api/public/card/01001.json", "https://ringsdb.com/api/oauth2/deck/load/4821"]) expect(allowRequest(url, false)).toBe(true);
    for (const url of ["https://ringsdb.com/", "https://ringsdb.com/api/oauth2/token", "http://ringsdb.com/api/public/card/1.json", "https://www.ringsdb.com/api/public/card/1.json", "https://ringsdb.com.evil.test/api/public/x", "https://user@ringsdb.com/api/public/x", "https://ringsdb.com:8443/api/public/x"]) expect(allowRequest(url, false)).toBe(false);
  });

  it("cancels everything else: other hosts, other apps' schemes, files, devtools, a bad URL", () => {
    for (const url of ["https://example.com/", "http://localhost:8081/", "ws://localhost:8081/hot", "file:///etc/passwd", "app://other-host/", "chrome://gpu", "devtools://devtools/bundled/x.html", "ftp://ringsdb.com/api/public/", "not a url", ""]) expect(allowRequest(url, false)).toBe(false);
  });

  it("allows the Metro server in development only", () => {
    expect(allowRequest(`${DEV_ORIGIN}/index.bundle`, true)).toBe(true);
    expect(allowRequest("ws://localhost:8081/hot", true)).toBe(true);
    expect(allowRequest("http://localhost:9999/", true)).toBe(false);
    expect(allowRequest(`${DEV_ORIGIN}/index.bundle`, false)).toBe(false);
  });
});

describe("allowNavigation", () => {
  it("stays inside the app's origin", () => {
    expect(allowNavigation(`${APP}/table/x`, false)).toBe(true);
    expect(allowNavigation("https://example.com/", false)).toBe(false);
    expect(allowNavigation("https://ringsdb.com/api/public/x", false)).toBe(false);
    expect(allowNavigation("file:///etc/passwd", false)).toBe(false);
    expect(allowNavigation(`${DEV_ORIGIN}/`, false)).toBe(false);
    expect(allowNavigation(`${DEV_ORIGIN}/`, true)).toBe(true);
  });
});

describe("allowExternal", () => {
  it("opens the pages Settings links to, read from links.ts", () => {
    const links = [...readFileSync(path.join(ROOT, "src/screens/settings/links.ts"), "utf8").matchAll(/= "(https:\/\/[^"]+)"/g)].map((match) => match[1] ?? "");
    expect(links.length).toBe(2);
    for (const link of links) expect(allowExternal(link), link).toBe(true);
  });

  it("refuses every other link", () => {
    for (const url of ["https://github.com/", "https://github.com/someone-else/repo", "https://github.com/j-jmnz/middle-earth-player-evil", "http://github.com/j-jmnz/middle-earth-player", "https://evil.test/j-jmnz/middle-earth-player", "https://github.com.evil.test/j-jmnz/middle-earth-player", "https://user@github.com/j-jmnz/middle-earth-player", "javascript:alert(1)", "file:///etc/passwd", "mailto:x@y.z", "nope"]) expect(allowExternal(url), url).toBe(false);
    expect(allowExternal("https://github.com/j-jmnz/middle-earth-player/issues")).toBe(true);
  });
});

describe("allowPermission", () => {
  it("denies every request", () => {
    expect(allowPermission()).toBe(false);
  });
});

describe("the deck import's endpoints", () => {
  it("are all allowed, read from the import's own code", () => {
    const source = readFileSync(path.join(ROOT, "src/screens/deck/import.ts"), "utf8");
    const urls = [...source.matchAll(/`(https:\/\/ringsdb\.com\/api\/[^`$]*)\$\{/g)].map((match) => `${match[1]}1`);
    expect(urls.length).toBeGreaterThanOrEqual(3);
    for (const url of urls) expect(allowRequest(url, false), url).toBe(true);
    expect(RINGSDB_PATHS.length).toBe(2);
  });
});
