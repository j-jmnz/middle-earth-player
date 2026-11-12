import { View } from "react-native";

import { useSizeClass } from "../../ui/use-size-class";
import { Eyebrow, PrimaryButton, TextButton } from "../kit/chrome";
import { PrimaryPlate } from "./hub-parts";
import { nextLabel } from "./hub-runs";
import { describe, nextSummary, type SaveLine } from "../history/save-line";
import { Text } from "../../ui/text";

// The next stop under the Campaigns hub's hero (docs/design-system.md, Campaigns (campaign list)). The hero over the current scene and
// the row for each other journey are in hub-parts.tsx; the line that words a save is in save-line.ts.

/**
 * The stop the next tap plays, under the hero words: the scenario's name at 24, Resume as the screen's one primary whether the scenario
 * is on the table or not yet dealt (user request, 2026-11-08: it goes straight to the table, or to the briefing of one not dealt; a 320 pt
 * plate outside a phone), then Full path and Campaign log as words under it. Nothing for a playthrough with no scenario left to play; a
 * scenario coming soon says so over its name and has no Resume.
 */
export function NextStop({ id, line, onNext, onPath, onLog }: { id: string; line: SaveLine; onNext: () => void; onPath: () => void; onLog: () => void }) {
  const { s } = useSizeClass();
  const { next } = line;
  if (next.kind === "finished") return null;
  // A scenario the app cannot deal yet has no Resume: the stop says it is coming soon and the path and log stay.
  const soon = next.kind === "soon";
  // The eyebrow says what a tap does where it is not the plain "next": a scenario coming soon, or an open one that asks to be continued or restarted.
  const eyebrow = soon || (next.kind === "resume" && next.needsChoice === true);
  const go = soon ? null : <PrimaryButton label="Resume" testID="continue" accessibilityLabel={`Resume ${next.node.name}, ${describe(line)}`} onPress={onNext} />;
  return (
    <View testID={`save-${id}`} style={{ gap: 14 * s }}>
      <View testID="continue-next" accessible accessibilityRole="header" accessibilityLabel={nextSummary(next)}>
        {eyebrow ? <Eyebrow tone="accent">{nextLabel(next, line.path)}</Eyebrow> : null}
        <Text className={`${eyebrow ? "mt-1 " : ""}font-display text-bone`} style={{ fontSize: 24 * s, lineHeight: 28 * s }}>
          {next.node.name}
        </Text>
      </View>
      {go ? <PrimaryPlate>{go}</PrimaryPlate> : null}
      <View className="flex-row flex-wrap" style={{ gap: 8 * s }}>
        <TextButton label="Full path" icon="oneRing" tone="accent" testID="continue-path" accessibilityLabel={`Full path, ${describe(line)}`} onPress={onPath} />
        <TextButton label="Campaign log" icon="contract" tone="accent" testID="continue-log" accessibilityLabel={`Campaign log, ${describe(line)}`} onPress={onLog} />
      </View>
    </View>
  );
}
