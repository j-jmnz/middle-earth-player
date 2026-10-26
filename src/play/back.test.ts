import { describe, expect, it } from "vitest";

import { backStep, type BackLayers } from "./back.ts";

const none: BackLayers = { menuOpen: false, moreOpen: false, linesOpen: false, previewOpen: false, readingOpen: false, overlayOpen: false, panelOpen: false };
const all: BackLayers = { menuOpen: true, moreOpen: true, linesOpen: false, previewOpen: true, readingOpen: true, overlayOpen: true, panelOpen: true };

describe("hardware Back on the table", () => {
  it("closes the table menu before anything else, even a card preview", () => {
    expect(backStep(all)).toBe("closeMenu");
    expect(backStep({ ...none, menuOpen: true })).toBe("closeMenu");
    expect(backStep({ ...all, menuOpen: false, moreOpen: false })).toBe("closePreview");
  });

  it("closes the dock's More popover the way it closes the menu: before the preview, the reading layer, the sheet and the tray", () => {
    expect(backStep({ ...all, menuOpen: false })).toBe("closeMore");
    expect(backStep({ ...none, moreOpen: true, panelOpen: true })).toBe("closeMore");
    expect(backStep({ ...none, moreOpen: true, linesOpen: true, previewOpen: true, readingOpen: true, overlayOpen: true })).toBe("closeMore");
    expect(backStep({ ...all, menuOpen: false, moreOpen: false })).toBe("closePreview");
  });

  it("closes the dock's \"i\" popover next to the More popover: before the preview, the reading layer, the sheet and the tray, after the menu", () => {
    expect(backStep({ ...none, linesOpen: true, panelOpen: true })).toBe("closeLines");
    expect(backStep({ ...none, linesOpen: true, previewOpen: true, readingOpen: true, overlayOpen: true })).toBe("closeLines");
    expect(backStep({ ...none, linesOpen: true, menuOpen: true })).toBe("closeMenu");
    expect(backStep({ ...all, menuOpen: false })).toBe("closeMore");
  });

  it("closes the menu before the tray when only the tray is under it", () => {
    expect(backStep({ ...none, menuOpen: true, panelOpen: true })).toBe("closeMenu");
  });

  it("closes the reading layer (the carousel and the panels included) after the preview and before anything under it", () => {
    expect(backStep({ ...all, menuOpen: false, moreOpen: false, linesOpen: false, previewOpen: false })).toBe("closeReading");
    expect(backStep({ ...none, readingOpen: true, panelOpen: true })).toBe("closeReading");
  });

  it("then puts back a sheet opened from the table, then folds the tray, then leaves", () => {
    expect(backStep({ ...none, overlayOpen: true, panelOpen: true })).toBe("closeOverlay");
    expect(backStep({ ...none, panelOpen: true })).toBe("foldPanel");
    expect(backStep(none)).toBe("leave");
  });
});
