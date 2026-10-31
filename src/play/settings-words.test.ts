import { describe, expect, it } from "vitest";

import { alwaysCodes, alwaysRows, FOG_LIGHT_LINE, FOG_LINE, FOG_REDUCED_LINE, fogLine, NONE_YET, QUALITY_WORDS, REDUCE_MOTION_WORDS, SCALE_WORDS, SPEED_WORDS, THEME_WORDS } from "./settings-words.ts";
import { SPEEDS } from "./motion-tokens.ts";
import { CARD_QUALITY_OPTIONS, DEFAULT_SETTINGS, REDUCE_MOTION_OPTIONS, restoreDefaults, tableSettings, THEME_OPTIONS, UI_SCALE_OPTIONS } from "./table-settings.ts";

const effects = [
  { id: "sam.ready", cardCode: "01015" },
  { id: "pippin.draw", cardCode: "02001" },
];
const names = new Map([["01015", "Sam Gamgee"]]);

describe("the Responses list", () => {
  it("names each response by its card and falls back to the id", () => {
    expect(alwaysRows(["sam.ready", "pippin.draw", "gone.id"], effects, (code) => names.get(code))).toEqual([
      { effectId: "sam.ready", label: "Sam Gamgee" },
      { effectId: "pippin.draw", label: "pippin.draw" },
      { effectId: "gone.id", label: "gone.id" },
    ]);
  });

  it("puts the panel's prefix before each label", () => {
    expect(alwaysRows(["sam.ready"], effects, (code) => names.get(code), "Ask again: ")[0]?.label).toBe("Ask again: Sam Gamgee");
  });

  it("is empty when nothing is always used, and asks for each card once", () => {
    expect(alwaysRows([], effects, () => undefined)).toEqual([]);
    expect(alwaysCodes([], effects)).toEqual([]);
    expect(alwaysCodes(["sam.ready", "sam.ready", "unknown"], effects)).toEqual(["01015"]);
    expect(NONE_YET).toBe("None yet");
  });
});

describe("the words of each choice", () => {
  it("has a word for every option", () => {
    expect(Object.keys(THEME_WORDS)).toEqual([...THEME_OPTIONS]);
    expect(Object.keys(REDUCE_MOTION_WORDS)).toEqual([...REDUCE_MOTION_OPTIONS]);
    expect(Object.keys(SCALE_WORDS)).toEqual([...UI_SCALE_OPTIONS]);
    expect(Object.keys(SPEED_WORDS)).toEqual([...SPEEDS]);
    expect(Object.keys(QUALITY_WORDS)).toEqual([...CARD_QUALITY_OPTIONS]);
  });
});

describe("the guide and Restore defaults", () => {
  it("turning the guide on writes guideSeen {}, and restoring keeps guideSeen", () => {
    tableSettings.getState().hydrate({ ...DEFAULT_SETTINGS, guide: false, guideSeen: { "3.3": 2 } });
    // The Settings screen and the panel send this change when the guide switches on.
    tableSettings.getState().update({ guide: true, guideSeen: {} });
    expect(tableSettings.getState().settings).toMatchObject({ guide: true, guideSeen: {} });
    const restored = restoreDefaults({ ...DEFAULT_SETTINGS, uiScale: "large", theme: "light", guideSeen: { "3.3": 2 } });
    expect(restored).toEqual({ ...DEFAULT_SETTINGS, guideSeen: { "3.3": 2 } });
    tableSettings.getState().hydrate(DEFAULT_SETTINGS);
  });
});

describe("the Moving fog row's detail", () => {
  it("says why the fog is already still, else what the switch does", () => {
    expect(fogLine(false, false)).toBe(FOG_LINE);
    expect(fogLine(true, false)).toBe(FOG_LIGHT_LINE);
    expect(fogLine(false, true)).toBe(FOG_REDUCED_LINE);
    expect(fogLine(true, true)).toBe(FOG_LIGHT_LINE);
  });
});
