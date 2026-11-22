// A ListRow whose trailing control is a button of its own (a CountStepper): the row's press is a layer under the content and the trailing control sits beside it, never inside it,
// so no button holds another (docs/design-system.md, Components, List row). The look, the hit areas and the long press are the plain row's; the layer carries the row's name for a screen reader, which skips the text over it.
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { longPressA11y } from "../../ui/long-press-action";
import { withSound } from "../../ui/sound/sound";
import { rowSurface, selectedWash } from "../../ui/surfaces";
import { Text } from "../../ui/text";
import { useTableTokens } from "../../ui/use-table-tokens";
import { useUiScale } from "../../ui/ui-scale";
import { usePalette } from "./palette-hook";

export function SplitListRow({
  label,
  detail,
  onPress,
  onLongPress,
  longPressLabel,
  testID,
  leading,
  trailing,
  detailIcons,
  selected,
}: {
  label: string;
  detail?: string;
  onLongPress?: () => void;
  longPressLabel: string;
  detailIcons?: ReactNode;
  onPress: () => void;
  testID: string;
  leading?: ReactNode;
  trailing: ReactNode;
  selected?: boolean;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View className="mb-1.5">
      <View className="min-h-14 flex-row items-center overflow-hidden rounded-item py-2" style={{ paddingLeft: 14 * s, paddingRight: 10 * s }}>
        <Pressable
          testID={testID}
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={detail ? `${label}, ${detail}` : label}
          accessibilityState={selected == null ? undefined : { selected }}
          {...(onLongPress ? longPressA11y(longPressLabel, onLongPress) : null)}
          onPress={withSound(onPress, "ui.confirm")}
          onLongPress={onLongPress}
          delayLongPress={350}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        >
          {({ pressed }) => <View style={{ flex: 1, ...(selected ? selectedWash(t) : rowSurface(pressed, t)) }} />}
        </Pressable>
        {selected ? <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3 * s, backgroundColor: palette.accentHigh }} /> : null}
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="flex-1 flex-row items-center">
          {leading ? <View className="mr-3">{leading}</View> : null}
          <View className="flex-1">
            <Text className={`font-display text-heading ${selected ? "text-accentHigh" : "text-bone"}`}>{label}</Text>
            {detail ? (
              <View className="mt-0.5 flex-row items-center gap-1.5">
                {detailIcons}
                <Text className="shrink text-label text-muted">{detail}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {trailing}
      </View>
    </View>
  );
}
