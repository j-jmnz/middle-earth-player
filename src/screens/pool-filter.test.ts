import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  applyTypeRequest,
  costOptions,
  cycleGroups,
  emptyPoolFilter,
  filterPool,
  sortPool,
  filterSheetAnimation,
  packChooserRows,
  shownCost,
  traitChooserRows,
  typeRequestWords,
  type PoolCard,
  type PoolPack,
} from "./pool-filter.ts";

const packs: PoolPack[] = [
  { code: "Core", name: "Core Set", position: 1, cyclePosition: 1 },
  { code: "RevCore", name: "Revised Core", position: 2, cyclePosition: 1 },
  { code: "TBR", name: "The Black Riders", position: 1, cyclePosition: 50 },
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
  const groups = cycleGroups(packs);
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
    expect(groups[0]?.label).toBe("Core Set");
    expect(filterPool(rows, "courage", emptyPoolFilter, groups, new Set()).map((row) => row.code)).toEqual(["01057"]);
    expect(
      filterPool(rows, "", { ...emptyPoolFilter, trait: "Hobbit" }, groups, new Set()).map((row) => row.code),
    ).toEqual(["141002"]);
    expect(
      filterPool(rows, "", { ...emptyPoolFilter, trait: "Hob" }, groups, new Set()),
    ).toEqual([]);
    expect(
      filterPool(rows, "", { ...emptyPoolFilter, pack: { kind: "cycle", cyclePosition: 1 } }, groups, new Set()).map(
        (row) => row.code,
      ),
    ).toEqual(["01073", "01057"]);
    expect(
      filterPool(rows, "", { ...emptyPoolFilter, unique: true }, groups, new Set()).map((row) => row.code),
    ).toEqual(["01073"]);
    expect(
      filterPool(rows, "", { ...emptyPoolFilter, activeText: true }, groups, new Set(["01073", "141002", "04101", "priced"])).map((row) => row.code),
    ).toEqual(["01057"]);
  });

  it("matches the number shown on the row, including a hero threat when cost is empty", () => {
    expect(shownCost({ cost: null, threat: 5 })).toBe("5");
    expect(shownCost({ cost: "3", threat: 5 })).toBe("3");
    expect(
      filterPool(rows, "", { ...emptyPoolFilter, cost: "5" }, groups, new Set()).map((row) => row.code),
    ).toEqual(["01057", "04101"]);
    expect(costOptions(rows)).toEqual(["2", "3", "5"]);
  });
});

describe("filter choosers", () => {
  it("lists every cycle and pack, and every trait, without a sticky header", () => {
    const groups = cycleGroups(packs);
    expect(packChooserRows(groups).map((row) => row.key)).toEqual([
      "any",
      "cycle-1",
      "pack-Core",
      "pack-RevCore",
      "cycle-50",
      "pack-TBR",
    ]);
    expect(traitChooserRows(["Hobbit", "Istari"]).map((row) => row.label)).toEqual(["Any", "Hobbit", "Istari"]);
  });

  it("opens the filter sheet with no animation when reduced motion is on", () => {
    expect(filterSheetAnimation(true)).toBe("none");
    expect(filterSheetAnimation(false)).toBe("fade");
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
