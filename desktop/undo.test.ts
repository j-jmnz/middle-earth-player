// The Undo item's script (desktop/undo.ts): the same keydown the page listens for (src/ui/key-shortcuts.ts), with the modifier of the platform.
import { describe, expect, it } from "vitest";

import { undoScript } from "./undo.ts";

describe("undoScript", () => {
  it("sends Ctrl+Z on Windows and Linux and Cmd+Z on macOS", () => {
    expect(undoScript("win32")).toContain('key: "z", ctrlKey: true, metaKey: false');
    expect(undoScript("linux")).toContain('key: "z", ctrlKey: true, metaKey: false');
    expect(undoScript("darwin")).toContain('key: "z", ctrlKey: false, metaKey: true');
  });

  it("leaves a text field to its own undo, and sends the key to the focused element or the page", () => {
    const script = undoScript("linux");
    expect(script).toContain('document.execCommand("undo")');
    expect(script).toContain("document.activeElement ?? document.body");
  });
});
