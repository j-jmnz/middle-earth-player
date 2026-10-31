// The rows of History's library list (docs/design-system.md, History): one card per playthrough or game, its runs listed inside it,
// and, while History manages, the row of actions under it (Archive or Restore, and Delete, asked in place). Each card is one FlashList
// item on a solid fill: no light and no shadow.
import { Pressable, View } from "react-native";

import type { RunRecord } from "../campaign/runs";
import { rowSurface } from "../play/surfaces";
import { Text } from "../play/text";
import { useTableTokens } from "../play/use-table-tokens";
import { Portrait } from "./art";
import { scenarioName } from "./campaign-data";
import { BodyText, Chevron, Chip, Label, TextButton } from "./chrome";
import type { PartyHero } from "./hub-parts";
import { runDate, runDetail } from "./history-words";
import { usePalette } from "./palette-hook";

/** A line under a card's title: what it is (muted), where it stands (accent), why it was lost (danger), or that it is gone (faint). */
export type CardLine = { text: string; tone: "muted" | "accent" | "danger" | "faint" };

export type CardChip = { label: string; tone: "accent" | "danger" | "neutral" | "faint" };

const LINE_CLASS: Record<CardLine["tone"], string> = { muted: "text-muted", accent: "text-accentHigh", danger: "text-danger", faint: "text-faint" };

/**
 * One playthrough or game: the fellowship's first face, the title, its lines, a status chip, and its runs under them. The whole card
 * opens while `onPress` is given (with a chevron) and is one sentence to a screen reader; a long press starts managing. A game's
 * one run is the game, so its card words the run in its lines and lists no runs.
 */
export function HistoryCard({
  testID,
  title,
  lines,
  chip,
  lead,
  runs,
  nameOf,
  accessibilityLabel,
  onPress,
  onLongPress,
}: {
  testID: string;
  title: string;
  lines: readonly CardLine[];
  chip: CardChip | null;
  lead: PartyHero | null;
  runs: readonly RunRecord[];
  nameOf: (code: string) => string;
  accessibilityLabel: string;
  onPress: (() => void) | null;
  onLongPress: (() => void) | null;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={accessibilityLabel}
      disabled={onPress == null && onLongPress == null}
      onPress={onPress ?? undefined}
      onLongPress={onLongPress ?? undefined}
      delayLongPress={350}
    >
      {/* The surface is on a view inside: NativeWind drops a style function on a Pressable that also has a className. */}
      {({ pressed }) => (
        <View className="rounded-item px-4 py-3.5" style={rowSurface(pressed && onPress != null, t)}>
          <View className="flex-row items-center gap-3">
            {lead ? <Portrait card={lead.card} size={36} tint={lead.tint} glow={false} /> : null}
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="shrink font-display text-heading text-bone" numberOfLines={2}>
                  {title}
                </Text>
                {chip ? <Chip label={chip.label} tone={chip.tone} /> : null}
              </View>
              {lines.map((line, at) => (
                <Text key={at} className={`text-label ${LINE_CLASS[line.tone]}`}>
                  {line.text}
                </Text>
              ))}
            </View>
            {onPress ? (
              <View className="w-6 items-center">
                <Chevron direction="right" color={palette.faint} size={8} />
              </View>
            ) : null}
          </View>
          {runs.map((run) => (
            <RunLine key={run.id} run={run} nameOf={nameOf} />
          ))}
        </View>
      )}
    </Pressable>
  );
}

/**
 * One run inside a playthrough's card, told apart by the space above it: the scenario with Won or Lost, the date at the end, a
 * loss's cause in danger, and the rounds, threat and, on a win, the score and what it earned (`runDetail`).
 */
function RunLine({ run, nameOf }: { run: RunRecord; nameOf: (code: string) => string }) {
  const date = runDate(run);
  const detail = runDetail(run, nameOf);
  const won = run.result === "won";
  return (
    <View className="mt-3" testID={`run-${run.id}`}>
      <View className="flex-row items-center gap-2">
        <Text className="shrink text-body font-semibold text-bone" numberOfLines={1}>
          {scenarioName(run.scenarioId)}
        </Text>
        <Chip label={won ? "Won" : "Lost"} tone={won ? "accent" : "danger"} />
        <View className="flex-1" />
        {date ? <Label tone="faint">{date}</Label> : null}
      </View>
      {!won && run.lossCause ? (
        <Text className="mt-0.5 text-label text-danger" testID={`run-${run.id}-cause`}>
          {run.lossCause}
        </Text>
      ) : null}
      {detail ? <Text className="mt-0.5 text-label text-muted">{detail}</Text> : null}
    </View>
  );
}

/**
 * What managing adds under a card: Archive (or Restore) and Delete. Delete asks in place: a danger sentence naming what is lost, then
 * Delete for good beside Keep. `described` names the playthrough or game to a screen reader, since two can differ only in that line.
 */
export function CardActions({
  id,
  described,
  archived,
  asking,
  sentence,
  onArchive,
  onAsk,
  onDelete,
  onKeep,
}: {
  id: string;
  described: string;
  archived: boolean;
  asking: boolean;
  sentence: string;
  onArchive: () => void;
  onAsk: () => void;
  onDelete: () => void;
  onKeep: () => void;
}) {
  if (asking) {
    return (
      <View className="gap-1 px-1 pt-2" testID={`delete-confirm-${id}`}>
        <BodyText tone="danger">{sentence}</BodyText>
        <View className="-mx-3 flex-row">
          <TextButton label="Delete for good" testID={`delete-yes-${id}`} tone="danger" accessibilityLabel={`Delete ${described}, for good`} onPress={onDelete} />
          <TextButton label="Keep" testID={`delete-no-${id}`} accessibilityLabel={`Keep ${described}`} onPress={onKeep} />
        </View>
      </View>
    );
  }
  const keep = archived ? "Restore" : "Archive";
  return (
    <View className="-mx-2 flex-row pt-1">
      <TextButton label={keep} testID={`${keep.toLowerCase()}-${id}`} tone="accent" accessibilityLabel={`${keep} ${described}`} onPress={onArchive} />
      <TextButton label="Delete" testID={`delete-${id}`} tone="danger" accessibilityLabel={`Delete ${described}`} onPress={onAsk} />
    </View>
  );
}
