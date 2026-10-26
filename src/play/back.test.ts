import { describe, expect, it } from "vitest";

import { backStep, type BackLayers } from "./back.ts";

const none: BackLayers = { menuOpen: false, previewOpen: false, infoOpen: false, logOpen: false, pileOpen: false, overlayOpen: false, panelOpen: false };
const all: BackLayers = { menuOpen: true, previewOpen: true, infoOpen: true, logOpen: true, pileOpen: true, overlayOpen: true, panelOpen: true };

describe("hardware Back on the table", () => {
  it("closes the table menu before anything else, even a card preview", () => {
    expect(backStep(all)).toBe("closeMenu");
    expect(backStep({ ...none, menuOpen: true })).toBe("closeMenu");
    expect(backStep({ ...all, menuOpen: false })).toBe("closePreview");
  });

  it("closes a reading panel, the log, then a pile's list, then a sheet opened from the table, then folds the panel, then leaves", () => {
    expect(backStep({ ...all, menuOpen: false, previewOpen: false })).toBe("closeInfo");
    expect(backStep({ ...all, menuOpen: false, previewOpen: false, infoOpen: false })).toBe("closeLog");
    expect(backStep({ ...none, pileOpen: true, overlayOpen: true, panelOpen: true })).toBe("closePile");
    expect(backStep({ ...none, overlayOpen: true, panelOpen: true })).toBe("closeOverlay");
    expect(backStep({ ...none, panelOpen: true })).toBe("foldPanel");
    expect(backStep(none)).toBe("leave");
  });
});
