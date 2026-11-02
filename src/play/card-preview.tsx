// A long press on a card: the card large over the dimmed screen, so its text reads at a glance without leaving the table
// or the list. It grows in on a spring and shrinks back on close; reduced motion snaps both. A tap anywhere but Details and the
// rows of what is with the card, Android Back or the VoiceOver escape gesture closes it (there is no Close button); Details
// opens the card screen.
//
// On a wide screen (the table, in landscape) the card stands at the left and a column at its right names it, says what
// effects are on it now (+1 Attack from Dagger of Westernesse) and lists the cards attached to it and its shadow cards: a
// tap on one shows that card in its place.
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { CardImage } from "./card-image.tsx";
import { CardTextView } from "./card-text-view.tsx";
import { cachePolicyFor } from "./image-cache.ts";
import type { NotApplied } from "./not-applied.ts";
import { NotAppliedView } from "./not-applied-view.tsx";
import { springConfig, timing, useMotionScale } from "./motion-run.ts";
import { MOTION } from "./motion-tokens.ts";
import { previewSideSize, previewSize } from "./preview-size.ts";
import { SecondaryButton } from "./buttons.tsx";
import type { PictureSource } from "./table-canvas-types.ts";
import { cardCorner } from "./card-corner.ts";
import { touch, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

const SCRIM = 0.82;

export type PreviewCard = {
  code: string;
  name: string;
  // The line over the card's name when it has more to say than its name (the quest stage: its name and its progress), and a
  // muted line under it (how a stage with no quest points is won).
  title?: string;
  detail?: string;
  // The scan, or null while it is not on the phone: the name and text are shown on paper instead.
  source: PictureSource | null;
  // Quest cards are printed sideways.
  landscape?: boolean;
  text?: string | null;
  // The effects on the card now, in words, when it is on the table.
  effects?: readonly string[];
  // How it sits with the first card: "Attachment", "Shadow card".
  role?: string;
  // Why a hand card cannot be played now (why.ts), when the tap that opened it found nothing to do.
  note?: string | null;
  // What the note's heading says when it is not about playing: "Cannot be chosen now" for a character the open pick veils (why.ts, whyNotChosen).
  noteTitle?: string;
  // The lines of it the app does not apply, and what that costs (not-applied.ts).
  notApplied?: NotApplied | null;
  // The Heading card's four steps with where each stands, the current one marked (heading.ts): their own heading in the preview, not effects on the card.
  steps?: readonly { text: string; current: boolean }[];
  // How far the card is drawn turned, in degrees counterclockwise, a multiple of 90: the Heading card, turned a quarter turn per step as the rule turns it (heading.ts).
  turn?: number;
  // The card lies on its Lost Island side: the preview shows that side only, and Details (which opens the real card) is not offered.
  lostIsland?: boolean;
};

// The card's picture, or (while it is not on the phone) its name and text on paper. The quest advance screen draws its stage with it.
// `imageKey`: the picture's own key when two cards of one code are shown in turn (a quest card's sides A and B); its code otherwise.
export function PreviewPicture({ card, width, height, imageKey }: { card: PreviewCard; width: number; height: number; imageKey?: string }) {
  const key = imageKey ?? card.code;
  const turn = ((card.turn ?? 0) % 360 + 360) % 360;
  if (card.source && turn !== 0) {
    // A quarter or half turn: the picture is drawn at its own size about the frame's centre, so a sideways card fills a sideways frame.
    const across = turn % 180 === 90;
    const w = across ? height : width;
    const h = across ? width : height;
    return (
      <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: w, height: h, transform: [{ rotate: `${-turn}deg` }] }}>
          <CardImage source={card.source} recyclingKey={key} accessibilityLabel={card.name} width={w} height={h} />
        </View>
      </View>
    );
  }
  return card.source ? (
    <CardImage source={card.source} recyclingKey={key} accessibilityLabel={card.name} width={width} height={height} />
  ) : (
    <ScrollView className="flex-1 px-5 py-6">
      <Text accessibilityRole="header" className="mb-4 text-center font-display text-title text-ink">
        {card.name}
      </Text>
      <CardTextView text={card.text} tone="paper" />
    </ScrollView>
  );
}

export function CardPreview({
  card,
  related = [],
  onClose,
  onDetails = null,
  ownsBack = true,
  closeRef,
}: {
  card: PreviewCard;
  // The cards attached to it and its face-up shadow cards, each shown in its place on a tap.
  related?: readonly PreviewCard[];
  onClose: () => void;
  // The hardware Back closes the preview here (a list's preview) unless the screen routes Back itself (the table's layers,
  // back.ts) and calls the animated close through `closeRef`.
  ownsBack?: boolean;
  closeRef?: { current: (() => void) | null };
  onDetails?: ((code: string) => void) | null;
}) {
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = useMotionScale();
  const t = useTableTokens();
  const s = useUiScale();
  const progress = useSharedValue(scale === 0 ? 1 : 0);
  const all = [card, ...related];
  const [at, setAt] = useState(0);
  const shown = all[at] ?? card;
  const wide = screen.width > screen.height;
  const roomW = screen.width - insets.left - insets.right;
  const roomH = screen.height - insets.top - insets.bottom;
  // A card turned a quarter turn (the Heading card) is drawn in a sideways frame, and its picture turned in it.
  const sideways = (shown.landscape ?? false) !== (((shown.turn ?? 0) % 180 + 180) % 180 === 90);
  // Upright, the cards with it are a strip under the card (user request, 2026-11-02: a quest card's side B was out of reach on a phone);
  // the card gives up the strip's height.
  const strip = !wide && all.length > 1 ? touch(s, 44) + 16 * s : 0;
  const size = wide ? previewSideSize(roomW, roomH, sideways, s) : previewSize(screen.width, roomH - strip, sideways, s);

  useEffect(() => {
    if (scale > 0) progress.set(withSpring(1, springConfig(MOTION.previewIn, scale)));
  }, [progress, scale]);

  const close = useCallback(() => {
    if (scale === 0) {
      onClose();
      return;
    }
    progress.set(
      withTiming(0, timing(MOTION.previewOut, scale), (finished) => {
        if (finished) scheduleOnRN(onClose);
      }),
    );
  }, [progress, scale, onClose]);

  useEffect(() => {
    if (!ownsBack) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close, ownsBack]);
  useEffect(() => {
    if (!closeRef) return;
    closeRef.current = close;
    return () => {
      closeRef.current = null;
    };
  }, [close, closeRef]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.get())) * SCRIM }));
  const cardStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: Math.min(1, Math.max(0, p * 1.4)), transform: [{ translateY: (1 - p) * 28 * s }, { scale: 0.82 + 0.18 * p }] };
  });
  const buttonsStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.get())) }));

  const frame = (
    <Animated.View style={[{ width: size.width, height: size.height, borderRadius: shown.source ? 0 : cardCorner(size.width, size.height), overflow: "hidden", backgroundColor: shown.source ? "transparent" : t.paper }, cardStyle]}>
      <PreviewPicture card={shown} width={size.width} height={size.height} imageKey={`${shown.code}:${at}`} />
    </Animated.View>
  );
  const buttons = onDetails && shown.lostIsland !== true ? (
    <SecondaryButton
      label="Details"
      testID="card-preview-details"
      accessibilityLabel={`Open ${shown.name}`}
      onPress={() => {
        onClose();
        onDetails(shown.code);
      }}
    />
  ) : null;

  return (
    <View testID="card-preview" accessibilityViewIsModal onAccessibilityEscape={close} style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.night }, scrimStyle]} />
      <Pressable
        testID="card-preview-scrim"
        accessibilityLabel="Close the preview"
        onPress={close}
        style={[StyleSheet.absoluteFill, wide ? styles.row : styles.column, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left + 16 * s, paddingRight: insets.right + 16 * s }]}
      >
        {frame}
        {wide ? (
          <Animated.View style={[{ flex: 1, maxWidth: 360 * s, marginLeft: 20 * s, maxHeight: size.height }, buttonsStyle]}>
            {/* Not a control of its own: a tap here reaches the scrim and closes the preview too; only Details and the rows of what is
                with the card do something else (user request, 2026-10-29). */}
            <View style={{ flexShrink: 1 }}>
              <Text testID="card-preview-name" accessibilityRole="header" className="font-display text-title text-bone">
                {shown.title ?? shown.name}
              </Text>
              {shown.detail ? <Text testID="card-preview-detail" className="text-label text-muted">{shown.detail}</Text> : null}
              {shown.role ? <Text className="text-label text-muted">{shown.role}</Text> : null}
              <ScrollView style={{ flexShrink: 1 }} className="mt-2">
                {shown.note ? (
                  <View testID="card-preview-why" className="mb-2">
                    <Text className="font-display text-eyebrow uppercase text-accent">{shown.noteTitle ?? "Not playable now"}</Text>
                    <Text className="mt-1 text-body text-bone">{shown.note}</Text>
                  </View>
                ) : null}
                {shown.notApplied ? (
                  <View className="mb-2">
                    <NotAppliedView notApplied={shown.notApplied} testID="card-preview-not-applied" />
                  </View>
                ) : null}
                {(shown.steps ?? []).length > 0 ? (
                  <View testID="card-preview-steps" className="mb-2">
                    <Text className="font-display text-eyebrow uppercase text-accent">The four steps</Text>
                    {(shown.steps ?? []).map((row) => (
                      <Text key={row.text} accessibilityState={{ selected: row.current }} className={`mt-1 text-label ${row.current ? "text-accent" : "text-bone"}`}>
                        {row.current ? `Now · ${row.text}` : row.text}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {(shown.effects ?? []).length > 0 ? (
                  <View testID="card-preview-effects" className="mb-2">
                    <Text className="font-display text-eyebrow uppercase text-accent">Effects on it</Text>
                    {(shown.effects ?? []).map((line) => (
                      <Text key={line} className="mt-1 text-label text-bone">
                        {line}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {all.length > 1 ? (
                  <View testID="card-preview-attached">
                    <Text className="font-display text-eyebrow uppercase text-accent">{at === 0 ? "With it" : "The card and what is with it"}</Text>
                    {all.map((item, index) => (
                      <Pressable
                        key={`${item.code}:${index}`}
                        testID={`card-preview-related-${index}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: index === at }}
                        onPress={() => setAt(index)}
                      >
                        {/* Layout and fill are styles, not classes: a class on a Pressable with a style function can be dropped on the phone. */}
                        {({ pressed }) => (
                          <View
                            className="mt-1 flex-row items-center gap-2 rounded-item px-2"
                            style={{ minHeight: touch(s, 44), backgroundColor: pressed ? t.pressed : index === at ? t.raised : "transparent" }}
                          >
                            <View style={{ width: 24 * s, height: 34 * s, borderRadius: cardCorner(24 * s, 34 * s), overflow: "hidden", backgroundColor: t.raised }}>
                              {item.source ? <Image source={item.source} cachePolicy={cachePolicyFor(item.source)} recyclingKey={`${item.code}:${index}:thumb`} contentFit="cover" style={{ width: 24 * s, height: 34 * s }} /> : null}
                            </View>
                            <View className="shrink">
                              <Text numberOfLines={1} className="text-body text-bone">
                                {item.name}
                              </Text>
                              {item.role ? <Text className="text-label text-muted">{item.role}</Text> : null}
                            </View>
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </ScrollView>
              {buttons ? <View className="mt-2 flex-row gap-3">{buttons}</View> : null}
            </View>
          </Animated.View>
        ) : (
          <>
            {all.length > 1 ? (
              <Animated.View testID="card-preview-attached" style={[{ marginTop: 16 * s, maxWidth: roomW - 32 * s }, buttonsStyle]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 * s }}>
                  {all.map((item, index) => (
                    <Pressable
                      key={`${item.code}:${index}`}
                      testID={`card-preview-related-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel={item.role ? `${item.name}, ${item.role}` : item.name}
                      accessibilityState={{ selected: index === at }}
                      onPress={() => setAt(index)}
                    >
                      {({ pressed }) => (
                        <View
                          className="flex-row items-center gap-2 rounded-item px-2"
                          style={{ minHeight: touch(s, 44), backgroundColor: pressed ? t.pressed : index === at ? t.raised : "transparent" }}
                        >
                          <View style={{ width: 24 * s, height: 34 * s, borderRadius: cardCorner(24 * s, 34 * s), overflow: "hidden", backgroundColor: t.raised }}>
                            {item.source ? <Image source={item.source} cachePolicy={cachePolicyFor(item.source)} recyclingKey={`${item.code}:${index}:thumb`} contentFit="cover" style={{ width: 24 * s, height: 34 * s }} /> : null}
                          </View>
                          <Text numberOfLines={1} className="text-label text-bone">
                            {item.role ?? item.name}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </Animated.View>
            ) : null}
            {buttons ? <Animated.View style={[{ flexDirection: "row", gap: 12 * s, marginTop: 16 * s }, buttonsStyle]}>{buttons}</Animated.View> : null}
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  column: { alignItems: "center", justifyContent: "center" },
});
