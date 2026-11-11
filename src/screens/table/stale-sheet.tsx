// The sheet a table route opens with when its game was dealt on other rules or other card data (docs/design-system.md, Table opens
// stale). A paper sheet on the deck editor's frame: what changed, Continue (primary) and Restart. Leaving it, by the scrim, Back or the
// text button, writes nothing; it shows again on the next open.
import { View } from "react-native";

import { PaperSheet, PrimaryButton, TextButton } from "../kit/chrome";
import { SheetModal } from "../kit/sheet-modal";
import { changeLines, CHECKPOINT_NOTE, CONTINUE_NOTE, RESTART_NOTE, STALE_SENTENCE, STALE_STEP, takenBackNote } from "../session/stale-words";
import { Text } from "../../ui/text";

export function StaleSheet({ title, error, takenBack, fromCheckpoint, changes, onContinue, onRestart, onLeave }: { title: string; error: string | null; takenBack?: number | null; fromCheckpoint?: boolean; changes?: readonly string[]; onContinue: () => void; onRestart: () => void; onLeave: () => void }) {
  return (
    <SheetModal visible onRequestClose={onLeave} scrimLabel="Leave without choosing">
      <PaperSheet step={STALE_STEP} title={title}>
        <Text testID="stale-sentence" className="text-body text-ink">
          {STALE_SENTENCE}
        </Text>
        {changeLines(changes).map((line, index) => (
          <Text key={line} testID={`stale-change-${index}`} className="mt-1 text-body text-ink">
            {line}
          </Text>
        ))}
        <Text testID={fromCheckpoint ? "stale-checkpoint" : undefined} className="mt-2 text-body text-ink">
          {fromCheckpoint ? CHECKPOINT_NOTE : CONTINUE_NOTE}
        </Text>
        {takenBack && !fromCheckpoint ? (
          <Text testID="stale-taken-back" className="mt-2 text-body text-ink">
            {takenBackNote(takenBack)}
          </Text>
        ) : null}
        <Text className="mt-2 text-body text-ink">{RESTART_NOTE}</Text>
        {error ? (
          <Text testID="stale-error" className="mt-2 text-body text-danger">
            {error}
          </Text>
        ) : null}
        <View className="mt-5">
          <PrimaryButton testID="stale-continue" label="Continue" surface="paper" onPress={onContinue} />
          <View className="mt-2 flex-row justify-center">
            <TextButton testID="stale-restart" label="Restart" tone="ink" onPress={onRestart} />
            <TextButton testID="stale-leave" label="Not now" tone="ink" onPress={onLeave} />
          </View>
        </View>
      </PaperSheet>
    </SheetModal>
  );
}
