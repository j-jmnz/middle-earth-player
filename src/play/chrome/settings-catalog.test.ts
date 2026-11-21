import { describe, expect, it, vi } from "vitest";

import { CATEGORIES, categoriesFor, categorySummary, homeOf, isCategoryId, PANEL_ROWS, quickSetups, rowsFor, searchSettings, SETTING_TITLES, setupInUse, type SettingId, type SettingsPlatform } from "./settings-catalog.ts";
import { DEFAULT_SETTINGS, restoreDefaults } from "../../ui/table-settings.ts";
// The lines that name the phone's own setting follow the platform; the tests read the iOS one.
vi.mock("react-native", () => ({ Platform: { OS: "ios", select: (choices: { ios?: string; default?: string }) => choices.ios ?? choices.default } }));

const PHONE: SettingsPlatform = { haptics: true, tableList: true, saves: false, computer: false };
const COMPUTER: SettingsPlatform = { haptics: false, tableList: true, saves: true, computer: true };
const ids = (query: string, platform = PHONE) => searchSettings(query, platform).map((hit) => `${hit.kind}:${hit.id}`);

describe("the categories", () => {
  it("hold every setting, each with one home outside Accessibility but Table as a list", () => {
    const all = Object.keys(SETTING_TITLES) as SettingId[];
    const homes = CATEGORIES.filter((each) => each.id !== "accessibility").flatMap((each) => each.rows);
    expect(new Set(homes).size).toBe(homes.length);
    expect([...homes, "tableList"].sort()).toEqual([...all].sort());
    expect(homeOf("scale")).toBe("look");
    expect(homeOf("confirmTime")).toBe("playing");
    expect(homeOf("tableList")).toBe("accessibility");
  });

  it("keep Performance to the two settings that ease the device, and Keep screen awake in Playing", () => {
    expect(CATEGORIES.find((each) => each.id === "performance")?.rows).toEqual(["quality", "fog"]);
    expect(homeOf("awake")).toBe("playing");
  });

  it("show Saves only where the app backs up its saves, and Haptics only on a phone", () => {
    expect(categoriesFor(PHONE).map((each) => each.id)).not.toContain("saves");
    expect(categoriesFor(COMPUTER).map((each) => each.id)).toContain("saves");
    expect(rowsFor(PANEL_ROWS, COMPUTER)).not.toContain("haptics");
    expect(rowsFor(PANEL_ROWS, PHONE)).toContain("haptics");
    expect(isCategoryId("performance")).toBe(true);
    expect(isCategoryId("device")).toBe(false);
  });

  it("say what each is set to now", () => {
    expect(categorySummary("look", DEFAULT_SETTINGS, PHONE)).toBe("Ringwraith · Medium · Carved titles");
    expect(categorySummary("motion", DEFAULT_SETTINGS, PHONE)).toBe("Normal speed · Spotlight on · Haptics on");
    expect(categorySummary("motion", DEFAULT_SETTINGS, COMPUTER)).toBe("Normal speed · Spotlight on");
    expect(categorySummary("performance", { ...DEFAULT_SETTINGS, fogDrift: false }, PHONE)).toBe("Card pictures High · Fog still");
  });
});

describe("the table's panel", () => {
  it("keeps the settings a player changes during a game", () => {
    expect(PANEL_ROWS).toEqual(["speed", "spotlight", "bannerCloses", "haptics", "timingTips", "always"]);
  });
});

describe("the search", () => {
  it("finds nothing for an empty query", () => {
    expect(searchSettings("  ", PHONE)).toEqual([]);
  });

  it("finds a setting by the words a player uses, once, with its home", () => {
    expect(ids("vibrate")).toEqual(["setting:haptics"]);
    expect(ids("vibrate", COMPUTER)).toEqual([]);
    expect(ids("dark")).toContain("setting:theme");
    expect(searchSettings("contrast", PHONE).filter((hit) => hit.id === "contrast")).toEqual([{ kind: "setting", id: "contrast", home: "look" }]);
  });

  it("puts a setting whose name holds the query first, then the categories", () => {
    expect(ids("motion")[0]).toBe("setting:reduceMotion");
    expect(ids("motion").at(-1)).toBe("category:motion");
    expect(ids("backup")).toEqual([]);
    expect(ids("backup", COMPUTER)).toEqual(["category:saves"]);
    expect(ids("privacy")).toEqual(["category:about"]);
  });

  it("needs every word of the query", () => {
    expect(ids("screen awake")).toEqual(["setting:awake"]);
  });
});

describe("the quick setups", () => {
  it("are in use only while every setting has its value, and Restore defaults ends them", () => {
    const [read] = quickSetups(PHONE);
    if (!read) throw new Error("no setup");
    expect(setupInUse(DEFAULT_SETTINGS, read)).toBe(false);
    const used = { ...DEFAULT_SETTINGS, ...read.change };
    expect(setupInUse(used, read)).toBe(true);
    expect(setupInUse({ ...used, titleFace: "carved" }, read)).toBe(false);
    expect(setupInUse(restoreDefaults(used), read)).toBe(false);
  });

  it("ease a computer without touching Keep screen awake", () => {
    expect(quickSetups(PHONE).map((each) => each.title)).toEqual(["Easier to read", "Calm table", "Save battery"]);
    const light = quickSetups(COMPUTER)[2];
    expect(light?.title).toBe("Lighter load");
    expect(light?.change).not.toHaveProperty("keepAwake");
  });
});
