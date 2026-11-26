// Rules: hrd.orcs-area, hrd.orcs-area-different-stage (data/rules/entries.json); ledger lines 17044:A:2, 16064:A:1, 17048:A:1. The rows of a pick that can reach the Orcs' area say where each enemy stands, and the Warg-rider's two branches warn what each does.
import { describe, expect, it } from "vitest";

import { idOf } from "../../../test/harness/scene-kit.ts";
import { advancedTo, CHIEFTAIN, prepared } from "../../rules/families/haradrim/race-kit.ts";
import { ASKS } from "../words/asks/race-across-harad.ts";

import { orcsLabel } from "./orcs-label.ts";
import type { SheetNames } from "./sheet-types.ts";

describe("17044:A:2 16064:A:1 each row of a Warg's pick says where its enemy stands", () => {
  it("an Orc in the Orcs' area, in the staging area and engaged each name their place, and a pick that cannot reach the area changes nothing", () => {
    const { made, state } = prepared({ staging: ["16062"], engaged: [{ code: "16062", seat: 1 }], seats: 2 });
    const names = { card: (id: string) => made.ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id } as SheetNames;
    const chieftain = idOf(state, CHIEFTAIN);
    const [staged, engaged] = Object.values(state.cards).filter((card) => card.code === "16062").map((card) => card.id);
    const options = [chieftain, staged ?? "", engaged ?? ""];
    expect(orcsLabel(state, names, chieftain, options)).toBe("Uruk Chieftain · Orcs' area");
    expect(orcsLabel(state, names, staged ?? "", options)).toBe("Uruk of Mordor · staging area");
    expect(orcsLabel(state, names, engaged ?? "", options)).toBe("Uruk of Mordor · engaged with Player 2");
    expect(orcsLabel(state, names, staged ?? "", [staged ?? "", engaged ?? ""])).toBeUndefined();
    expect(advancedTo(made, state, 1)).toBe(state);
  });
});

describe("17048:A:1 the Warg-rider's branches warn what each does", () => {
  it("each branch has a caution that always holds and says what the Warg-rider's Threat does", () => {
    const staging = ASKS["17048:whenRevealed:1 @0 staging"];
    const orcs = ASKS["17048:whenRevealed:1 @0 orcsArea"];
    expect(staging?.caution?.text).toBe("Tap again: its 3 Threat counts now and you can engage it.");
    expect(JSON.stringify(orcs?.caution?.text)).toContain("out of reach while you are apart");
    expect(JSON.stringify(orcs?.caution?.text)).toContain("adds to the Orcs' progress");
    expect(staging?.caution?.when).toEqual({ kind: "all", conditions: [] });
  });
});
