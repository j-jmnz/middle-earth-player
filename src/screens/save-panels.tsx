import { View } from "react-native";

import { useSizeClass } from "../play/use-size-class";
import { Eyebrow, PrimaryButton, TextButton } from "./chrome";
import { PrimaryPlate } from "./hub-parts";
import { nextLabel } from "./hub-runs";
import { describe, nextSummary, type SaveLine } from "./save-line";
import { Text } from "../play/text";

// The next stop under the Campaigns hub's hero (docs/design-system.md, Campaigns (campaign list)). The hero over the current scene and
// the row for each other journey are in hub-parts.tsx; the line that words a save is in save-line.ts.

/**
 * The stop the next tap plays, under the hero words: Next or On the table with its place in the book over the scenario's name at 24,
 * Begin or Resume as the screen's one primary (Resume goes straight to the table, Begin to the briefing; a 320 pt plate outside a
 * phone), then Full path and Campaign log as words under it. Nothing for a playthrough with no scenario left to play; a scenario coming soon has no Begin.
 */
export function NextStop({ id, line, onNext, onPath, onLog }: { id: string; line: SaveLine; onNext: () => void; onPath: () => void; onLog: () => void }) {
  const { s } = useSizeClass();
  const { next } = line;
  if (next.kind === "finished") return null;
  // A scenario the app cannot deal yet has no Begin: the stop says it is coming soon and the path and log stay.
  const soon = next.kind === "soon";
  const label = next.kind === "resume" ? "Resume" : "Begin";
  const go = soon ? null : <PrimaryButton label={label} testID="continue" accessibilityLabel={`${label} ${next.node.name}, ${describe(line)}`} onPress={onNext} />;
  return (
    <View testID={`save-${id}`} style={{ gap: 14 * s }}>
      <View testID="continue-next" accessible accessibilityRole="header" accessibilityLabel={nextSummary(next)}>
        <Eyebrow tone="accent">{nextLabel(next, line.path)}</Eyebrow>
        <Text className="mt-1 font-display text-bone" style={{ fontSize: 24 * s, lineHeight: 28 * s }}>
          {next.node.name}
        </Text>
      </View>
      {go ? <PrimaryPlate>{go}</PrimaryPlate> : null}
      <View className="flex-row" style={{ gap: 8 * s }}>
        <TextButton label="Full path" icon="oneRing" tone="accent" testID="continue-path" accessibilityLabel={`Path of ${describe(line)}`} onPress={onPath} />
        <TextButton label="Campaign log" icon="contract" tone="accent" testID="continue-log" accessibilityLabel={`Log of ${describe(line)}`} onPress={onLog} />
      </View>
    </View>
  );
}
