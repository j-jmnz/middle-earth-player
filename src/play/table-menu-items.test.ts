import { describe, expect, it } from "vitest";

import { menuItems } from "./table-menu-items.ts";

describe("table menu rows", () => {
  it("lists the five rows in order with the ids the bar's controls had", () => {
    const rows = menuItems({ backLabel: "Path", backAccessibilityLabel: "Back to the path" });
    expect(rows.map((row) => row.id)).toEqual(["leave", "log", "rules", "booklet", "settings"]);
    expect(rows.map((row) => row.testID)).toEqual(["table-back", "log-open", "rules-open", "booklet-open", "settings-open"]);
    expect(rows.map((row) => row.label)).toEqual(["Leave the table", "Log", "Rules", "Booklet", "Table settings"]);
  });

  it("names Leave for the path and for the scenarios, and says the game is saved", () => {
    const path = menuItems({ backLabel: "Path", backAccessibilityLabel: "Back to the path" })[0];
    const scenarios = menuItems({ backLabel: "Scenarios", backAccessibilityLabel: "Back to the scenarios" })[0];
    expect(path?.detail).toBe("To the path");
    expect(scenarios?.detail).toBe("To the scenarios");
    expect(path?.note).toBe("The game is saved");
    expect(scenarios?.accessibilityLabel).toContain("Back to the scenarios");
    expect(menuItems({ backLabel: "Path", backAccessibilityLabel: "" }).slice(1).every((row) => row.detail == null && row.note == null)).toBe(true);
  });
});
