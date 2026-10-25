import { View } from "react-native";

import { BodyText, TextButton } from "./chrome";

// A delete is asked twice, in place: the panel says what is lost and offers Delete for good beside Keep.
export function DeleteConfirm({ id, sentence, onDelete, onKeep }: { id: string; sentence: string; onDelete: () => void; onKeep: () => void }) {
  return (
    <View className="mt-3 gap-1" testID={`delete-confirm-${id}`}>
      <BodyText tone="danger">{sentence}</BodyText>
      <View className="-mx-3 flex-row">
        <TextButton label="Delete for good" testID={`delete-yes-${id}`} tone="danger" onPress={onDelete} />
        <TextButton label="Keep" testID={`delete-no-${id}`} onPress={onKeep} />
      </View>
    </View>
  );
}
