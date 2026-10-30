import { View } from "react-native";

import type { NextStep, PathNode } from "../campaign/path";
import { useUiScale } from "../play/ui-scale";
import { useSizeClass } from "../play/use-size-class";
import { campaignRoad, type RoadState, type Walk } from "./campaign-road";
import { Eyebrow, JourneyBar, Label, PrimaryButton, SecondaryButton, StepDiamond, TextButton, useAheadLine } from "./chrome";
import { usePalette } from "./palette-hook";
import { Text } from "../play/text";

// The campaign list's pieces for one playthrough (docs/design-system.md, Campaigns): the Continue panel (the campaign's road) and the
// summary Manage and Archived put KeepOrDelete (keep-or-delete.tsx) under. The hero over the current scene and the row for each
// other journey are in hub-parts.tsx.

// One save as the list words it: campaign, seats and progress. Two playthroughs of one campaign differ only here, so every
// control on a save names it with this line.
// `path` is the campaign's scenarios as the path screen reads them.
export type SaveLine = { name: string; seats: string; done: number; total: number; next: NextStep; path: readonly PathNode[] };

export function describe(line: SaveLine): string {
  return `${line.name}, ${line.seats}, ${line.done} of ${line.total} completed`;
}

/** The campaign's name, its seats and progress in words, and the journey track: a playthrough being managed or archived. */
export function SaveSummary({ line, eyebrow, archived = false }: { line: SaveLine; eyebrow: boolean; archived?: boolean }) {
  return (
    <>
      {eyebrow ? <Eyebrow>Current</Eyebrow> : null}
      <Text className={`mt-1 font-display text-title ${archived ? "text-muted" : "text-bone"}`}>{line.name}</Text>
      <Label>{`${line.seats} · ${line.done} of ${line.total} completed`}</Label>
      <View className="mt-3">
        <JourneyBar total={line.total} done={line.done} current={line.next.kind !== "finished"} />
      </View>
    </>
  );
}

/** "Next: A Knife in the Dark", "On the table: ...", or "Every scenario is won": the next step in one phrase (a row, a folded header). */
export function nextSummary(next: NextStep): string {
  return next.kind === "finished" ? "Every scenario is won" : `${next.kind === "resume" ? "On the table" : "Next"}: ${next.node.name}`;
}

// The next step's name, its button and the tag over it on the road: the scenario on the table, the one to play next, or none left.
function nextWords(next: NextStep): { name: string; label: string; state: string } {
  if (next.kind === "resume") return { name: next.node.name, label: "Resume", state: "On the table" };
  if (next.kind === "begin") return { name: next.node.name, label: "Begin", state: "Next" };
  return { name: "Every scenario is won", label: "Open path", state: "Completed" };
}

/** The road's line between two scenarios: solid where it has been walked, dashed ahead, nothing past either end. */
function RoadLine({ walk, height }: { walk: Walk; height?: number }) {
  const palette = usePalette();
  const ahead = useAheadLine();
  const size = height == null ? { flex: 1 } : { height };
  if (walk === "walked") return <View style={{ ...size, width: 2, backgroundColor: palette.accent }} />;
  if (walk === "ahead") return <View style={{ ...size, width: 0, borderLeftWidth: 2, borderStyle: "dashed", borderColor: ahead }} />;
  return <View style={size} />;
}

/** A scenario's stop on the road: the journey's step diamond, sized for the road. */
function RoadStop({ state }: { state: RoadState }) {
  const s = useUiScale();
  return (
    <View style={{ marginVertical: 3 * s }}>
      <StepDiamond state={state === "won" ? "done" : state === "here" ? "current" : "ahead"} size={state === "here" ? 13 : state === "won" ? 11 : 9} />
    </View>
  );
}

/**
 * The Continue panel under the hero words: the campaign's road on the ground, with no box round it. One stop per scenario in book
 * order on a line that is solid where walked: a won scenario's name with Won and its score; the one the next tap plays lit, with On
 * the table or Next over its name and the one tap that plays on (Resume goes straight to the table, Begin to the briefing); the rest
 * faint; the wins before the last fold into one line (campaign-road.ts). Once every scenario is won the road is all lit and Open path is the tap. Full
 * path and Campaign log are words at its foot.
 * While the Start block is open it holds the screen's one primary, so the next step is a plate here.
 */
export function ContinuePanel({ id, line, primary, onNext, onPath, onLog }: { id: string; line: SaveLine; primary: boolean; onNext: () => void; onPath: () => void; onLog: () => void }) {
  const { size, s } = useSizeClass();
  const { label, state } = nextWords(line.next);
  const spoken = `${label}${line.next.kind === "finished" ? "" : ` ${line.next.node.name}`}, ${describe(line)}`;
  const road = campaignRoad(line.path, line.next);
  const go = primary ? (
    <PrimaryButton label={label} testID="continue" accessibilityLabel={spoken} onPress={onNext} />
  ) : (
    <SecondaryButton label={label} testID="continue" accessibilityLabel={spoken} onPress={onNext} />
  );
  // Outside a phone the primary keeps a plate's width rather than spanning the road's column.
  const plate = size === "compact" ? go : <View style={{ alignSelf: "flex-start", width: 320 * s }}>{go}</View>;
  const mark = (state: RoadState, into: Walk, out: Walk) => (
    <View className="items-center" style={{ width: 20 * s }}>
      <RoadLine walk={into} height={state === "here" ? 12 * s : undefined} />
      <RoadStop state={state} />
      <RoadLine walk={out} />
    </View>
  );
  const quietRow = (key: string, state: RoadState, into: Walk, out: Walk, name: string, tag: string | null, heard: string) => (
    <View key={key} className="flex-row" style={{ gap: 14 * s }} accessible accessibilityLabel={heard}>
      {mark(state, into, out)}
      <View className="min-w-0 flex-1 flex-row items-center justify-between gap-2" style={{ minHeight: 38 * s }}>
        <Text className={`min-w-0 flex-1 text-body ${state === "won" ? "text-muted" : "text-faint"}`} numberOfLines={1}>
          {name}
        </Text>
        {tag ? <Text className={`text-label ${state === "won" ? "text-ok" : "text-faint"}`}>{tag}</Text> : null}
      </View>
    </View>
  );
  const stops = road.stops.map((stop) => {
    if (stop.state !== "here") return quietRow(stop.node.id, stop.state, stop.into, stop.out, stop.node.name, stop.tag, stop.spoken);
    return (
      <View key={stop.node.id} className="flex-row" style={{ gap: 14 * s }}>
        {mark(stop.state, stop.into, stop.out)}
        <View className="min-w-0 flex-1" style={{ gap: 14 * s, paddingTop: 14 * s, paddingBottom: 18 * s }}>
          <View testID="continue-next" accessible accessibilityRole="header" accessibilityLabel={nextSummary(line.next)}>
            {/* A replayed won scenario keeps its score beside what the tap does. */}
            <Eyebrow tone="accent">{stop.tag ? `${state} · ${stop.tag}` : state}</Eyebrow>
            <Text className="mt-1 font-display text-bone" style={{ fontSize: 24 * s, lineHeight: 28 * s }}>
              {stop.node.name}
            </Text>
          </View>
          {plate}
        </View>
      </View>
    );
  });
  const { folded } = road;
  // The quiet words start where the road's names do: past the line's column, less the button's own inset.
  const words = { paddingLeft: (20 + 14 - 12) * s };
  return (
    <View testID={`save-${id}`}>
      {folded ? quietRow("won", "won", null, "walked", `${folded.count} won`, folded.score != null ? `Score ${folded.score}` : null, folded.spoken) : null}
      {stops}
      {line.next.kind === "finished" ? (
        <View style={{ gap: 12 * s, paddingTop: 12 * s }}>
          <Text testID="continue-next" accessibilityRole="header" className="text-body text-ok">
            {nextWords(line.next).name}
          </Text>
          {plate}
        </View>
      ) : null}
      <View className="flex-row" style={{ marginTop: 6 * s, gap: 8 * s, ...(line.next.kind === "finished" ? {} : words) }}>
        {line.next.kind !== "finished" ? <TextButton label="Full path" icon="oneRing" tone="accent" testID="continue-path" accessibilityLabel={`Path of ${describe(line)}`} onPress={onPath} /> : null}
        <TextButton label="Campaign log" icon="contract" tone="accent" testID="continue-log" accessibilityLabel={`Log of ${describe(line)}`} onPress={onLog} />
      </View>
    </View>
  );
}

export const DELETE_SENTENCE = "Delete this playthrough? Its log, pool and any open scenario are gone for good. Your decks stay.";
