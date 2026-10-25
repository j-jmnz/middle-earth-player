// A long press on a card: the card large over the dimmed screen, so its text reads at a glance without leaving the table
// or the list. It grows in on a spring and shrinks back on close; reduced motion snaps both. A tap anywhere, Close or
// Android Back closes it; Details opens the card screen.
import { Image } from "expo-image";
import { useCallback, useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { CardTextView } from "./card-text-view.tsx";
import { previewSize } from "./preview-size.ts";
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
};

export function CardPreview({ card, onClose, onDetails = null }: { card: PreviewCard; onClose: () => void; onDetails?: (() => void) | null }) {
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const size = previewSize(screen.width, screen.height - insets.top - insets.bottom, card.landscape ?? false);

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

  return (
    <View testID="card-preview" accessibilityViewIsModal style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.night }, scrimStyle]} />
      <Pressable testID="card-preview-scrim" accessibilityLabel="Close the preview" onPress={close} style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View style={[{ width: size.width, height: size.height, borderRadius: 16, overflow: "hidden", backgroundColor: card.source ? "transparent" : t.paper }, cardStyle]}>
          {card.source ? (
            <Image source={card.source} recyclingKey={card.code} contentFit="contain" accessibilityLabel={card.name} style={{ width: size.width, height: size.height }} />
          ) : (
            <View className="flex-1 px-5 py-6">
              <Text accessibilityRole="header" className="mb-4 text-center font-display text-title text-ink">
                {card.name}
              </Text>
              <CardTextView text={card.text} tone="paper" />
            </View>
          )}
        </Animated.View>
        <Animated.View style={[{ flexDirection: "row", gap: 12, marginTop: 16 }, buttonsStyle]}>
          {onDetails ? (
            <ChromeButton
              label="Details"
              testID="card-preview-details"
              tone="gold"
              accessibilityLabel={`Open ${card.name}`}
              onPress={() => {
                onClose();
                onDetails();
              }}
            />
          ) : null}
          <ChromeButton label="Close" testID="card-preview-close" onPress={close} />
        </Animated.View>
      </Pressable>
    </View>
  );
}
