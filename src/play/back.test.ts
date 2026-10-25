import { describe, expect, it } from "vitest";

import { backStep } from "./back.ts";

describe("hardware Back on the table", () => {
  it("closes the log, then a pile's list, then a sheet opened from the table, then folds the panel, then leaves", () => {
    expect(backStep({ logOpen: true, pileOpen: true, overlayOpen: true, panelOpen: true })).toBe("closeLog");
    expect(backStep({ logOpen: false, pileOpen: true, overlayOpen: true, panelOpen: true })).toBe("closePile");
    expect(backStep({ logOpen: false, pileOpen: false, overlayOpen: true, panelOpen: true })).toBe("closeOverlay");
    expect(backStep({ logOpen: false, pileOpen: false, overlayOpen: false, panelOpen: true })).toBe("foldPanel");
    expect(backStep({ logOpen: false, pileOpen: false, overlayOpen: false, panelOpen: false })).toBe("leave");
  });
});
