import { describe, expect, it } from "vitest";

import type { CollectionSet } from "../../catalog/collection";
import { collectionRows, collectionTally, setCardCounts, setDetail } from "./view";

const angmar: CollectionSet = { id: "angmar", heading: "Angmar Awakened", name: "The Lost Realm and six Adventure Packs", title: "Angmar Awakened", detail: "Or the Hero Expansion", packs: ["TLR", "WoE"] };
const campaign: CollectionSet = { id: "aace", heading: "Angmar Awakened", name: "Campaign Expansion", title: "Angmar Awakened Campaign Expansion", detail: null, packs: ["AACE"] };
const core: CollectionSet = { id: "core", heading: "Core Set", name: "Core Set", title: "Core Set", detail: "2011", packs: ["Core"] };

describe("Collection words", () => {
  it("puts each heading before its sets and pins the headings", () => {
    const { rows, sticky } = collectionRows([angmar, campaign, core]);
    expect(rows.map((row) => (row.kind === "heading" ? row.title : row.set.id))).toEqual(["Angmar Awakened", "angmar", "aace", "Core Set", "core"]);
    expect(sticky).toEqual([0, 3]);
  });

  it("counts a card once in each set it is printed in", () => {
    const counts = setCardCounts(
      [
        { packCode: "TLR", packCodes: ["TLR", "WoE"] },
        { packCode: "Core", packCodes: ["Core", "AACE"] },
        { packCode: "WoE", packCodes: [] },
      ],
      [angmar, campaign, core],
    );
    expect(Object.fromEntries(counts)).toEqual({ angmar: 2, aace: 1, core: 1 });
  });

  it("says the detail, or how many packs are owned while only some are", () => {
    expect(setDetail(angmar, "all", new Set(), 75)).toBe("Or the Hero Expansion · 75 player cards");
    expect(setDetail(angmar, "some", new Set(["WoE"]), 75)).toBe("1 of 2 packs owned · 75 player cards");
    expect(setDetail(campaign, "none", new Set(["AACE"]), 1)).toBe("1 player card");
  });

  it("tallies what is owned", () => {
    expect(collectionTally([angmar, campaign, core], new Set(), 1048)).toBe("Everything owned · 1,048 player cards");
    expect(collectionTally([angmar, campaign, core], new Set(["WoE", "Core"]), 642)).toBe("2 of 3 owned · 642 player cards");
  });
});
