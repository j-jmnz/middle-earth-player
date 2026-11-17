// The rows of the table menu (docs/design-system-table.md, Table menu): the five things that left the top bar, the scenario's setup card and Resign. Pure, so a test
// reads the order and the words. The testIDs are the ones the controls had in the bar, so a Maestro flow taps `table-menu`
// and then the same id.
import type { IconName } from "../../ui/icon-map.ts";
import { OFFER_LINK_HINT, offerLinkLabel, offerTitle } from "../../ui/update-offer.ts";

/** What the menu needs of the table's navigation: the word the table's back control names the screen it leads to. */
export type MenuNav = { backLabel: string; backAccessibilityLabel: string };

export type MenuItemId = "update" | "leave" | "log" | "rules" | "booklet" | "setup" | "settings" | "resign";

export type MenuItem = {
  id: MenuItemId;
  // Leave the table goes rather than opens something, so its word is danger and it stands apart at the foot. The update offer is in the accent.
  tone?: "danger" | "accent";
  testID: string;
  label: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  // The printed icon the game has for the row: the One Ring before the update offer, none on the others.
  icon: IconName | null;
  // A mark drawn as views when no printed icon fits: Leave the table's door.
  glyph?: "leave";
};

/**
 * The menu's rows in order: what opens over the table (Log, Rules, Booklet, the scenario's Setup card, Table settings), Resign, then, apart at the foot, Leave the table
 * with its door mark and no more words (user request, 2026-10-27); a screen reader still hears where it goes and that the game is saved.
 * `without` leaves out the rows a game has nothing behind: Booklet for a cycle's scenario, the Setup card where there is none. `update` is the version
 * on offer (src/ui/update-offer.ts): its row heads the menu, since the table shows no update ribbon (docs/design-system-table.md, Table menu).
 */
export function menuItems(nav: MenuNav, without?: readonly MenuItemId[], update?: string | null): readonly MenuItem[] {
  const offer: MenuItem[] = update
    ? [
        {
          id: "update",
          testID: "update-open",
          label: offerTitle(update),
          accessibilityLabel: offerLinkLabel(update),
          accessibilityHint: `${OFFER_LINK_HINT}. The game is saved`,
          icon: "oneRing",
          tone: "accent",
        },
      ]
    : [];
  const rows: MenuItem[] = [
    ...offer,
    { id: "log", testID: "log-open", label: "Log", accessibilityLabel: "This round's log", icon: null },
    { id: "rules", testID: "rules-open", label: "Rules", accessibilityLabel: "Look up a rule", icon: null },
    { id: "booklet", testID: "booklet-open", label: "Booklet", accessibilityLabel: "Open the booklet", icon: null },
    // The scenario's campaign card, its Setup side, shown large (user request, 2026-11-01).
    { id: "setup", testID: "setup-card-open", label: "Setup card", accessibilityLabel: "Show the scenario's setup card", icon: null },
    { id: "settings", testID: "settings-open", label: "Table settings", accessibilityLabel: "Table settings", accessibilityHint: "Opens the table settings", icon: null },
    // Gives the scenario up: the game is lost and its outcome opens (the table asks first). Danger, like Leave the table.
    { id: "resign", testID: "resign-open", label: "Resign", accessibilityLabel: "Resign the scenario", accessibilityHint: "Ends the scenario as lost, after you confirm", icon: null, tone: "danger" },
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
  return without ? rows.filter((row) => !without.includes(row.id)) : rows;
}
