import { describe, expect, it } from "vitest";

import { lootDeckWords, lootGuardWords } from "./loot.ts";

describe("loot pills (22024:B:2)", () => {
  it("names the guarded attachments", () => {
    expect(lootGuardWords(["Elven Mail", "Ring Mail"])).toEqual({ text: "2 loot", loses: false, speech: "Elven Mail and Ring Mail guarding it as loot" });
  });

  it("counts the loot deck", () => {
    expect(lootDeckWords(1).speech).toBe("1 card left in the loot deck");
    expect(lootDeckWords(0)).toEqual({ text: "0 left", loses: false, speech: "No cards left in the loot deck" });
  });
});
