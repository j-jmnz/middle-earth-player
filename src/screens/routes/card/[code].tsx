import { eq } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { cards } from "../../../catalog/schema";
import { BackButton, BodyText, Screen, ScreenTitle } from "../../chrome";
import { useDatabases } from "../../databases";
import { enqueueImageDownloads } from "../../images/queue";
import { imageLayoutSize, ringsdbImageUrl, shownCardImage } from "../../images/policy";
import { InspectCardImage } from "../../images/picture";
import { routeCode } from "../../route-code";
import { scanAssets } from "../../images/scan-map";
import { useCachedImage } from "../../images/store";

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
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const code = routeCode(params.code);
  const { catalog } = useDatabases();
  const { width: windowWidth } = useWindowDimensions();
  const row = useMemo(() => {
    if (!code) return undefined;
    return catalog
      .select({ code: cards.code, name: cards.name, errata: cards.errata, imagesrc: cards.imagesrc })
      .from(cards)
      .where(eq(cards.code, code))
      .get();
  }, [catalog, code]);
  const cached = useCachedImage(code ?? "");
  const bundled = code ? (scanAssets[code] ?? null) : null;
  const { resolved, source } = shownCardImage({
    cached,
    imagesrc: row?.imagesrc ?? null,
    bundled,
  });
  const remotePreview = !source && row?.imagesrc ? ringsdbImageUrl(row.imagesrc) : null;
  const previewSource = source ?? (remotePreview ? { uri: remotePreview } : null);
  const pixels =
    resolved.kind === "file" || resolved.kind === "asset"
      ? imageLayoutSize(resolved.width, resolved.height, Math.max(0, windowWidth - 48))
      : remotePreview
        ? imageLayoutSize(423, 600, Math.max(0, windowWidth - 48))
        : null;

  useEffect(() => {
    if (!code || !row?.imagesrc) return;
    enqueueImageDownloads([{ code, imagesrc: row.imagesrc, first: true }]);
  }, [code, row?.imagesrc]);

  if (!code) throw new Error("Missing route code");

  return (
    <Screen>
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-4">
        {row ? (
          <>
            <ScreenTitle>{row.name ?? row.code}</ScreenTitle>
            {row.name ? <Text className="mt-2 text-label text-muted">{row.code}</Text> : null}
          </>
        ) : (
          <>
            <ScreenTitle>Card</ScreenTitle>
            <BodyText className="mt-6">{`Card ${code} is not in the catalog.`}</BodyText>
          </>
        )}
        {row?.errata ? (
          <>
            <Text className="mt-6 text-label text-heading">Errata</Text>
            <BodyText className="mt-2">{row.errata}</BodyText>
          </>
        ) : null}
        {previewSource && pixels ? (
          <View
            className="mt-4 self-center overflow-hidden"
            style={{ width: pixels.width, height: pixels.height }}
          >
            <Zoomable width={pixels.width} height={pixels.height}>
              <InspectCardImage code={code} source={previewSource} width={pixels.width} height={pixels.height} />
            </Zoomable>
          </View>
        ) : null}
      </ScrollView>
      <BackButton testID="back" onPress={() => router.back()} />
    </Screen>
  );
}
