// The rows of the table menu (docs/phases/phase-19-top-bar-menu.md): the five things that left the top bar. Pure, so a test
// reads the order and the words. The testIDs are the ones the controls had in the bar, so a Maestro flow taps `table-menu`
// and then the same id.
import type { IconName } from "./icon-map.ts";

/** What the menu needs of the table's navigation: the word the table's back control names the screen it leads to. */
export type MenuNav = { backLabel: string; backAccessibilityLabel: string };

export type MenuItemId = "leave" | "log" | "rules" | "booklet" | "settings";

export type MenuItem = {
  id: MenuItemId;
  // Leave the table goes rather than opens something, so its word is danger and it stands apart at the foot.
  tone?: "danger";
  testID: string;
  label: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  // The printed icon the game has for the row. None of the five has one.
  icon: IconName | null;
  // A mark drawn as views when no printed icon fits: Leave the table's door.
  glyph?: "leave";
};

/**
 * The menu's rows in order: what opens over the table (Log, Rules, Booklet, Table settings), then, apart at the foot, Leave the table
 * with its door mark and no more words (user request, 2026-10-27); a screen reader still hears where it goes and that the game is saved.
 */
export function menuItems(nav: MenuNav): readonly MenuItem[] {
  return [
    { id: "log", testID: "log-open", label: "Log", accessibilityLabel: "This round's log", icon: null },
    { id: "rules", testID: "rules-open", label: "Rules", accessibilityLabel: "Look up a rule", icon: null },
    { id: "booklet", testID: "booklet-open", label: "Booklet", accessibilityLabel: "Open the booklet", icon: null },
    { id: "settings", testID: "settings-open", label: "Table settings", accessibilityLabel: "Table settings", accessibilityHint: "Opens the table settings", icon: null },
    {
      id: "leave",
      testID: "table-back",
      label: "Leave the table",
      accessibilityLabel: `Leave the table. ${nav.backAccessibilityLabel}`,
      accessibilityHint: "The game is saved",
      icon: null,
      glyph: "leave",
      tone: "danger",
    },
  ];
}
