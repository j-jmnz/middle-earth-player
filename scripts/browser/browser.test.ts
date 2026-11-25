// The pure parts of the browser scripts (scripts/browser): which Chromium is launched, how a tap target and a route are read, the flags of
// `pnpm browser shot`, and the stamp that decides when the web export is made again. Nothing here launches a browser.
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { LANDSCAPE, PORTRAIT, pointOf, selectorOf, slugOf } from "./app.ts";
import { CONTAINER_CHROMIUM, chooseChromium } from "./chromium.ts";
import { parseShotArgs, routesOf } from "./shot-args.ts";
import { inputsStamp } from "./web-export.ts";

const OWN = "/playwright/chromium";

describe("chooseChromium", () => {
  it("launches Playwright's own browser, with the sandbox, when it is installed", () => {
    expect(chooseChromium(undefined, OWN, () => true, false)).toEqual({ executablePath: undefined, args: [] });
  });

  it("falls back to a container's Chromium, without the sandbox, when Playwright's own is missing", () => {
    expect(chooseChromium(undefined, OWN, (file) => file === CONTAINER_CHROMIUM, false)).toEqual({ executablePath: CONTAINER_CHROMIUM, args: ["--no-sandbox"] });
  });

  it("takes CHROMIUM_PATH over both, and turns the sandbox off for root", () => {
    expect(chooseChromium("/x/chrome", OWN, () => true, false).executablePath).toBe("/x/chrome");
    expect(chooseChromium(undefined, OWN, () => true, true).args).toEqual(["--no-sandbox"]);
  });
});

describe("tap targets and routes", () => {
  it("reads a bare word as a testID, a selector as it is and x,y as a point", () => {
    expect(selectorOf("app-settings")).toBe('[data-testid="app-settings"]');
    expect(selectorOf("text=Settings")).toBe("text=Settings");
    expect(selectorOf("[role=button]")).toBe("[role=button]");
    expect(pointOf("120,340.5")).toEqual({ x: 120, y: 340.5 });
    expect(pointOf("app-settings")).toBeNull();
  });

  it("names a shot after its route", () => {
    expect(slugOf("/")).toBe("home");
    expect(slugOf("/table/save-e2e-duo?x=1")).toBe("table-save-e2e-duo");
    expect(slugOf("/card/01001")).toBe("card-01001");
  });
});

describe("parseShotArgs", () => {
  it("reads routes, repeated taps, the theme and the size", () => {
    const args = parseShotArgs(["settings", "/decks", "--tap", "a", "--tap", "text=B", "--both", "--landscape", "--out", "shots"], "/repo");
    expect(args.routes).toEqual(["/settings", "/decks"]);
    expect(args.taps).toEqual(["a", "text=B"]);
    expect(args.schemes).toEqual(["light", "dark"]);
    expect(args.size).toEqual(LANDSCAPE);
    expect(args.out).toBe(path.resolve("/repo", "shots"));
  });

  it("defaults to the light theme at phone width, offline, into .agent/shots", () => {
    const args = parseShotArgs([], "/repo");
    expect(args).toMatchObject({ routes: [], schemes: ["light"], size: PORTRAIT, network: false, base: null, out: path.resolve("/repo", ".agent/shots") });
    expect(parseShotArgs(["--size", "1280x800"], "/repo").size).toEqual({ width: 1280, height: 800 });
  });

  it("refuses an unknown flag, a flag with no value and a bad size", () => {
    expect(() => parseShotArgs(["--nope"], "/repo")).toThrow("unknown flag --nope");
    expect(() => parseShotArgs(["--tap"], "/repo")).toThrow("--tap needs a value");
    expect(() => parseShotArgs(["--size", "big"], "/repo")).toThrow("--size");
    expect(() => parseShotArgs(["--at", "x"], "/repo")).toThrow("--at");
    expect(parseShotArgs(["--fixture", "duo", "--at", "5"], "/repo")).toMatchObject({ fixture: "duo", at: 5, routes: [] });
  });

  it("reads a scene with its layout inline or in a file, and a moment, and takes one way to open a table", () => {
    const inline = parseShotArgs(["--scene", "the-morgul-vale", '{"phase":"Combat"}', "--landscape"], "/repo");
    expect(inline).toMatchObject({ scene: { scenarioId: "the-morgul-vale", layout: '{"phase":"Combat"}', file: null }, routes: [], size: LANDSCAPE });
    expect(parseShotArgs(["--scene", "the-morgul-vale", "--scene-file", "layout.json"], "/repo").scene).toEqual({ scenarioId: "the-morgul-vale", layout: null, file: "layout.json" });
    expect(parseShotArgs(["--moment", "the-morgul-vale/captain-bodyguard"], "/repo")).toMatchObject({ moment: "the-morgul-vale/captain-bodyguard", scene: null });
    expect(() => parseShotArgs(["--scene-file", "layout.json"], "/repo")).toThrow("--scene <scenario-id>");
    expect(() => parseShotArgs(["--scene", "a", "{}", "--scene-file", "b.json"], "/repo")).toThrow("inline or as --scene-file");
    expect(() => parseShotArgs(["--scene", "a", "--moment", "b"], "/repo")).toThrow("give one");
    expect(() => parseShotArgs(["--fixture", "duo", "--moment", "b"], "/repo")).toThrow("give one");
    expect(() => parseShotArgs(["--scene", "a", "--landscape", "{}"], "/repo")).toThrow("directly after the scenario id");
    expect(() => parseShotArgs(["/table", "--moment", "a/b"], "/repo")).toThrow("opens its own table");
    expect(() => parseShotArgs(["--scene", "a", "{}", "/table"], "/repo")).toThrow("opens its own table");
    expect(() => parseShotArgs(["--moment", "a/b", "--at", "3"], "/repo")).toThrow("does not go with --moment");
    expect(() => parseShotArgs(["--scene", "a", "{}", "--at", "3"], "/repo")).toThrow("does not go with --scene");
    expect(() => parseShotArgs(["--moment", "a/b/c"], "/repo")).toThrow("not a/b/c");
  });

  it("puts the fixture's save id in {save}, and opens where the fixture landed when no route is named", () => {
    expect(routesOf({ routes: ["/table/{save}"] }, "/path/save-e2e-duo")).toEqual(["/table/save-e2e-duo"]);
    expect(routesOf({ routes: [] }, "/path/save-e2e-duo")).toEqual(["/path/save-e2e-duo"]);
    expect(routesOf({ routes: [] }, null)).toEqual(["/"]);
    expect(() => routesOf({ routes: ["/table/{save}"] }, null)).toThrow("--fixture");
  });
});

describe("inputsStamp", () => {
  let root = "";
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("changes with a file's content and not with a rewrite of the same bytes", () => {
    root = mkdtempSync(path.join(tmpdir(), "web-export-stamp-"));
    mkdirSync(path.join(root, "src"));
    writeFileSync(path.join(root, "src", "a.ts"), "one");
    const first = inputsStamp(root);
    writeFileSync(path.join(root, "src", "a.ts"), "one");
    expect(inputsStamp(root)).toBe(first);
    writeFileSync(path.join(root, "src", "a.ts"), "two");
    expect(inputsStamp(root)).not.toBe(first);
  });
});
