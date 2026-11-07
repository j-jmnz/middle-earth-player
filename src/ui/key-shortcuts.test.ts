import { describe, expect, it } from "vitest";

import { keyAction } from "./key-shortcuts.ts";
import { ringStyleOf } from "./focus-ring-style.ts";

describe("keyAction", () => {
  it("maps Escape", () => {
    expect(keyAction({ key: "Escape" })).toBe("escape");
    expect(keyAction({ key: "Escape", ctrlKey: true })).toBeNull();
  });
  it("maps Z, Ctrl+Z and Cmd+Z to Undo, not Shift+Z, Alt+Z or a held key", () => {
    expect(keyAction({ key: "z" })).toBe("undo");
    expect(keyAction({ key: "z", ctrlKey: true })).toBe("undo");
    expect(keyAction({ key: "z", metaKey: true })).toBe("undo");
    expect(keyAction({ key: "Z", shiftKey: true })).toBeNull();
    expect(keyAction({ key: "z", altKey: true })).toBeNull();
    expect(keyAction({ key: "z", repeat: true })).toBeNull();
  });
  it("leaves Enter, Space and other keys to the platform", () => {
    for (const key of ["Enter", " ", "Tab", "a", "Backspace"]) expect(keyAction({ key })).toBeNull();
  });
});

describe("ringStyleOf", () => {
  it("is a 2 pt solid outline 2 pt off, scaled", () => {
    expect(ringStyleOf("#fff", 1)).toEqual({ outlineStyle: "solid", outlineColor: "#fff", outlineWidth: 2, outlineOffset: 2 });
    expect(ringStyleOf("#fff", 1.5)).toMatchObject({ outlineWidth: 3, outlineOffset: 3 });
  });
});
