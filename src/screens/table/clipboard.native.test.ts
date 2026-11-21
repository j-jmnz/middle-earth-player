import { describe, expect, it, vi } from "vitest";

import { copyText } from "./clipboard.native";

const clipboard = vi.hoisted(() => ({ write: (_text: string) => Promise.resolve(true) }));
vi.mock("expo-clipboard", () => ({ setStringAsync: (text: string) => clipboard.write(text) }));

// Copy game state's clipboard write on a phone (docs/design-system-table.md, Table menu).
describe("copyText on a phone", () => {
  it("writes the text through expo-clipboard and says it did", async () => {
    const write = vi.fn(() => Promise.resolve(true));
    clipboard.write = write;
    expect(await copyText("state")).toBe(true);
    expect(write).toHaveBeenCalledWith("state");
  });

  it("answers false when the write is refused or fails", async () => {
    clipboard.write = () => Promise.resolve(false);
    expect(await copyText("state")).toBe(false);
    clipboard.write = () => Promise.reject(new Error("denied"));
    expect(await copyText("state")).toBe(false);
  });
});
