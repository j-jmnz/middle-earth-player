import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { BodyText, Chip, Eyebrow, NavBar, Screen, ScreenScroll, ScreenTitle, TwoPane } from "../../chrome";
import { CardFacts, CardName, CardPicture, DeckUse, useCardPicture, useCardRow } from "../../card-detail";
import { pictureMaxWidth, type PicturePane } from "../../card-picture";
import { cachePolicyFor } from "../../../play/image-cache";
import { CardTextView } from "../../../play/card-text-view";
import { sideText } from "../../../play/ledger";
import { nightFade } from "../../../play/surfaces";
import { useTableTokens } from "../../../play/use-table-tokens";
import { routeCode } from "../../route-code";
import { useArtGround } from "../../art";
import { goBack } from "../../go-back";
import { useUiScale } from "../../../play/ui-scale";
import { useSizeClass } from "../../../play/use-size-class";

function clampPan(value: number, size: number, nextScale: number): number {
  "worklet";
  const limit = ((nextScale - 1) * size) / 2;
  return Math.min(limit, Math.max(-limit, value));
}

function Zoomable({ children, width, height }: { children: ReactNode; width: number; height: number }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = Math.min(4, Math.max(1, savedScale.value * event.scale));
      scale.value = next;
      translateX.value = clampPan(translateX.value, width, next);
      translateY.value = clampPan(translateY.value, height, next);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });
  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_event, state) => {
      if (scale.value > 1) state.activate();
      else state.fail();
    })
    .onUpdate((event) => {
      translateX.value = clampPan(savedX.value + event.translationX, width, scale.value);
      translateY.value = clampPan(savedY.value + event.translationY, height, scale.value);
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
      <Animated.View style={[{ width, height }, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}

export default function CardScreen() {
  const t = useTableTokens();
  const art = useArtGround();
  const s = useUiScale();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; side?: string }>();
  const code = routeCode(params.code);
  // `side=B`: a card with an Upgraded side (the Spend XP rows) also shows that side's printed lines, read from the printed-text ledger.
  const upgraded = code != null && routeCode(params.side) === "B" ? sideText(code, "B") : null;
  const { size, width: windowWidth } = useSizeClass();
  const insets = useSafeAreaInsets();
  // Expanded: the picture has a pane of its own, measured, and is sized by its height.
  const [pane, setPane] = useState<PicturePane | null>(null);
  const row = useCardRow(code);
  const { preview: previewSource, intrinsic } = useCardPicture(code, row?.imagesrc ?? null);
  // A quest card is printed sideways.
  const maxWidth = pictureMaxWidth(size, windowWidth, s, pane, intrinsic != null && intrinsic.height < intrinsic.width);

  if (!code) throw new Error("Missing route code");

  const picture =
    row && previewSource && intrinsic && maxWidth != null ? (
      <CardPicture row={row} preview={previewSource} intrinsic={intrinsic} width={maxWidth} wrap={(image, box) => <Zoomable width={box.width} height={box.height}>{image}</Zoomable>} />
    ) : null;
  const details = row ? (
    <>
      <CardName row={row} />
      <CardFacts row={row} />
      {upgraded ? (
        <View testID="card-upgraded-side" className="mt-5">
          <Eyebrow tone="accent">Upgraded side</Eyebrow>
          <View className="mt-2">
            <CardTextView text={upgraded} />
          </View>
        </View>
      ) : null}
      <DeckUse code={row.code} />
    </>
  ) : (
    <View className="items-center">
      <ScreenTitle>Card</ScreenTitle>
      <BodyText className="mt-6 text-center">{`Card ${code} is not in the catalog.`}</BodyText>
    </View>
  );

  return (
    <Screen
      scene="calm"
      art={
        // The card's own picture, blurred and darkened, as the light behind it: each card sets its own mood. Drawn once, on the
        // scene's art layer, where Light can multiply it onto the ground.
        previewSource ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height: 560 * s, ...art.blend }]}>
            <Image source={previewSource} cachePolicy={cachePolicyFor(previewSource)} contentFit="cover" blurRadius={30} accessible={false} style={{ width: "100%", height: 560 * s, opacity: 0.4 }} />
            <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...nightFade(0.1, 1, art.ground, t) }} />
          </View>
        ) : undefined
      }
    >
      <NavBar
        backTestID="back"
        onBack={() => goBack(router, "/cards")}
        right={row?.name ? <Chip label={row.code} tone="faint" /> : undefined}
      />
      {size === "expanded" && row && previewSource ? (
        <TwoPane
          kind="supporting"
          side="end"
          range={{ min: 360, max: 560 }}
          testID="card-panes"
          start={
            <View
              testID="card-picture-pane"
              className="min-h-0 flex-1 items-center justify-center"
              style={{ paddingBottom: insets.bottom }}
              onLayout={(event: LayoutChangeEvent) => {
                const { width, height: outer } = event.nativeEvent.layout;
                const height = outer - insets.bottom;
                setPane((current) => (current && current.width === width && current.height === height ? current : { width, height }));
              }}
            >
              {picture}
            </View>
          }
          end={
            <ScreenScroll top={0}>
              {details}
              <View className="pb-safe" />
            </ScreenScroll>
          }
        />
      ) : (
        <ScreenScroll top={16} max="readable">
          {picture}
          <View className="mt-6" />
          {details}
          <View className="pb-safe" />
        </ScreenScroll>
      )}
    </Screen>
  );
}
