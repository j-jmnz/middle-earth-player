// The rows of the table menu (docs/phases/phase-19-top-bar-menu.md): the five things that left the top bar. Pure, so a test
// reads the order and the words. The testIDs are the ones the controls had in the bar, so a Maestro flow taps `table-menu`
// and then the same id.
import type { IconName } from "./icon-map.ts";

/** What the menu needs of the table's navigation: the word the table's back control names the screen it leads to. */
export type MenuNav = { backLabel: string; backAccessibilityLabel: string };

export type MenuItemId = "leave" | "log" | "rules" | "booklet" | "settings";

export type MenuItem = {
  id: MenuItemId;
  // The row opens a screen or a panel (a chevron); Leave the table goes, and stands apart at the foot.
  opens: boolean;
  testID: string;
  label: string;
  // Beside the label, muted: where Leave goes.
  detail?: string;
  // A muted line under the label, inside the row.
  note?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  // The printed icon the game has for the row. None of the five has one.
  icon: IconName | null;
};

/**
 * The menu's rows in order: what opens over the table (Log, Rules, Booklet, Table settings), then, apart at the foot, Leave the table,
 * named for the screen it goes to (user request, 2026-10-27: the menu redesigned).
 */
export function menuItems(nav: MenuNav): readonly MenuItem[] {
  return [
    { id: "log", testID: "log-open", label: "Log", accessibilityLabel: "This round's log", icon: null, opens: true },
    { id: "rules", testID: "rules-open", label: "Rules", accessibilityLabel: "Look up a rule", icon: null, opens: true },
    { id: "booklet", testID: "booklet-open", label: "Booklet", accessibilityLabel: "Open the booklet", icon: null, opens: true },
    { id: "settings", testID: "settings-open", label: "Table settings", accessibilityLabel: "Table settings", accessibilityHint: "Opens the table settings", icon: null, opens: true },
    {
      id: "leave",
      testID: "table-back",
      label: "Leave the table",
      detail: `To the ${nav.backLabel.toLowerCase()}`,
      note: "The game is saved",
      accessibilityLabel: `Leave the table. ${nav.backAccessibilityLabel}`,
      accessibilityHint: "The game is saved",
      icon: null,
      opens: false,
    },
  ];
}
