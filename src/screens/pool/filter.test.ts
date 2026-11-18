import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  applyTypeRequest,
  costOptions,
  emptyPoolFilter,
  filterPool,
  sortPool,
  filterSheetAnimation,
  packChooserRows,
  packDetail,
  packGroups,
  poolCountLine,
  shownCost,
  traitChooserRows,
  typeRequestWords,
  type PoolCard,
  type PoolPack,
} from "./filter.ts";

const packs: PoolPack[] = [
  { code: "Core", name: "Core Set", position: 1, cyclePosition: 1 },
  { code: "RevCore", name: "Revised Core", position: 2, cyclePosition: 1 },
  { code: "TBR", name: "The Black Riders", position: 1, cyclePosition: 50 },
  { code: "TRD", name: "The Road Darkens", position: 2, cyclePosition: 50 },
];

// Two collection switches (data/collection.json): one of two packs and one of a pack.
const sets = [
  { id: "core", title: "Core Set (2011)", packs: ["Core", "RevCore"] },
  { id: "lotr", title: "The Lord of the Rings", packs: ["TBR", "TRD"] },
  { id: "solo", title: "Revised", packs: ["RevCore"] },
];

function card(overrides: Partial<PoolCard> & Pick<PoolCard, "code" | "name">): PoolCard {
  return {
    typeCode: "ally",
    sphereCode: "leadership",
    packCode: "Core",
    packCodes: ["Core"],
    traits: null,
    cost: "2",
    threat: null,
    isUnique: false,
    ...overrides,
  };
}

describe("sortPool", () => {
  it("files a tagged printing under its name, after the untagged one", () => {
    const names = sortPool([
      { code: "3", name: "(MotK) Aragorn" },
      { code: "2", name: "Beorn" },
      { code: "1", name: "Aragorn" },
      { code: "4", name: "(MotK) Anborn" },
    ]).map((card) => card.name);
    expect(names).toEqual(["(MotK) Anborn", "Aragorn", "(MotK) Aragorn", "Beorn"]);
  });
});

describe("filterPool", () => {
  const groups = packGroups(sets, packs);
  const rows = [
    card({ code: "01073", name: "Gandalf", sphereCode: "neutral", traits: "Istari.", isUnique: true, packCodes: ["Core", "RevCore"] }),
    card({ code: "141002", name: "Sam Gamgee", typeCode: "hero", packCode: "TBR", packCodes: ["TBR"], traits: "Hobbit." }),
    card({ code: "01057", name: "Unexpected Courage", typeCode: "attachment", sphereCode: "spirit", cost: "5" }),
    card({
      code: "04101",
      name: "Glorfindel",
      typeCode: "hero",
      cost: null,
      threat: 5,
      packCode: "SOM",
      packCodes: ["SOM"],
    }),
    card({ code: "priced", name: "Priced", cost: "3", threat: 5, packCode: "SOM", packCodes: ["SOM"] }),
  ];

  it("filters the loaded rows in memory", () => {
    expect(groups[0]?.label).toBe("Core Set (2011)");
    expect(filterPool(rows, "courage", emptyPoolFilter, groups, new Set(), new Set()).map((row) => row.code)).toEqual(["01057"]);
    expect(
      filterPool(rows, "", { ...emptyPoolFilter, trait: "Hobbit" }, groups, new Set(), new Set()).map((row) => row.code),
    ).toEqual(["141002"]);
    expect(
      filterPool(rows, "", { ...emptyPoolFilter, trait: "Hob" }, groups, new Set(), new Set()),
    ).toEqual([]);
    expect(
      filterPool(rows, "", { ...emptyPoolFilter, pack: { kind: "set", id: "core" } }, groups, new Set(), new Set()).map(
        (row) => row.code,
      ),
    ).toEqual(["01073", "01057"]);
    expect(
      filterPool(rows, "", { ...emptyPoolFilter, unique: true }, groups, new Set(), new Set()).map((row) => row.code),
    ).toEqual(["01073"]);
    expect(
      filterPool(rows, "", { ...emptyPoolFilter, activeText: true }, groups, new Set(["01073", "141002", "04101", "priced"]), new Set()).map((row) => row.code),
    ).toEqual(["01057"]);
  });

  it("matches the number shown on the row, including a hero threat when cost is empty", () => {
    expect(shownCost({ cost: null, threat: 5 })).toBe("5");
    expect(shownCost({ cost: "3", threat: 5 })).toBe("3");
    expect(
      filterPool(rows, "", { ...emptyPoolFilter, cost: "5" }, groups, new Set(), new Set()).map((row) => row.code),
    ).toEqual(["01057", "04101"]);
    expect(costOptions(rows)).toEqual(["2", "3", "5"]);
  });
});

describe("filter choosers", () => {
  it("lists every switch and its packs (a switch of one pack is that pack), and every trait, without a sticky header", () => {
    const groups = packGroups(sets, packs);
    expect(packChooserRows(groups, null).map((row) => row.key)).toEqual(["any", "set-core", "pack-Core", "pack-RevCore", "set-lotr", "pack-TBR", "pack-TRD", "pack-RevCore"]);
    expect(packDetail({ ...emptyPoolFilter, pack: { kind: "set", id: "lotr" } }, groups)).toBe("The Lord of the Rings");
    expect(packDetail({ ...emptyPoolFilter, pack: { kind: "pack", code: "TRD" } }, groups)).toBe("The Road Darkens");
    expect(traitChooserRows(["Hobbit", "Istari"]).map((row) => row.label)).toEqual(["Any", "Hobbit", "Istari"]);
  });

  it("lists only the packs owned while My collection is on, and no switch with none of them", () => {
    const groups = packGroups(sets, packs);
    expect(packChooserRows(groups, new Set(["TBR", "TRD", "Core"])).map((row) => row.key)).toEqual(["any", "set-core", "pack-RevCore", "pack-RevCore"]);
  });

  it("opens the filter sheet with no animation when reduced motion is on", () => {
    expect(filterSheetAnimation(true)).toBe("none");
    expect(filterSheetAnimation(false)).toBe("fade");
  });
});

describe("My collection", () => {
  const groups = packGroups(sets, packs);
  const rows = [card({ code: "a", name: "Owned" }), card({ code: "b", name: "Not owned" })];

  it("hides the cards outside the collection while on, and none while off", () => {
    expect(filterPool(rows, "", emptyPoolFilter, groups, new Set(), new Set(["b"])).map((row) => row.code)).toEqual(["a"]);
    expect(filterPool(rows, "", { ...emptyPoolFilter, owned: false }, groups, new Set(), new Set(["b"])).map((row) => row.code)).toEqual(["a", "b"]);
  });

  it("is not counted on the Filter button, like the type chips", () => {
    expect(activeFilterCount({ ...emptyPoolFilter, owned: false })).toBe(0);
  });

  it("says whose cards the count is", () => {
    expect(poolCountLine(1048, true, false, 0)).toBe("1,048 cards");
    expect(poolCountLine(642, true, true, 0)).toBe("642 cards in your collection");
    expect(poolCountLine(1048, false, true, 406)).toBe("1,048 cards · 406 you don't own");
    expect(poolCountLine(1, false, true, 0)).toBe("1 card");
  });
});

describe("applyTypeRequest", () => {
  it("applies the type, clears the search and the Applied only switch, and keeps the sheet's fields", () => {
    const start = { ...emptyPoolFilter, typeCode: "ally", activeText: true, unique: true };
    expect(applyTypeRequest(start, "hero")).toEqual({ filter: { ...emptyPoolFilter, typeCode: "hero", unique: true }, search: "" });
  });

  it("treats null as All", () => {
    expect(applyTypeRequest({ ...emptyPoolFilter, typeCode: "hero" }, null).filter.typeCode).toBeNull();
  });

  it("says the type", () => {
    const types = [{ code: "hero", name: "Hero" }];
    expect(typeRequestWords(types, "hero")).toBe("Showing hero cards");
    expect(typeRequestWords(types, null)).toBe("Showing all cards");
  });
});

describe("activeFilterCount", () => {
  it("counts each field the sheet sets, not the type the chips show", () => {
    expect(activeFilterCount(emptyPoolFilter)).toBe(0);
    expect(activeFilterCount({ ...emptyPoolFilter, typeCode: "hero" })).toBe(0);
    expect(activeFilterCount({ ...emptyPoolFilter, typeCode: "hero", unique: true, pack: { kind: "pack", code: "Core" } })).toBe(2);
  });
});
