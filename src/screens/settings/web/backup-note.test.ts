// The restore's note across the reload (backup-note.ts): left once, read once, and harmless when storage is blocked.
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearRestored, peekRestored, rememberRestored, restoredLine } from "./backup-note";

function stubStorage(blocked: boolean): void {
  const held = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => {
      if (blocked) throw new Error("blocked");
      return held.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (blocked) throw new Error("blocked");
      held.set(key, value);
    },
    removeItem: (key: string) => held.delete(key),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("the restore note", () => {
  it("is left by a restore and read once", () => {
    stubStorage(false);
    expect(peekRestored()).toBeNull();
    rememberRestored("middle-earth-player-2026-11-16.backup");
    expect(peekRestored()).toBe("middle-earth-player-2026-11-16.backup");
    expect(peekRestored()).toBe("middle-earth-player-2026-11-16.backup");
    clearRestored();
    expect(peekRestored()).toBeNull();
  });

  it("is dropped without a word when storage is blocked", () => {
    stubStorage(true);
    expect(() => rememberRestored("x.backup")).not.toThrow();
    expect(peekRestored()).toBeNull();
    expect(() => clearRestored()).not.toThrow();
  });

  it("names the file and says what was replaced", () => {
    expect(restoredLine("a.backup")).toBe("Restored a.backup. Every campaign, game, deck, run and setting on this computer is now the backup's.");
  });
});
