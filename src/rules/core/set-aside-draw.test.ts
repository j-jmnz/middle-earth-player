// Rules: rr.in-play-and-out-of-play (data/rules/entries.json). The seeded draw of a set-aside card: the id order a seed picks among, the trait filter two verbs share, and a draw that finds none.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout } from "../../../test/harness/scene-kit.ts";
import { byId, drawRandomSetAside, withTrait } from "./set-aside-draw.ts";

describe("the seeded draw of a set-aside card", () => {
  it("orders ids by number, so i9 comes before i10", () => {
    expect(["i10", "i9", "i2"].sort(byId)).toEqual(["i2", "i9", "i10"]);
  });

  it("draws among the set-aside cards that print the trait, and nothing when none does", () => {
    const made = tableFromLayout("the-crossings-of-poros", { stage: "17157", setAside: ["16049", "16050", "17153", "16040"] });
    const deserts = [idOf(made.state, "16049"), idOf(made.state, "16050")];
    const drawn = drawRandomSetAside(made.state, withTrait(made.state, made.ctx.cards, "Desert"));
    expect(deserts).toContain(drawn);
    expect(drawRandomSetAside(made.state, withTrait(made.state, made.ctx.cards, "Mountain"))).toBeUndefined();
    expect(drawRandomSetAside(made.state, withTrait(made.state, made.ctx.cards, "Desert"))).toBe(drawn);
  });
});
