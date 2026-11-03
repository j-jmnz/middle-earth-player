// The table menu (docs/design-system-table.md, Top bar): Log, Rules, Booklet, Table settings and, apart, Leave the table, in a
// popover under the menu button at the top right. React Native views over the canvas, never on the canvas. The frame, the scrim
// and the motion are the shared popover frame (popover-frame.tsx). A row closes the menu and then acts (the caller's onSelect).
// Android Back closes it first (back.ts).
import { useRef } from "react";
import { View } from "react-native";

import { GlassIconButton } from "../../ui/buttons.tsx";
import { PopoverFrame, PopoverRow, type PressableRef } from "../../ui/popover-frame.tsx";
import { useUiScale } from "../../ui/ui-scale.ts";
import { menuItems, type MenuItemId, type MenuNav } from "./table-menu-items.ts";

const MENU_WIDTH = 240;

/** Three dots drawn as views, in the colour the button gives them. */
function DotsMark({ color }: { color: string }) {
  const s = useUiScale();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ gap: 4 * s }}>
      {[0, 1, 2].map((dot) => (
        <View key={dot} style={{ width: 4 * s, height: 4 * s, borderRadius: 2 * s, backgroundColor: color }} />
      ))}
    </View>
  );
}

/** The round glass button at the right of the top bar, 44 pt: three dots drawn as views (no printed icon fits), accent while the menu is open. */
export function MenuButton({ open, onPress }: { open: boolean; onPress: () => void }) {
  return <GlassIconButton testID="table-menu" label="Menu" expanded={open} active={open} onPress={onPress} mark={(color) => <DotsMark color={color} />} />;
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
        // Leaving stands apart from the rows that open something over the table: 8 pt of space, and its word in danger.
        <View key={item.id} style={item.id === "leave" ? { marginTop: 8 * s } : undefined}>
          <PopoverRow item={item} rowRef={index === 0 ? first : undefined} onPress={() => onSelect(item.id)} />
        </View>
      ))}
    </PopoverFrame>
  );
}
