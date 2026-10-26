import { describe, expect, it } from "vitest";

import { backStep } from "./back.ts";

describe("hardware Back on the table", () => {
  it("closes a reading panel, the log, then a pile's list, then a sheet opened from the table, then folds the panel, then leaves", () => {
    expect(backStep({ infoOpen: true, logOpen: true, pileOpen: true, overlayOpen: true, panelOpen: true })).toBe("closeInfo");
    expect(backStep({ logOpen: true, pileOpen: true, overlayOpen: true, panelOpen: true })).toBe("closeLog");
    expect(backStep({ logOpen: false, pileOpen: true, overlayOpen: true, panelOpen: true })).toBe("closePile");
    expect(backStep({ logOpen: false, pileOpen: false, overlayOpen: true, panelOpen: true })).toBe("closeOverlay");
    expect(backStep({ logOpen: false, pileOpen: false, overlayOpen: false, panelOpen: true })).toBe("foldPanel");
    expect(backStep({ logOpen: false, pileOpen: false, overlayOpen: false, panelOpen: false })).toBe("leave");
  });
});
