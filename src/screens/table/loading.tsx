// The frame the table route shows while its session opens after the first paint: the table's own scene and insets with the bar's
// height kept, and Back where the bar puts its menu button (at the right), so the table replaces it without a layout jump.
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BAR_PAD, BAR_TOP, TOP_BAR } from "../../play/chrome/top-bar-layout";
import { useUiScale } from "../../ui/ui-scale";
import { IconButton, Screen } from "../kit/chrome";

/** `testID` is "table-loading" so a flow waiting for the table waits for the real one; Back keeps "table-back". */
export function TableLoading({ onBack, backLabel }: { onBack: () => void; backLabel: string }) {
  const insets = useSafeAreaInsets();
  const s = useUiScale();
  return (
    <Screen testID="table-loading" scene="table" inset={false}>
      <View className="flex-1" style={{ paddingTop: Math.max(insets.top, BAR_TOP * s), paddingLeft: insets.left, paddingRight: insets.right }}>
        <View className="flex-row items-center justify-end" style={{ height: TOP_BAR * s, paddingHorizontal: BAR_PAD }}>
          <IconButton chevron testID="table-back" label={`Back to ${backLabel}`} onPress={onBack} />
        </View>
      </View>
    </Screen>
  );
}
