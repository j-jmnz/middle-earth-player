// A long press on a card: the card large over the dimmed screen, so its text reads at a glance without leaving the table
// or the list. It grows in on a spring and shrinks back on close; reduced motion snaps both. A tap on the dimmed screen,
// Close or Android Back closes it; Details opens the card screen.
//
// On a wide screen (the table, in landscape) the card stands at the left and a column at its right names it, says what
// effects are on it now (+1 Attack from Dagger of Westernesse) and lists the cards attached to it and its shadow cards: a
// tap on one shows that card in its place.
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { CardTextView } from "./card-text-view.tsx";
import { previewSideSize, previewSize } from "./preview-size.ts";
import { ChromeButton } from "./sheet-paper.tsx";
import type { PictureSource } from "./table-canvas-types.ts";
import { tableTokens as t } from "./tokens.ts";

const SCRIM = 0.82;

export type PreviewCard = {
  code: string;
  name: string;
  // The scan, or null while it is not on the phone: the name and text are shown on paper instead.
  source: PictureSource | null;
  // Quest cards are printed sideways.
  landscape?: boolean;
  text?: string | null;
  // The effects on the card now, in words, when it is on the table.
  effects?: readonly string[];
  // How it sits with the first card: "Attachment", "Shadow card".
  role?: string;
};

function Picture({ card, width, height }: { card: PreviewCard; width: number; height: number }) {
  return card.source ? (
    <Image source={card.source} recyclingKey={card.code} contentFit="contain" accessibilityLabel={card.name} style={{ width, height }} />
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
}: {
  card: PreviewCard;
  // The cards attached to it and its face-up shadow cards, each shown in its place on a tap.
  related?: readonly PreviewCard[];
  onClose: () => void;
  onDetails?: ((code: string) => void) | null;
}) {
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const all = [card, ...related];
  const [at, setAt] = useState(0);
  const shown = all[at] ?? card;
  const wide = screen.width > screen.height;
  const roomW = screen.width - insets.left - insets.right;
  const roomH = screen.height - insets.top - insets.bottom;
  const size = wide ? previewSideSize(roomW, roomH, shown.landscape ?? false) : previewSize(screen.width, roomH, shown.landscape ?? false);

  useEffect(() => {
    if (!reduceMotion) progress.set(withSpring(1, { damping: 20, stiffness: 260, mass: 0.7 }));
  }, [progress, reduceMotion]);

  const close = useCallback(() => {
    if (reduceMotion) {
      onClose();
      return;
    }
    progress.set(
      withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(onClose);
      }),
    );
  }, [progress, reduceMotion, onClose]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.get())) * SCRIM }));
  const cardStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: Math.min(1, Math.max(0, p * 1.4)), transform: [{ translateY: (1 - p) * 28 }, { scale: 0.82 + 0.18 * p }] };
  });
  const buttonsStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.get())) }));

  const frame = (
    <Animated.View style={[{ width: size.width, height: size.height, borderRadius: 16, overflow: "hidden", backgroundColor: shown.source ? "transparent" : t.paper }, cardStyle]}>
      <Picture card={shown} width={size.width} height={size.height} />
    </Animated.View>
  );
  const buttons = (
    <>
      {onDetails ? (
        <ChromeButton
          label="Details"
          testID="card-preview-details"
          tone="gold"
          accessibilityLabel={`Open ${shown.name}`}
          onPress={() => {
            onClose();
            onDetails(shown.code);
          }}
        />
      ) : null}
      <ChromeButton label="Close" testID="card-preview-close" onPress={close} />
    </>
  );

  return (
    <View testID="card-preview" accessibilityViewIsModal style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.night }, scrimStyle]} />
      <Pressable
        testID="card-preview-scrim"
        accessibilityLabel="Close the preview"
        onPress={close}
        style={[StyleSheet.absoluteFill, wide ? styles.row : styles.column, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}
      >
        {frame}
        {wide ? (
          <Animated.View style={[{ flex: 1, maxWidth: 360, marginLeft: 20, maxHeight: size.height }, buttonsStyle]}>
            {/* The column is not a scrim: a tap here does not close the preview. */}
            <Pressable accessible={false} onPress={() => undefined} style={{ flexShrink: 1 }}>
              <Text testID="card-preview-name" accessibilityRole="header" className="font-display text-title text-bone">
                {shown.name}
              </Text>
              {shown.role ? <Text className="text-label text-muted">{shown.role}</Text> : null}
              <ScrollView style={{ flexShrink: 1 }} className="mt-2">
                {(shown.effects ?? []).length > 0 ? (
                  <View testID="card-preview-effects" className="mb-2">
                    <Text className="font-display text-eyebrow uppercase text-gold">Effects on it</Text>
                    {(shown.effects ?? []).map((line) => (
                      <Text key={line} className="mt-1 text-label text-bone">
                        {line}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {all.length > 1 ? (
                  <View testID="card-preview-attached">
                    <Text className="font-display text-eyebrow uppercase text-gold">{at === 0 ? "With it" : "The card and what is with it"}</Text>
                    {all.map((item, index) => (
                      <Pressable
                        key={`${item.code}:${index}`}
                        testID={`card-preview-related-${index}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: index === at }}
                        onPress={() => setAt(index)}
                        className="mt-1 min-h-11 flex-row items-center gap-2 rounded-tile px-2"
                        style={({ pressed }) => ({ backgroundColor: pressed ? t.pressed : index === at ? t.raised : "transparent", borderWidth: 1, borderColor: index === at ? t.goldLine : t.hairline })}
                      >
                        <View style={{ width: 24, height: 34, borderRadius: 3, overflow: "hidden", backgroundColor: t.raised }}>
                          {item.source ? <Image source={item.source} recyclingKey={`${item.code}:thumb`} contentFit="cover" style={{ width: 24, height: 34 }} /> : null}
                        </View>
                        <View className="shrink">
                          <Text numberOfLines={1} className="text-body text-bone">
                            {item.name}
                          </Text>
                          {item.role ? <Text className="text-label text-muted">{item.role}</Text> : null}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </ScrollView>
              <View className="mt-2 flex-row gap-3">{buttons}</View>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View style={[{ flexDirection: "row", gap: 12, marginTop: 16 }, buttonsStyle]}>{buttons}</Animated.View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  column: { alignItems: "center", justifyContent: "center" },
});
