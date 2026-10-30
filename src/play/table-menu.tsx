// The table menu (docs/design-system.md, Table, top bar): Log, Rules, Booklet, Table settings and, apart, Leave the table, in a
// popover under the menu button at the top right. React Native views over the canvas, never on the canvas. The frame, the scrim
// and the motion are the shared popover frame (popover-frame.tsx). A row closes the menu and then acts (the caller's onSelect).
// Android Back closes it first (back.ts).
import { Fragment, useRef } from "react";
import { Pressable, View } from "react-native";

import { PopoverDivider, PopoverFrame, PopoverRow, type PressableRef } from "./popover-frame.tsx";
import { MENU_BUTTON } from "./top-bar-layout.ts";
import { CONTROL_RADIUS } from "./radius.ts";
import { touch, useUiScale } from "./ui-scale.ts";
import { menuItems, type MenuItemId, type MenuNav } from "./table-menu-items.ts";
import { useTableTokens } from "./use-table-tokens.ts";

const MENU_WIDTH = 240;

/** The 44 pt button at the right of the top bar: three dots drawn as views (no printed icon fits). */
export function MenuButton({ open, onPress }: { open: boolean; onPress: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  const button = touch(s, MENU_BUTTON);
  return (
    <Pressable
      testID="table-menu"
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel="Menu"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={{ width: button, height: button, alignItems: "center", justifyContent: "center" }}
    >
      {({ pressed }) => (
        <View
          style={{ width: 40 * s, height: 40 * s, borderRadius: CONTROL_RADIUS, alignItems: "center", justifyContent: "center", gap: 4 * s, backgroundColor: pressed || open ? t.pressed : "transparent" }}
        >
          {[0, 1, 2].map((dot) => (
            <View key={dot} style={{ width: 4 * s, height: 4 * s, borderRadius: 2 * s, backgroundColor: open ? t.accent : t.bone }} />
          ))}
        </View>
      )}
    </Pressable>
  );
}

/**
 * The popover and the layer that closes it. Render it last among the table's panels so it sits over them. `top` and `right`
 * place it under the menu button, inside the safe-area insets.
 */
export function TableMenu({ open, nav, top, right, onClose, onSelect }: { open: boolean; nav: MenuNav; top: number; right: number; onClose: () => void; onSelect: (id: MenuItemId) => void }) {
  // Focus moves to the first row when the menu opens, so a screen reader starts inside it.
  const first = useRef<PressableRef>(null);
  const s = useUiScale();
  return (
    <PopoverFrame
      open={open}
      place={{ top, right }}
      width={MENU_WIDTH * s}
      origin="100% 0%"
      ids={{ layer: "table-menu-layer", scrim: "table-menu-scrim", popover: "table-menu-popover" }}
      closeLabel="Close the menu"
      focusRef={first}
      onClose={onClose}
    >
      {menuItems(nav).map((item, index) => (
        <Fragment key={item.id}>
          {/* Leaving stands apart from the rows that open something over the table. */}
          {item.id === "leave" ? <PopoverDivider /> : null}
          <PopoverRow item={item} rowRef={index === 0 ? first : undefined} onPress={() => onSelect(item.id)} />
        </Fragment>
      ))}
    </PopoverFrame>
  );
}
