// The in-place question that stands before cards which show what a scenario or a campaign holds (docs/design-system.md, Card groups): the card-group
// route and the Cards tab's pane, the briefing's "All quest cards" and the campaign setup's Quest cards all draw it, so it looks the same
// everywhere. Show is the dominant control, a secondary capsule in the accent; Not now is a muted text button beside it. `<testID>` is the block,
// `<testID>-show` and `<testID>-cancel` its two buttons.
import { View } from "react-native";

import { Text } from "../../ui/text";
import { SecondaryButton, TextButton } from "./chrome-buttons";

export function SpoilerAsk({ testID, text, showLabel, onShow, onCancel, className }: { testID: string; text: string; showLabel: string; onShow: () => void; onCancel: () => void; className?: string }) {
  return (
    <View testID={testID} className={`gap-2 ${className ?? "mt-3"}`}>
      <Text className="text-body text-bone">{text}</Text>
      <View className="flex-row flex-wrap items-center gap-3">
        <SecondaryButton label={showLabel} testID={`${testID}-show`} onPress={onShow} />
        <TextButton label="Not now" testID={`${testID}-cancel`} tone="muted" onPress={onCancel} />
      </View>
    </View>
  );
}
