import { describe, expect, it, vi } from "vitest";

import { alwaysCodes, alwaysRows, BANNER_CLOSES_WORDS, FOG_LIGHT_LINE, FOG_LINE, CONFIRM_TIME_WORDS, FOG_REDUCED_LINE, fogLine, TABLE_LIST_WORDS, NONE_YET, QUALITY_WORDS, REDUCE_MOTION_WORDS, SCALE_WORDS, SPEED_LINE, SPEED_WORDS, CONTRAST_LINE, TABLE_LIST_LINE, TITLE_FACE_LINE, THEME_LABELS, THEME_WORDS, TIMING_TIPS_LINE } from "./settings-words.ts";
import { SPEEDS } from "../../ui/motion-tokens.ts";
import { BANNER_CLOSES_OPTIONS, CARD_QUALITY_OPTIONS, CONFIRM_TIME_OPTIONS, DEFAULT_SETTINGS, TABLE_LIST_OPTIONS, REDUCE_MOTION_OPTIONS, restoreDefaults, tableSettings, THEME_OPTIONS, UI_SCALE_OPTIONS } from "../../ui/table-settings.ts";
// The lines that name the phone's own setting follow the platform; the tests read the iOS one.
vi.mock("react-native", () => ({ Platform: { OS: "ios", select: (choices: { ios?: string; default?: string }) => choices.ios ?? choices.default } }));

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
    expect(Object.keys(THEME_LABELS)).toEqual([...THEME_OPTIONS]);
    expect(Object.keys(REDUCE_MOTION_WORDS)).toEqual([...REDUCE_MOTION_OPTIONS]);
    expect(Object.keys(SCALE_WORDS)).toEqual([...UI_SCALE_OPTIONS]);
    expect(Object.keys(SPEED_WORDS)).toEqual([...SPEEDS]);
    expect(Object.keys(TABLE_LIST_WORDS)).toEqual([...TABLE_LIST_OPTIONS]);
    expect(Object.keys(CONFIRM_TIME_WORDS)).toEqual([...CONFIRM_TIME_OPTIONS]);
    expect(Object.keys(BANNER_CLOSES_WORDS)).toEqual([...BANNER_CLOSES_OPTIONS]);
    expect(SPEED_WORDS.slow).toBe("Slow");
    expect(BANNER_CLOSES_WORDS).toEqual({ timer: "After a few seconds", tap: "When tapped" });
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
  it("says why the fog is already still, else what the switch does, on Rivendell for the table alone", () => {
    expect(fogLine(false, false)).toBe(FOG_LINE);
    expect(fogLine(true, false)).toBe(FOG_LIGHT_LINE);
    expect(fogLine(false, true)).toBe(FOG_REDUCED_LINE);
    expect(fogLine(true, true)).toBe(FOG_REDUCED_LINE);
  });
});

describe("the long details", () => {
  it("name the phone's own setting and say what each choice does", () => {
    expect(CONTRAST_LINE).toContain("while Increase Contrast is on");
    expect(TABLE_LIST_LINE).toContain("only while VoiceOver is on");
    expect(TIMING_TIPS_LINE).toContain("Valour");
    expect(SPEED_LINE).toContain("one and a half times as long");
    expect(TITLE_FACE_LINE).toContain("Plain draws them in the text's face, in semibold");
  });
});
