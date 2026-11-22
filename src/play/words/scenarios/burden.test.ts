// Rules: rr.modifiers (data/rules/entries.json). The words of SetStatUntil name whose stat it sets: the Ring-bearer's, the attached hero's, or each matching character's.
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { burdenWords } from "./burden.ts";

type SetStat = Extract<Instruction, { verb: "SetStatUntil" }>;
const set = (holders: SetStat["holders"]) => burdenWords({ verb: "SetStatUntil", stat: "willpower", value: 0, until: "endOfRound", holders }, (code) => code);

describe("SetStatUntil in words", () => {
  it("names the Ring-bearer, the attached hero or the matching characters", () => {
    expect(set({ type: "hero", control: "any", trait: "Ring-bearer" })).toBe("reduce the Ring-bearer's willpower to 0 until the end of the round");
    expect(set({ type: "hero", control: "any", isHost: true })).toBe("reduce the attached hero's willpower to 0 until the end of the round");
    expect(set({ type: "ally", control: "any" })).toBe("reduce each matching character's willpower to 0 until the end of the round");
  });
});
