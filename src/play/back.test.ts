import { describe, expect, it } from "vitest";

import { backStep } from "./back.ts";

describe("hardware Back on the table", () => {
  it("closes the log, then the attachment list, then folds the sheet, then leaves", () => {
    expect(backStep({ logOpen: true, inspectOpen: true, sheetOpen: true })).toBe("closeLog");
    expect(backStep({ logOpen: false, inspectOpen: true, sheetOpen: true })).toBe("closeInspect");
    expect(backStep({ logOpen: false, inspectOpen: false, sheetOpen: true })).toBe("foldSheet");
    expect(backStep({ logOpen: false, inspectOpen: false, sheetOpen: false })).toBe("leave");
  });
});
