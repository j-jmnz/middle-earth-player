import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ICONS } from "../../src/play/icons/generated.ts";
import { SPHERE_TINT, sphereIcon, typeIcon } from "../../src/play/icon-map.ts";
import { tableTokens } from "../../src/play/tokens.ts";
import { buildIcons, flippedViewBox, iconRecords, parseIconCss, RASTER_ICONS, VECTOR_ICONS } from "./icons.ts";
import { ROOT } from "./paths.ts";

// The game icons (docs/design-system.md, Icons): every icon the app names is a committed file, each clears the
// resolution bar (vector, or a raster of at least 256 px), and data:build writes the same bytes every time.
const ASSETS = path.join(ROOT, "assets", "icons");

function files(dir: string): Map<string, Buffer> {
  return new Map(readdirSync(dir).sort().map((name) => [name, readFileSync(path.join(dir, name))]));
}

describe("icons", () => {
  it("are committed, one file per icon the generated map names, and nothing else", () => {
    const names = Object.keys(ICONS).sort();
    expect(names).toEqual([...VECTOR_ICONS.map((icon) => icon.name), ...RASTER_ICONS.map((icon) => icon.name)].sort());
    const committed = readdirSync(ASSETS).sort();
    expect(committed).toEqual(names.map((name) => `${name}.${ICONS[name as keyof typeof ICONS].kind === "vector" ? "svg" : "png"}`).sort());
    const requires = readFileSync(path.join(ROOT, "src", "play", "icons", "files.generated.ts"), "utf8").matchAll(/require\("([^"]+)"\)/g);
    for (const match of requires) expect(existsSync(path.resolve(ROOT, "src", "play", "icons", match[1] ?? "")), match[1]).toBe(true);
  });

  it("clear the bar: vectors with a real box, rasters at least 256 px on the short side, each with its source", () => {
    for (const icon of Object.values(ICONS)) {
      expect(icon.source).toMatch(/^https:\/\//);
      if (icon.kind === "vector") {
        expect(icon.viewBox[2]).toBeGreaterThan(0);
        expect(icon.viewBox[3]).toBeGreaterThan(0);
        expect(icon.d.length).toBeGreaterThan(10);
      } else {
        expect(Math.min(icon.width, icon.height)).toBeGreaterThanOrEqual(256);
      }
    }
  });

  it("build the same bytes twice, and the committed files are that build", () => {
    const one = mkdtempSync(path.join(tmpdir(), "icons-a-"));
    const two = mkdtempSync(path.join(tmpdir(), "icons-b-"));
    buildIcons(path.join(one, "assets"), path.join(one, "modules"));
    buildIcons(path.join(two, "assets"), path.join(two, "modules"));
    expect(files(path.join(one, "assets"))).toEqual(files(path.join(two, "assets")));
    expect(files(path.join(one, "modules"))).toEqual(files(path.join(two, "modules")));
    expect(files(path.join(one, "assets"))).toEqual(files(ASSETS));
    expect(files(path.join(one, "modules"))).toEqual(files(path.join(ROOT, "src", "play", "icons")));
    expect(iconRecords().length).toBe(Object.keys(ICONS).length);
  });

  it("map every sphere and player card type the app shows to an icon, tinted with an existing token", () => {
    for (const sphere of ["leadership", "tactics", "spirit", "lore", "fellowship", "baggins", "neutral"]) {
      const name = sphereIcon(sphere);
      expect(name, sphere).not.toBeNull();
      expect(ICONS[name ?? "neutral"]).toBeDefined();
      expect(tableTokens[SPHERE_TINT[sphere] ?? "faint"]).toMatch(/^#/);
    }
    for (const type of ["hero", "ally", "attachment", "event", "treasure"]) expect(typeIcon(type), type).not.toBeNull();
    expect(typeIcon("enemy")).toBeNull();
  });

  it("read app.css in both forms and flip a glyph's box", () => {
    const css = parseIconCss('.icon-cost:before{content:"\\e606"}\n.icon-health:before {\n  content: "\ue603";\n}');
    expect(css.get("cost")).toBe("\ue606");
    expect(css.get("health")).toBe("\ue603");
    expect(flippedViewBox("M0 0L100 0L100 200Z")).toEqual([0, -200, 100, 200]);
  });
});
