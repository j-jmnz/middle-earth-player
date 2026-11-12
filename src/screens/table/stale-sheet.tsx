// The sheet a table route opens with when its game was dealt on other rules or other card data (docs/design-system.md, Table opens
// stale). A paper sheet on the deck editor's frame, capped at 90% of the window: what changed scrolls, and Continue (primary), Restart and Not now
// stay pinned under it. Restart asks in place before it throws the moves away. Leaving it, by the scrim, Back or the text button, writes nothing; it
// shows again on the next open. While a choice runs the route shows the table's loading frame instead (use-stale-choice.ts).
import { useEffect, useState } from "react";
import { useWindowDimensions, View } from "react-native";

import { announce } from "../../ui/announce";
import { Text } from "../../ui/text";
import { useSizeClass } from "../../ui/use-size-class";
import { AskInPlace } from "../kit/ask-in-place";
import { PaperSheet, PrimaryButton, TextButton } from "../kit/chrome";
import { SheetModal } from "../kit/sheet-modal";
import { changeLines, CHANGES_LABEL, CHECKPOINT_LOSS, CHECKPOINT_NOTE, CONTINUE_NOTE, restartAsk, restartNote, STALE_SENTENCE, STALE_STEP, takenBackNote } from "../session/stale-words";

// The sheet's height as a share of the window's, so the overline and the buttons are on screen whatever the window.
const SHEET_SHARE = 0.9;

export function StaleSheet({
  title,
  error,
  moves,
  standalone,
  takenBack,
  fromCheckpoint,
  changes,
  onContinue,
  onRestart,
  onLeave,
}: {
  title: string;
  error: string | null;
  // How many moves the game has, which Restart would throw away.
  moves: number;
  standalone: boolean;
  takenBack?: number | null;
  fromCheckpoint?: boolean;
  changes?: readonly string[];
  onContinue: () => void;
  onRestart: () => void;
  onLeave: () => void;
}) {
  const { height } = useWindowDimensions();
  const { short } = useSizeClass();
  const [asking, setAsking] = useState(false);
  const lines = changeLines(changes);
  const sentence = restartAsk(moves, standalone);
  // A refusal is said to a screen reader as it appears: the sheet's own text does not move focus.
  useEffect(() => {
    if (error) announce(error);
  }, [error]);
  const ask = () => {
    setAsking(true);
    announce(`${sentence} Tap Restart to confirm.`);
  };
  const continueButton = <PrimaryButton testID="stale-continue" label="Continue" surface="paper" onPress={onContinue} />;
  const footer = asking ? (
    <AskInPlace
      testID="stale-restart-ask"
      className="mt-4"
      sentence={sentence}
      confirm={{ label: "Restart", testID: "stale-restart-yes", accessibilityLabel: "Restart, throwing away this game's moves", onPress: onRestart }}
      keep={{ testID: "stale-restart-no", accessibilityLabel: "Keep this game and its moves", onPress: () => setAsking(false) }}
    />
  ) : short ? (
    // A phone on its side: Continue and the two words side by side, so the footer stays one row high.
    <View className="mt-3 flex-row items-center gap-2">
      <View className="flex-1">{continueButton}</View>
      <TextButton testID="stale-restart" label="Restart" tone="ink" onPress={ask} />
      <TextButton testID="stale-leave" label="Not now" tone="ink" onPress={onLeave} />
    </View>
  ) : (
    <View className="mt-5">
      {continueButton}
      <View className="mt-2 flex-row justify-center">
        <TextButton testID="stale-restart" label="Restart" tone="ink" onPress={ask} />
        <TextButton testID="stale-leave" label="Not now" tone="ink" onPress={onLeave} />
      </View>
    </View>
  );
  return (
    <SheetModal visible onRequestClose={onLeave} scrimLabel="Leave without choosing">
      <PaperSheet step={STALE_STEP} title={title} maxHeight={height * SHEET_SHARE} footer={footer}>
        <Text testID="stale-sentence" className="text-body text-ink">
          {STALE_SENTENCE}
        </Text>
        {lines.length > 0 ? (
          <View className="mt-3" testID="stale-changes">
            <Text className="text-body text-ink">{CHANGES_LABEL}</Text>
            {lines.map((line, index) => (
              <Text key={line} testID={`stale-change-${index}`} className="mt-1 text-body text-inkMuted">
                {`• ${line}`}
              </Text>
            ))}
          </View>
        ) : null}
        <Text testID={fromCheckpoint ? "stale-checkpoint" : undefined} className="mt-3 text-body text-ink">
          {fromCheckpoint ? `${CHECKPOINT_NOTE} ${CHECKPOINT_LOSS}` : CONTINUE_NOTE}
        </Text>
        {takenBack && !fromCheckpoint ? (
          <Text testID="stale-taken-back" className="mt-2 text-body text-ink">
            {takenBackNote(takenBack)}
          </Text>
        ) : null}
        <Text className="mt-2 text-body text-ink">{restartNote(standalone)}</Text>
        {error ? (
          <Text testID="stale-error" className="mt-2 text-body text-danger">
            {error}
          </Text>
        ) : null}
      </PaperSheet>
    </SheetModal>
  );
}
