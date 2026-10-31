// The in-place ask before a change that cannot be taken back (docs/design-system.md, Components): a danger sentence naming what is
// lost, then the danger button beside Keep. History's Delete, a deck's Delete or Reset and Settings' Restore defaults use it.
import { View } from "react-native";

import { BodyText, TextButton } from "./chrome";

type AskButton = { label: string; testID: string; accessibilityLabel: string; onPress: () => void };

export function AskInPlace({ testID, sentence, confirm, keep, className }: { testID: string; sentence: string; confirm: AskButton; keep: Omit<AskButton, "label">; className?: string }) {
  return (
    <View className={className ? `gap-1 ${className}` : "gap-1"} testID={testID}>
      <BodyText tone="danger">{sentence}</BodyText>
      {/* The words of the first button line up with the sentence: a text button pads its own target. */}
      <View className="-mx-3 flex-row">
        <TextButton label={confirm.label} testID={confirm.testID} tone="danger" accessibilityLabel={confirm.accessibilityLabel} onPress={confirm.onPress} />
        <TextButton label="Keep" testID={keep.testID} accessibilityLabel={keep.accessibilityLabel} onPress={keep.onPress} />
      </View>
    </View>
  );
}
