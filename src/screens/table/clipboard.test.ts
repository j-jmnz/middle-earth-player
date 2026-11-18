import { afterEach, describe, expect, it, vi } from "vitest";

import { copyText } from "./clipboard";

// Copy game state's clipboard write (docs/design-system-table.md, Table menu).
describe("copyText", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes the text to the browser's clipboard and says it did", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyText("state")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("state");
  });

  it("answers false with no clipboard to write to, and when the write is refused", async () => {
    vi.stubGlobal("navigator", {});
    expect(await copyText("state")).toBe(false);
    vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
    expect(await copyText("state")).toBe(false);
  });
});
