// A row of the Collection screens (docs/design-system.md, Collection): the name and its line open what it holds, and the switch at its
// end, a 44 pt target of its own, says whether the player owns it. Partly owned (some packs of a cycle) reads as off with its line
// saying how many packs, and is heard as mixed; a tap on it owns the whole.
import { useState } from "react";
import { Pressable, View } from "react-native";

import type { SetOwnership } from "../../catalog/collection";
import { Chevron } from "../kit/chrome";
import { usePalette } from "../kit/palette-hook";
import { SwitchMark } from "../../ui/setting-switch";
import { rowSurface } from "../../ui/surfaces";
import { Text } from "../../ui/text";
import { touch, useUiScale } from "../../ui/ui-scale";
import { useTableTokens } from "../../ui/use-table-tokens";

export function OwnedRow({
  label,
  detail,
  ownership,
  onSwitch,
  onOpen,
  openHint,
  testID,
}: {
  label: string;
  detail: string;
  ownership: SetOwnership;
  onSwitch: (owned: boolean) => void;
  onOpen: () => void;
  // What opening the row shows ("Shows its packs").
  openHint: string;
  testID: string;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const [pressed, setPressed] = useState(false);
  const on = ownership === "all";
  const checked = ownership === "some" ? "mixed" : on;
  return (
    <View className="mb-1.5 min-h-14 flex-row items-center overflow-hidden rounded-item" style={rowSurface(pressed, t)}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${detail}`}
        accessibilityHint={openHint}
        onPress={onOpen}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        className="flex-1 flex-row items-center py-2"
        style={{ paddingLeft: 14 * s, gap: 10 * s }}
      >
        <View className="flex-1" importantForAccessibility="no-hide-descendants">
          <Text className={`font-display text-heading ${on ? "text-bone" : "text-muted"}`}>{label}</Text>
          <Text className="mt-0.5 text-label text-muted">{detail}</Text>
        </View>
        <Chevron direction="right" color={palette.faint} size={8} />
      </Pressable>
      <Pressable
        testID={`${testID}-owned`}
        accessibilityRole="switch"
        accessibilityLabel={`Own ${label}`}
        accessibilityState={{ checked }}
        aria-checked={checked}
        onPress={() => onSwitch(!on)}
        className="items-center justify-center"
        style={{ minHeight: touch(s, 44), paddingLeft: 10 * s, paddingRight: 12 * s }}
      >
        <SwitchMark value={on} paper={false} />
      </Pressable>
    </View>
  );
}
