import { describe, expect, it } from "vitest";

import { assetPath, matchRoute } from "./routes.ts";

const PAGES = ["briefing/[saveId]/[scenarioId].html", "settings/[category].html", "standalone/table/[gameId].html", "table/[saveId].html"];

describe("the web app's dynamic routes", () => {
  it("answers a path with a parameter with its page", () => {
    expect(matchRoute("/table/abc", PAGES)).toBe("table/[saveId].html");
    expect(matchRoute("/table/abc/", PAGES)).toBe("table/[saveId].html");
    expect(matchRoute("/briefing/s1/01", PAGES)).toBe("briefing/[saveId]/[scenarioId].html");
    expect(matchRoute("/standalone/table/g%201", PAGES)).toBe("standalone/table/[gameId].html");
  });

  it("answers nothing for a path no page has", () => {
    expect(matchRoute("/", PAGES)).toBeNull();
    expect(matchRoute("/table", PAGES)).toBeNull();
    expect(matchRoute("/table/a/b", PAGES)).toBeNull();
    expect(matchRoute("/nowhere/abc", PAGES)).toBeNull();
    expect(matchRoute("/table/%E0%A4%A", PAGES)).toBeNull();
  });

  it("prefers the page with more literal segments", () => {
    expect(matchRoute("/a/b", ["[x]/[y].html", "a/[y].html"])).toBe("a/[y].html");
  });

  it("encodes the brackets and drops .html for the asset server", () => {
    expect(assetPath("table/[saveId].html")).toBe("/table/%5BsaveId%5D");
    expect(assetPath("+not-found.html")).toBe("/%2Bnot-found");
  });
});
