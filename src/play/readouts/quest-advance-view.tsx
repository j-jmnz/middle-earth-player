// The quest advance screen (quest-advance.ts; user request, 2026-10-29): the stage the quest advanced to, large over the dimmed table
// like the card preview (card-preview.tsx) but with no Details. Its column names the stage and how it is completed, then holds one of
// two things: the Progress button, which goes back to the table, or, while the stage's own When Revealed asks the player something,
// that question: its options as tiles and the dock's buttons that answer it (dock/buttons.tsx, the same two taps as the dock). A tap
// on the dimmed screen does nothing: the screen holds the moment until Progress, or the answer, sends the player back to the table.
import { useEffect } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CardImage } from "../../ui/card-image.tsx";
import { ringRoom, ringScroll } from "../../ui/focus-ring-style.ts";
import { PreviewPicture, type PreviewCard } from "../cards/card-preview.tsx";
import { DockButtons } from "../choice/dock/buttons.tsx";
import { springConfig, useMotionScale } from "../../ui/motion-run.ts";
import { MOTION } from "../../ui/motion-tokens.ts";
import { previewSideSize, previewSize } from "../cards/preview-size.ts";
import { PrimaryButton } from "../../ui/buttons.tsx";
import { Tile } from "../choice/sheet-paper.tsx";
import type { PictureSource } from "../canvas/table-canvas-types.ts";
import { trayTiles } from "../choice/tray-logic.ts";
import { cardCorner } from "../../ui/card-corner.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import type { TableChoice } from "../choice/use-table-choice.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";

const SCRIM = 0.9;

// A screen this many points tall or less, at Medium, is short for the question's column.
const SHORT = 440;
// How far the header stays from the right edge, clear of the table menu button (about 60 from the edge, 16 of it the column's padding).
const MENU_CLEAR = 44;

export function QuestAdvanceView({
  card,
  words,
  button,
  asks,
  choice,
  picture,
  onRead,
  onProgress,
}: {
  card: PreviewCard;
  words: { eyebrow: string | null; title: string; detail: string | null; also: readonly string[] };
  // The button back to the table (advanceButton): Begin, Continue or Progress.
  button: { label: string; hint: string };
  // The stage's When Revealed is asking: its question stands in place of Progress.
  asks: boolean;
  choice: TableChoice;
  picture: (code: string) => PictureSource | null;
  // A long press on an option shows that card large over this screen (card-preview.tsx).
  onRead: (cardId: string) => void;
  onProgress: () => void;
}) {
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = useMotionScale();
  const t = useTableTokens();
  const s = useUiScale();
  const progress = useSharedValue(scale === 0 ? 1 : 0);
  const wide = screen.width > screen.height;
  // On a short wide screen (a phone on its side) the rows are dense (one line each), so four fit with the answer; the question's own sentence stays above them, where the choice is read.
  const short = wide && screen.height < SHORT * s;
  const roomW = screen.width - insets.left - insets.right;
  const roomH = screen.height - insets.top - insets.bottom;
  const size = wide ? previewSideSize(roomW, roomH, card.landscape ?? false, s) : previewSize(screen.width, roomH, card.landscape ?? false, s);
  useEffect(() => {
    if (scale > 0) progress.set(withSpring(1, springConfig(MOTION.previewIn, scale)));
  }, [progress, scale]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.get())) * SCRIM }));
  const cardStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: Math.min(1, Math.max(0, p * 1.4)), transform: [{ translateY: (1 - p) * 28 * s }, { scale: 0.82 + 0.18 * p }] };
  });
  const sheet = choice.sheet;
  const tiles = asks ? trayTiles(sheet) : [];
  const marks = new Set(choice.choice.ids);
  const reads = tiles.some((tile) => tile.readId);
  const note = choice.header.note;
  // The question's own sentence and the card's printed line it ends with: on a short screen the sentence stands above the rows and the printed line below them.
  const printed = sheet.kind === "pick" ? (sheet.printed ?? null) : null;
  const splits = note != null && printed != null && printed !== "" && note.endsWith(printed) && note.length > printed.length;
  const ask = splits ? note.slice(0, note.length - printed.length).trim() : note;
  return (
    <View testID="quest-advance" accessibilityViewIsModal onAccessibilityEscape={asks ? undefined : onProgress} style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.night }, scrimStyle]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          wide ? styles.row : styles.column,
          { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left + 16 * s, paddingRight: insets.right + 16 * s },
        ]}
      >
        <Animated.View style={[{ width: size.width, height: size.height, borderRadius: card.source ? 0 : cardCorner(size.width, size.height), overflow: "hidden", backgroundColor: card.source ? "transparent" : t.paper }, cardStyle]}>
          <PreviewPicture card={card} width={size.width} height={size.height} />
        </Animated.View>
        <View style={wide ? { flex: 1, maxWidth: 360 * s, marginLeft: 20 * s, maxHeight: roomH - 16 * s } : { width: size.width, marginTop: 16 * s, flexShrink: 1 }}>
          {/* On a short screen the stage's eyebrow and title share a line, so the rows below keep their room. */}
          {/* The table's menu button stands over the top right corner of the screen: the header stays clear of it, so a long title wraps instead of passing under it. */}
          <View style={short && asks ? { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 8 * s, paddingRight: MENU_CLEAR * s } : { paddingRight: MENU_CLEAR * s }}>
            {words.eyebrow ? (
              <Text testID="quest-advance-eyebrow" className="font-display text-eyebrow uppercase text-accent">
                {words.eyebrow}
              </Text>
            ) : null}
            <Text testID="quest-advance-title" accessibilityRole="header" className={`${short && asks ? "" : "mt-1 "}font-display text-title text-bone`}>
              {words.title}
            </Text>
          </View>
          {words.detail ? (
            <Text testID="quest-advance-detail" className="mt-1 text-label text-muted">
              {words.detail}
            </Text>
          ) : null}
          {words.also.map((line) => (
            <Text key={line} testID="quest-advance-also" className="mt-1 text-label text-muted">
              {line}
            </Text>
          ))}
          {asks ? (
            <View testID="quest-advance-asks" className="mt-3" style={{ flexShrink: 1 }}>
              <Text className="font-display text-eyebrow uppercase text-accent">{choice.header.step}</Text>
              {choice.header.title !== words.title ? <Text className="mt-1 text-body text-bone">{choice.header.title}</Text> : null}
              {ask && short ? <Text testID="quest-advance-note" className="mt-1 text-label text-muted">{ask}</Text> : null}
              <ScrollView style={{ flexShrink: 1, marginTop: (short || !note ? 4 : 2) * s - ringRoom(s), marginHorizontal: ringScroll(s).style.marginHorizontal }} contentContainerStyle={ringScroll(s).content} showsVerticalScrollIndicator={false}>
                {note && !short ? <Text className="mb-2 text-label text-muted">{note}</Text> : null}
                {tiles.map((tile) => {
                  const source = tile.code ? picture(tile.code) : null;
                  const readId = tile.readId;
                  return (
                    <Tile
                      key={tile.id}
                      surface="night"
                      label={tile.label}
                      detail={tile.detail}
                      stats={tile.stats}
                      selected={marks.has(tile.id)}
                      dense={short}
                      testID={`quest-advance-option-${tile.id}`}
                      leading={tile.code && source ? <CardImage source={source} recyclingKey={`${tile.code}:advance`} width={32 * s} height={44 * s} /> : null}
                      onPress={() => choice.onTile(tile.id)}
                      onLongPress={readId ? () => onRead(readId) : null}
                    />
                  );
                })}
                {splits && short ? <Text testID="quest-advance-printed" className="mt-1 text-label text-muted">{printed}</Text> : null}
                {short && reads ? <Text className="mt-1 text-label text-muted">Hold a card to read it.</Text> : null}
              </ScrollView>
              {!short && reads ? <Text className="mt-1 text-label text-muted">Hold a card to read it.</Text> : null}
              <View className="mt-2">
                <DockButtons key={choice.resetKey} dock={choice.dock} picked={choice.picked} onButton={choice.onButton} />
              </View>
            </View>
          ) : (
            <View className="mt-4">
              <PrimaryButton label={button.label} testID="quest-advance-progress" accessibilityHint={button.hint} onPress={onProgress} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  column: { alignItems: "center", justifyContent: "center" },
});
