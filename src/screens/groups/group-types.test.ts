import { describe, expect, it } from "vitest";

import { row } from "./fixtures";
import { copyBadge, copyWords, groupCard, PLAYER_TYPES, questNote, SCENARIO_TYPES, typeGroups } from "./group-types";

describe("the copy badge", () => {
  it("says the copies, and Easy Mode's where it differs", () => {
    expect(copyBadge({ copies: 1, easy: null })).toBeNull();
    expect(copyBadge({ copies: 3, easy: null })).toBe("×3");
    expect(copyBadge({ copies: 3, easy: 1 })).toBe("×3 · Easy ×1");
    expect(copyBadge({ copies: 2, easy: 0 })).toBe("×2 · Not in Easy");
    expect(copyBadge({ copies: 1, easy: 0 })).toBe("Not in Easy");
    expect(copyWords({ copies: 3, easy: 1 })).toBe("3 copies, 1 in Easy Mode");
    expect(copyWords({ copies: 1, easy: null })).toBeNull();
  });

  it("keeps Easy for the encounter deck's types, from the scenario counts, only where it differs and covers every copy", () => {
    const easy = new Map([
      ["1", { normal: 3, easy: 1 }],
      ["2", { normal: 3, easy: 3 }],
      ["3", { normal: 1, easy: 0 }],
      ["5", { normal: 2, easy: 1 }],
    ]);
    expect(groupCard(row({ code: "1", name: "A", typeCode: "enemy", quantity: 3 }), { easy }).easy).toBe(1);
    expect(groupCard(row({ code: "2", name: "B", typeCode: "enemy", quantity: 3 }), { easy }).easy).toBeNull();
    // A quest card's count is not a copy to remove, and a card the scenarios do not count whole says nothing.
    expect(groupCard(row({ code: "3", name: "C", typeCode: "quest", quantity: 1 }), { easy }).easy).toBeNull();
    expect(groupCard(row({ code: "4", name: "D", typeCode: "enemy", quantity: 3 }), { easy }).easy).toBeNull();
    expect(groupCard(row({ code: "5", name: "E", typeCode: "enemy", quantity: 4 }), { easy }).easy).toBeNull();
    expect(groupCard(row({ code: "3", name: "C", typeCode: "enemy", quantity: 1 }), { easy }).easy).toBe(0);
  });
});

describe("typeGroups", () => {
  it("puts the quest cards first, then the encounter types, each in print order, and names a type no spec holds", () => {
    const rows = [
      row({ code: "5", name: "Troll", typeCode: "enemy" }),
      row({ code: "1", name: "Stage 1", typeCode: "quest" }),
      row({ code: "3", name: "Hill", typeCode: "location" }),
      row({ code: "4", name: "Ambush", typeCode: "treachery" }),
      row({ code: "2", name: "Wolf", typeCode: "enemy" }),
      row({ code: "9", name: "Boat", typeCode: "ship-objective" }),
      row({ code: "8", name: "Sea", typeCode: "ship-enemy" }),
      row({ code: "7", name: "Banner", typeCode: "gadget", typeName: "Gadget" }),
    ];
    const groups = typeGroups(rows, SCENARIO_TYPES);
    expect(groups.map((group) => group.title)).toEqual(["Quest cards", "Enemies", "Locations", "Treacheries", "Ship cards", "Gadgets"]);
    expect(groups[1]!.cards.map((card) => card.name)).toEqual(["Wolf", "Troll"]);
    expect(groups[4]!.cards.map((card) => card.name)).toEqual(["Sea", "Boat"]);
  });
});

describe("a quest card's line and shape", () => {
  const quest = (code: string, stage: string | null, questPoints: number | null) => row({ code, name: "A Chosen Path", typeCode: "quest", stage, questPoints });

  it("names the stage and the quest points, which tell two cards of one name apart", () => {
    expect(questNote(quest("01121", "3A", 0))).toBe("Stage 3A · 0 quest points");
    expect(questNote(quest("01122", "3A", 10))).toBe("Stage 3A · 10 quest points");
    expect(questNote(quest("1", "1A", 1))).toBe("Stage 1A · 1 quest point");
    expect(questNote(quest("2", "2A", null))).toBe("Stage 2A");
    expect(questNote(quest("3", null, 4))).toBeUndefined();
    expect(questNote(row({ code: "4", name: "Wolf", typeCode: "enemy", stage: "1A", questPoints: 2 }))).toBeUndefined();
    expect(groupCard(quest("01122", "3A", 10)).note).toBe("Stage 3A · 10 quest points");
  });

  it("draws a quest card and a Nightmare setup card sideways, and no other type", () => {
    expect(groupCard(quest("1", "1A", 1)).landscape).toBe(true);
    expect(groupCard(row({ code: "2", name: "Setup", typeCode: "nightmare" })).landscape).toBe(true);
    expect(groupCard(row({ code: "3", name: "Wolf", typeCode: "enemy" })).landscape).toBe(false);
  });
});

describe("typeGroups with overlapping specs", () => {
  it("lists a type under the first heading that names it, so a card shows and counts once", () => {
    const rows = [row({ code: "1", name: "The One Ring", typeCode: "objective" }), row({ code: "2", name: "Sword", typeCode: "attachment" })];
    const groups = typeGroups(rows, [...PLAYER_TYPES, ...SCENARIO_TYPES]);
    expect(groups.map((group) => group.id)).toEqual(["attachment", "objective"]);
    expect(groups.flatMap((group) => group.cards.map((card) => card.code))).toEqual(["2", "1"]);
  });
});
