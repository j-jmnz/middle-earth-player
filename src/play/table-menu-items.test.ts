import { describe, expect, it } from "vitest";

import { menuItems } from "./table-menu-items.ts";

describe("table menu rows", () => {
  it("lists the five rows in order with the ids the bar's controls had, Leave the table apart at the foot", () => {
    const rows = menuItems({ backLabel: "Path", backAccessibilityLabel: "Back to the path" });
    expect(rows.map((row) => row.id)).toEqual(["log", "rules", "booklet", "settings", "leave"]);
    expect(rows.map((row) => row.testID)).toEqual(["log-open", "rules-open", "booklet-open", "settings-open", "table-back"]);
    expect(rows.map((row) => row.label)).toEqual(["Log", "Rules", "Booklet", "Table settings", "Leave the table"]);
    expect(rows.map((row) => row.opens)).toEqual([true, true, true, true, false]);
  });

  it("names Leave for the path and for the scenarios, and says the game is saved", () => {
    const leave = (backLabel: string, backAccessibilityLabel: string) => menuItems({ backLabel, backAccessibilityLabel }).find((row) => row.id === "leave");
    const path = leave("Path", "Back to the path");
    const scenarios = leave("Scenarios", "Back to the scenarios");
    expect(path?.detail).toBe("To the path");
    expect(scenarios?.detail).toBe("To the scenarios");
    expect(path?.note).toBe("The game is saved");
    expect(scenarios?.accessibilityLabel).toContain("Back to the scenarios");
    expect(menuItems({ backLabel: "Path", backAccessibilityLabel: "" }).filter((row) => row.id !== "leave").every((row) => row.detail == null && row.note == null)).toBe(true);
  });
});
