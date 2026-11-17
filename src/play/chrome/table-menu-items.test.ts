import { describe, expect, it } from "vitest";

import { menuItems } from "./table-menu-items.ts";

describe("table menu rows", () => {
  it("lists the rows in order with the ids the bar's controls had, the Setup card after the Booklet, Resign before Leave, Leave the table apart at the foot", () => {
    const rows = menuItems({ backLabel: "Path", backAccessibilityLabel: "Back to the path" });
    expect(rows.map((row) => row.id)).toEqual(["log", "rules", "booklet", "setup", "settings", "resign", "leave"]);
    expect(rows.map((row) => row.testID)).toEqual(["log-open", "rules-open", "booklet-open", "setup-card-open", "settings-open", "resign-open", "table-back"]);
    expect(rows.map((row) => row.label)).toEqual(["Log", "Rules", "Booklet", "Setup card", "Table settings", "Resign", "Leave the table"]);
    expect(rows.map((row) => row.tone)).toEqual([undefined, undefined, undefined, undefined, undefined, "danger", "danger"]);
  });

  it("leaves out the rows a game has nothing behind: no Booklet and no Setup card for a cycle's scenario on Normal", () => {
    const rows = menuItems({ backLabel: "Scenarios", backAccessibilityLabel: "Back to the scenarios" }, ["booklet", "setup"]);
    expect(rows.map((row) => row.id)).toEqual(["log", "rules", "settings", "resign", "leave"]);
  });

  it("shows Leave the table with its door mark alone, and says where it goes and that the game is saved to a screen reader", () => {
    const leave = (backLabel: string, backAccessibilityLabel: string) => menuItems({ backLabel, backAccessibilityLabel }).find((row) => row.id === "leave");
    const scenarios = leave("Scenarios", "Back to the scenarios");
    expect(scenarios?.label).toBe("Leave the table");
    expect(scenarios?.glyph).toBe("leave");
    expect(scenarios?.accessibilityLabel).toContain("Back to the scenarios");
    expect(scenarios?.accessibilityHint).toBe("The game is saved");
    expect(menuItems({ backLabel: "Path", backAccessibilityLabel: "" }).filter((row) => row.id !== "leave").every((row) => row.glyph == null)).toBe(true);
  });
});
