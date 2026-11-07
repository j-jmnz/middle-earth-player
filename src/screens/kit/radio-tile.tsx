import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { rowSurface, selectedRingOf, selectedWash } from "../../ui/surfaces";
import { useTableTokens } from "../../ui/use-table-tokens";

/**
 * One choice of a group the player picks one from: the silver ring and wash when chosen, a row's surface when not (never the accent
 * plate, which is the button's). `min-h-14` keeps the 44 pt target; the words wrap.
 */
export function RadioTile({ selected, testID, label, onPress, className, children }: { selected: boolean; testID: string; label: string; onPress: () => void; className: string; children: ReactNode }) {
  const t = useTableTokens();
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      className={className.includes("flex-1") ? "flex-1" : undefined}
    >
      {/* The surface is on a view inside: NativeWind drops a style function on a Pressable that also has a className. */}
      {({ pressed }) => (
        <View className={className} style={selected ? { ...rowSurface(false, t), ...selectedWash(t), boxShadow: selectedRingOf(t, 1.5) } : rowSurface(pressed, t)}>
          {children}
        </View>
      )}
    </Pressable>
  );
}
