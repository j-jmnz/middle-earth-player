// The rows of History's library list (docs/design-system.md, History): one card per playthrough or game, its runs listed inside it,
// and, while History manages, its actions in a band at the card's foot (Archive or Restore, and Delete, asked in place). Each card is
// one FlashList item on a solid fill: no light and no shadow.
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import type { RunRecord } from "../campaign/runs";
import { rowSurface } from "../play/surfaces";
import { withAlphaHex } from "../play/tokens";
import { Text } from "../play/text";
import { useTableTokens } from "../play/use-table-tokens";
import { scenarioName } from "./campaign-data";
import { AskInPlace } from "./ask-in-place";
import { Chevron, Chip, Label, TextButton } from "./chrome";
import { HeroTile, heroFace, PARTY_TILE_HEIGHT, type HeroFace } from "./hero-tile";
import type { CardChip, CardLine, CardState } from "./history-entries";
import { HeroTrio } from "./hero-trio";
import { runDate, runDetail } from "./history-words";
import { usePalette } from "./palette-hook";
import { useUiScale } from "../play/ui-scale";

const LINE_CLASS: Record<CardLine["tone"], string> = { muted: "text-muted", accent: "text-accentHigh", danger: "text-danger" };

/**
 * One playthrough or game: the first seat's three heroes, the title, its lines, a status chip, and its runs under them. The head and
 * the runs open while `onPress` is given (with a chevron) and are one sentence to a screen reader; a long press starts managing. A
 * game's one run is the game, so its card words the run in its lines and lists no runs. `footer` is the managing band, inside the
 * card's corners so it reads as the card's own.
 */
export function HistoryCard({
  testID,
  state,
  title,
  lines,
  chip,
  lead,
  runs,
  nameOf,
  faces,
  party,
  accessibilityLabel,
  onPress,
  onLongPress,
  footer,
}: {
  testID: string;
  state: CardState;
  title: string;
  lines: readonly CardLine[];
  chip: CardChip | null;
  // The first seat's heroes, shown as three small cards before the title.
  lead: readonly HeroFace[];
  runs: readonly RunRecord[];
  nameOf: (code: string) => string;
  // The heroes' faces, for the party tiles under each run.
  faces: ReadonlyMap<string, HeroFace>;
  // A game's party, each seat's heroes, shown as tiles under its lines (its one run is worded in the lines, not listed).
  party?: readonly (readonly string[])[] | null;
  accessibilityLabel: string;
  onPress: (() => void) | null;
  onLongPress: (() => void) | null;
  footer?: ReactNode;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  return (
    <View className="overflow-hidden rounded-item">
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
          <View className="px-4 py-3.5" style={rowSurface(pressed && onPress != null, t)}>
            <View className="flex-row items-center gap-3">
              <HeroTrio heroes={lead} />
              <View className="min-w-0 flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className={`shrink font-display text-heading text-bone`} numberOfLines={2}>
                    {title}
                  </Text>
                  {chip ? <Chip label={chip.label} tone={chip.tone} /> : null}
                  {state === "archived" ? <Chip label="Archived" tone="faint" /> : null}
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
            {party ? <RunParty heroes={party} faces={faces} nameOf={nameOf} testID={`${testID}-party`} /> : null}
            {runs.map((run) => (
              <RunLine key={run.id} run={run} nameOf={nameOf} faces={faces} />
            ))}
          </View>
        )}
      </Pressable>
      {/* The band darkens the card's fill, as a deck cover's managing row does. */}
      {footer ? (
        <View style={rowSurface(false, t)}>
          <View className="px-4" style={{ backgroundColor: withAlphaHex(palette.night, 0.3) }}>
            {footer}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * One run inside a playthrough's card, told apart by the space above it: the scenario with Won or Lost, the date at the end, a
 * loss's cause in danger, and the rounds, threat and, on a win, the score and what it earned (`runDetail`).
 */
function RunLine({ run, nameOf, faces }: { run: RunRecord; nameOf: (code: string) => string; faces: ReadonlyMap<string, HeroFace> }) {
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
      <RunParty heroes={run.heroes} faces={faces} nameOf={nameOf} testID={`run-${run.id}-party`} />
    </View>
  );
}

/**
 * A run's heroes as the briefing shows the picked fellowship (user request, 2026-11-02): their pictures as dense hero tiles, three to a
 * row, each seat on a row of its own under "Player 1" in two-handed play. Seen, not tapped: the card's press goes through them.
 */
function RunParty({ heroes, faces, nameOf, testID }: { heroes: readonly (readonly string[])[]; faces: ReadonlyMap<string, HeroFace>; nameOf: (code: string) => string; testID: string }) {
  const s = useUiScale();
  const seats = heroes.filter((seat) => seat.length > 0);
  if (seats.length === 0) return null;
  return (
    <View testID={testID} pointerEvents="none" className="mt-2.5 gap-2">
      {seats.map((seat, at) => (
        <View key={at}>
          {seats.length > 1 ? <Label tone="faint">{`Player ${at + 1}`}</Label> : null}
          <View className="mt-1 flex-row gap-2">
            {seat.map((code) => (
              <HeroTile key={code} hero={heroFace(faces, code, nameOf(code))} height={PARTY_TILE_HEIGHT * s} dense />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * What managing adds at a card's foot: Archive (or Restore) and Delete. Delete asks in place: a danger sentence naming what is lost, then
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
      <AskInPlace
        testID={`delete-confirm-${id}`}
        className="pt-2.5"
        sentence={sentence}
        confirm={{ label: "Delete for good", testID: `delete-yes-${id}`, accessibilityLabel: `Delete ${described}, for good`, onPress: onDelete }}
        keep={{ testID: `delete-no-${id}`, accessibilityLabel: `Keep ${described}`, onPress: onKeep }}
      />
    );
  }
  const keep = archived ? "Restore" : "Archive";
  return (
    <View className="-mx-3 flex-row">
      <TextButton label={keep} testID={`${keep.toLowerCase()}-${id}`} tone="accent" accessibilityLabel={`${keep} ${described}`} onPress={onArchive} />
      <TextButton label="Delete" testID={`delete-${id}`} tone="danger" accessibilityLabel={`Delete ${described}`} onPress={onAsk} />
    </View>
  );
}
