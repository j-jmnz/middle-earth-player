import { View } from "react-native";

import type { NextStep, PathNode } from "../campaign/path";
import { useSizeClass } from "../play/use-size-class";
import { Eyebrow, PrimaryButton, TextButton } from "./chrome";
import { nextLabel } from "./hub-runs";
import { Text } from "../play/text";

// The campaign hub's pieces for one playthrough (docs/design-system.md, Campaigns (campaign list)): the line that words a save, and
// the next stop under the hero. The hero over the current scene and the row for each other journey are in hub-parts.tsx.

// One save as the list words it: campaign, seats and progress. Two playthroughs of one campaign differ only here, so every
// control on a save names it with this line.
// `path` is the campaign's scenarios as the path screen reads them.
export type SaveLine = { name: string; seats: string; done: number; total: number; next: NextStep; path: readonly PathNode[] };

export function describe(line: SaveLine): string {
  return `${line.name}, ${line.seats}, ${line.done} of ${line.total} completed`;
}

/** "Next: A Knife in the Dark", "On the table: ...", or "Every scenario is won": the next step in one phrase (a row, a folded header). */
export function nextSummary(next: NextStep): string {
  return next.kind === "finished" ? "Every scenario is won" : `${next.kind === "resume" ? "On the table" : "Next"}: ${next.node.name}`;
}

/**
 * The stop the next tap plays, under the hero words: Next or On the table with its place in the book over the scenario's name at 24,
 * Begin or Resume as the screen's one primary (Resume goes straight to the table, Begin to the briefing; a 320 pt plate outside a
 * phone), then Full path and Campaign log as words under it. Nothing for a playthrough with no scenario left to play.
 */
export function NextStop({ id, line, onNext, onPath, onLog }: { id: string; line: SaveLine; onNext: () => void; onPath: () => void; onLog: () => void }) {
  const { size, s } = useSizeClass();
  const { next } = line;
  if (next.kind === "finished") return null;
  const label = next.kind === "resume" ? "Resume" : "Begin";
  const go = <PrimaryButton label={label} testID="continue" accessibilityLabel={`${label} ${next.node.name}, ${describe(line)}`} onPress={onNext} />;
  return (
    <View testID={`save-${id}`} style={{ gap: 14 * s }}>
      <View testID="continue-next" accessible accessibilityRole="header" accessibilityLabel={nextSummary(next)}>
        <Eyebrow tone="accent">{nextLabel(next, line.path)}</Eyebrow>
        <Text className="mt-1 font-display text-bone" style={{ fontSize: 24 * s, lineHeight: 28 * s }}>
          {next.node.name}
        </Text>
      </View>
      {size === "compact" ? go : <View style={{ alignSelf: "flex-start", width: 320 * s }}>{go}</View>}
      <View className="flex-row" style={{ gap: 8 * s }}>
        <TextButton label="Full path" icon="oneRing" tone="accent" testID="continue-path" accessibilityLabel={`Path of ${describe(line)}`} onPress={onPath} />
        <TextButton label="Campaign log" icon="contract" tone="accent" testID="continue-log" accessibilityLabel={`Log of ${describe(line)}`} onPress={onLog} />
      </View>
    </View>
  );
}

export const DELETE_SENTENCE = "Delete this playthrough? Its log, pool and any open scenario are gone for good. Your decks stay.";
