import { describe, expect, it } from "vitest";

import type { PoolCard } from "../campaign/log";
import { carrySource, carryWords } from "./carry-words.ts";

const card = (code: string, extra: Partial<PoolCard> = {}): PoolCard => ({ code, back: "player", burdenSet: null, attachedTo: null, seat: null, ...extra });
const names: Record<string, string> = { m: "Mendor", s: "Mendor's Support" };
const nameOf = (code: string) => names[code] ?? code;

describe("carryWords", () => {
  it("collapses duplicates and says a copy for each player", () => {
    expect(carryWords([card("m"), card("s", { perPlayer: true })], nameOf)).toBe("Mendor and a Mendor's Support for each player");
    expect(carryWords([card("s", { seat: 0 }), card("s", { seat: 1 })], nameOf)).toBe("2 copies of Mendor's Support");
    expect(carryWords([card("m")], nameOf)).toBe("Mendor");
  });
});

describe("carrySource", () => {
  it("names the seats, the finish date and the score", () => {
    expect(carrySource("Two-handed", Date.UTC(2026, 9, 24, 12), 41)).toBe("Two-handed · finished 24 Oct · score 41");
    expect(carrySource("True solo", null, 7)).toBe("True solo · score 7");
  });
});
