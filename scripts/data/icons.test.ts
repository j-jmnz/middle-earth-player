import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CARD_BACKS as BACK_RECORDS, ICONS } from "../../src/play/icons/generated.ts";
import { SPHERE_TINT, sphereIcon, typeIcon } from "../../src/play/icon-map.ts";
import { tableTokens } from "../../src/play/tokens.ts";
import { backAsset, buildIcons, CARD_BACK_BAR, cardBackRecords, flipPathY, flippedViewBox, iconRecords, parseIconCss, RASTER_ICONS, VECTOR_ICONS } from "./icons.ts";
import { ROOT } from "./paths.ts";

// The game icons and the printed card backs (docs/design-system.md, Icons): every icon and back the app names is a committed
// file, each clears the resolution bar (vector, or a raster at its bar: 256 px in chrome, 96 px for a token drawn on a card,
// a card scan's 600 px for a back), and data:build writes the same bytes every time.
const ASSETS = path.join(ROOT, "assets", "icons");

function files(dir: string): Map<string, Buffer> {
  return new Map(readdirSync(dir).sort().map((name) => [name, readFileSync(path.join(dir, name))]));
}

describe("icons", () => {
  it("are committed, one file per icon the generated map names, and nothing else", () => {
    const names = Object.keys(ICONS).sort();
    expect(names).toEqual([...VECTOR_ICONS.map((icon) => icon.name), "nightmare", ...RASTER_ICONS.map((icon) => icon.name)].sort());
    const committed = readdirSync(ASSETS).sort();
    const backs = Object.values(BACK_RECORDS).map((back) => backAsset(back.name));
    expect(committed).toEqual([...names.map((name) => `${name}.${ICONS[name as keyof typeof ICONS].kind === "vector" ? "svg" : "png"}`), ...backs].sort());
    const requires = readFileSync(path.join(ROOT, "src", "play", "icons", "files.generated.ts"), "utf8").matchAll(/require\("([^"]+)"\)/g);
    for (const match of requires) expect(existsSync(path.resolve(ROOT, "src", "play", "icons", match[1] ?? "")), match[1]).toBe(true);
  });

  it("clear the bar: vectors with a real box, rasters at their bar on the short side, each with its source", () => {
    for (const icon of Object.values(ICONS)) {
      // The Eye of Sauron is drawn for the app (scripts/data/icons.ts); every other icon names the URL it was cut from.
      expect(icon.source).toMatch(icon.name === "nightmare" ? /^drawn for the app/ : /^https:\/\//);
      if (icon.kind === "vector") {
        expect(icon.viewBox[2]).toBeGreaterThan(0);
        expect(icon.viewBox[3]).toBeGreaterThan(0);
        expect(icon.d.length).toBeGreaterThan(10);
      } else {
        const bar = RASTER_ICONS.find((raster) => raster.name === icon.name)?.bar ?? 256;
        expect(bar).toBeGreaterThanOrEqual(96);
        expect(Math.min(icon.width, icon.height)).toBeGreaterThanOrEqual(bar);
      }
    }
  });

  it("keep the player and encounter backs at a card scan's size, each with its source", () => {
    expect(Object.keys(BACK_RECORDS).sort()).toEqual(cardBackRecords().map((back) => back.name).sort());
    for (const back of cardBackRecords()) {
      expect(back.source).toMatch(/^https:\/\/dragncards-lotrlcg\.s3\.amazonaws\.com\/cardbacks\//);
      expect(Math.max(back.width, back.height)).toBeGreaterThanOrEqual(CARD_BACK_BAR);
      // Upright, like a card.
      expect(back.height).toBeGreaterThan(back.width);
      expect(BACK_RECORDS[back.name]).toEqual(back);
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
    // Two full icon builds (font glyphs and rasters): about 2 s alone, past the 5 s default when the whole suite runs at once.
  }, 30_000);

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

  it("flips a y-down path into the font's y-up glyph space, and back again", () => {
    expect(flipPathY("M0 10L5 -2c1 2 3 4 5 6zH4V8")).toBe("M 0 -10 L 5 2 c 1 -2 3 -4 5 -6 z H 4 V -8");
    expect(flipPathY(flipPathY("M1 2C3 4 5 6 7 8Z"))).toBe("M 1 2 C 3 4 5 6 7 8 Z");
    expect(() => flipPathY("M0 0a5 5 0 0 1 10 0")).toThrow(/arcs/);
  });
});
