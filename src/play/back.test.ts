import { describe, expect, it } from "vitest";

import { backStep, type BackLayers } from "./back.ts";

const none: BackLayers = { menuOpen: false, previewOpen: false, readingOpen: false, overlayOpen: false, panelOpen: false };
const all: BackLayers = { menuOpen: true, previewOpen: true, readingOpen: true, overlayOpen: true, panelOpen: true };

describe("hardware Back on the table", () => {
  it("closes the table menu before anything else, even a card preview", () => {
    expect(backStep(all)).toBe("closeMenu");
    expect(backStep({ ...none, menuOpen: true })).toBe("closeMenu");
    expect(backStep({ ...all, menuOpen: false })).toBe("closePreview");
  });

  it("closes the reading layer (the carousel and the panels included) after the preview and before anything under it", () => {
    expect(backStep({ ...all, menuOpen: false, previewOpen: false })).toBe("closeReading");
    expect(backStep({ ...none, readingOpen: true, panelOpen: true })).toBe("closeReading");
  });

  it("then puts back a sheet opened from the table, then folds the tray, then leaves", () => {
    expect(backStep({ ...none, overlayOpen: true, panelOpen: true })).toBe("closeOverlay");
    expect(backStep({ ...none, panelOpen: true })).toBe("foldPanel");
    expect(backStep(none)).toBe("leave");
  });
});
