// The quest advance screen (quest-advance.ts; user request, 2026-10-29): the stage the quest advanced to, large over the dimmed table
// like the card preview (card-preview.tsx) but with no Details. Its column names the stage and how it is completed, then holds one of
// two things: the Progress button, which goes back to the table, or, while the stage's own When Revealed asks the player something,
// that question: its options as tiles and the dock's buttons that answer it (dock-buttons.tsx, the same two taps as the dock). A tap
// on the dimmed screen does nothing: the screen holds the moment until Progress, or the answer, sends the player back to the table.
import { useEffect } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CardImage } from "./card-image.tsx";
import { PreviewPicture, type PreviewCard } from "./card-preview.tsx";
import { DockButtons } from "./dock-buttons.tsx";
import { springConfig, useMotionScale } from "./motion-run.ts";
import { MOTION } from "./motion-tokens.ts";
import { previewSideSize, previewSize } from "./preview-size.ts";
import { PrimaryButton } from "./buttons.tsx";
import { Tile } from "./sheet-paper.tsx";
import type { PictureSource } from "./table-canvas-types.ts";
import { trayTiles } from "./tray-logic.ts";
import { cardCorner } from "./card-corner.ts";
import { useUiScale } from "./ui-scale.ts";
import type { TableChoice } from "./use-table-choice.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

const SCRIM = 0.9;

export function QuestAdvanceView({
  card,
  words,
  button,
  asks,
  choice,
  picture,
  onProgress,
}: {
  card: PreviewCard;
  words: { eyebrow: string; title: string; detail: string | null };
  // The button back to the table (advanceButton): Begin, Continue or Progress.
  button: { label: string; hint: string };
  // The stage's When Revealed is asking: its question stands in place of Progress.
  asks: boolean;
  choice: TableChoice;
  picture: (code: string) => PictureSource | null;
  onProgress: () => void;
}) {
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = useMotionScale();
  const t = useTableTokens();
  const s = useUiScale();
  const progress = useSharedValue(scale === 0 ? 1 : 0);
  const wide = screen.width > screen.height;
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
  return (
    <View testID="quest-advance" accessibilityViewIsModal style={StyleSheet.absoluteFill}>
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
          <Text testID="quest-advance-eyebrow" className="font-display text-eyebrow uppercase text-accent">
            {words.eyebrow}
          </Text>
          <Text testID="quest-advance-title" accessibilityRole="header" className="mt-1 font-display text-title text-bone">
            {words.title}
          </Text>
          {words.detail ? (
            <Text testID="quest-advance-detail" className="mt-1 text-label text-muted">
              {words.detail}
            </Text>
          ) : null}
          {asks ? (
            <View testID="quest-advance-asks" className="mt-3" style={{ flexShrink: 1 }}>
              <Text className="font-display text-eyebrow uppercase text-accent">{choice.header.step}</Text>
              <Text className="mt-1 text-body text-bone">{choice.header.title}</Text>
              {choice.header.note ? <Text className="mt-0.5 text-label text-muted">{choice.header.note}</Text> : null}
              <ScrollView style={{ flexShrink: 1, marginTop: 8 * s }} showsVerticalScrollIndicator={false}>
                {tiles.map((tile) => {
                  const source = tile.code ? picture(tile.code) : null;
                  return (
                    <Tile
                      key={tile.id}
                      surface="night"
                      label={tile.label}
                      detail={tile.detail}
                      stats={tile.stats}
                      selected={marks.has(tile.id)}
                      testID={`quest-advance-option-${tile.id}`}
                      leading={tile.code && source ? <CardImage source={source} recyclingKey={`${tile.code}:advance`} width={32 * s} height={44 * s} /> : null}
                      onPress={() => choice.onTile(tile.id)}
                    />
                  );
                })}
              </ScrollView>
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
