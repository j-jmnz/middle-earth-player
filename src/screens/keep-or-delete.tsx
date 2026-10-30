import { View } from "react-native";

import { BodyText, TextButton } from "./chrome";
import { Text } from "../play/text";

// The two actions on a playthrough or a standalone game in History's sheet: one that keeps it (Archive, or Restore) and Delete. A
// delete is asked twice, in place: the panel says what is lost and offers Delete for good beside Keep. `described` names the item for
// a screen reader, since two items can differ only in that line. `paper` is the sheet's parchment: the words take ink there.
export function KeepOrDelete({
  id,
  described,
  sentence,
  keep,
  confirming,
  onAskDelete,
  onDelete,
  onKeep,
  paper = false,
}: {
  id: string;
  described: string;
  sentence: string;
  keep: { label: "Archive" | "Restore"; onPress: () => void };
  confirming: boolean;
  onAskDelete: () => void;
  onDelete: () => void;
  onKeep: () => void;
  paper?: boolean;
}) {
  if (confirming) {
    return (
      <View className="mt-3 gap-1" testID={`delete-confirm-${id}`}>
        {paper ? <Text className="text-body text-ink">{sentence}</Text> : <BodyText tone="danger">{sentence}</BodyText>}
        <View className="-mx-3 flex-row">
          <TextButton label="Delete for good" testID={`delete-yes-${id}`} tone={paper ? "ink" : "danger"} accessibilityLabel={`Delete ${described}, for good`} onPress={onDelete} />
          <TextButton label="Keep" testID={`delete-no-${id}`} tone={paper ? "ink" : "bone"} accessibilityLabel={`Keep ${described}`} onPress={onKeep} />
        </View>
      </View>
    );
  }
  return (
    <View className="-mx-3 mt-2 flex-row">
      <TextButton label={keep.label} testID={`${keep.label.toLowerCase()}-${id}`} tone={paper ? "ink" : "accent"} accessibilityLabel={`${keep.label} ${described}`} onPress={keep.onPress} />
      <TextButton label="Delete" testID={`delete-${id}`} tone={paper ? "ink" : "danger"} accessibilityLabel={`Delete ${described}`} onPress={onAskDelete} />
    </View>
  );
}
