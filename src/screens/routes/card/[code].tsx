import { eq } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { activeCardCodes } from "../../../catalog/active-text";
import { cards, effects } from "../../../catalog/schema";
import { BodyText, Eyebrow, Label, NavBar, Screen, ScreenTitle, SphereMark, markedSphere, sphereWord } from "../../chrome";
import { useDatabases } from "../../databases";
import { enqueueImageDownloads } from "../../images/queue";
import { imageLayoutSize, ringsdbImageUrl, shownCardImage } from "../../images/policy";
import { InspectCardImage } from "../../images/picture";
import { palette } from "../../palette.js";
import { routeCode } from "../../route-code";
import { scanAssets } from "../../images/scan-map";
import { useCachedImage } from "../../images/store";

function CardFacts({
  row,
  inactive,
}: {
  row: {
    typeCode: string;
    typeName: string;
    sphereCode: string | null;
    sphereName: string | null;
    cost: string | null;
    threat: number | null;
    willpower: number | null;
    attack: number | null;
    defense: number | null;
    health: number | null;
    traits: string | null;
    text: string | null;
  };
  inactive: boolean;
}) {
  const sphere = sphereWord(row.sphereName);
  const mark = markedSphere(row.sphereCode);
  const cost = costOrThreat(row);
  return (
    <View className="mt-6">
      <Stat label="Type" value={row.typeName} />
      <View className="mt-3">
        <Label>Sphere</Label>
        <View className="mt-1 flex-row items-center gap-2">
          {mark ? <SphereMark sphere={mark} /> : null}
          <BodyText>{sphere}</BodyText>
        </View>
      </View>
      {cost ? <Stat label={cost.label} value={cost.value} /> : null}
      {row.willpower != null ? <Stat label="Willpower" value={String(row.willpower)} /> : null}
      {row.attack != null ? <Stat label="Attack" value={String(row.attack)} /> : null}
      {row.defense != null ? <Stat label="Defense" value={String(row.defense)} /> : null}
      {row.health != null ? <Stat label="Health" value={String(row.health)} /> : null}
      {row.traits ? <Stat label="Traits" value={row.traits} /> : null}
      <View className="mt-3">
        {row.text ? <BodyText>{row.text}</BodyText> : null}
        {inactive ? (
          <View testID="card-inactive" className={row.text ? "mt-2" : undefined}>
            <Label tone="muted">Inactive</Label>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-3">
      <Label>{label}</Label>
      <BodyText>{value}</BodyText>
    </View>
  );
}

function costOrThreat(row: {
  typeCode: string;
  cost: string | null;
  threat: number | null;
}): { label: "Cost" | "Threat"; value: string } | null {
  if (row.typeCode === "hero") {
    if (row.threat != null) return { label: "Threat", value: String(row.threat) };
    if (row.cost) return { label: "Cost", value: row.cost };
    return null;
  }
  if (row.cost && row.cost.length > 0) return { label: "Cost", value: row.cost };
  if (row.threat != null) return { label: "Threat", value: String(row.threat) };
  return null;
}

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

// The picture is the hero of this screen: centered, lifted off the night by a gold halo.
const halo = {
  shadowColor: palette.gold,
  shadowOpacity: 0.25,
  shadowRadius: 40,
  shadowOffset: { width: 0, height: 0 },
  elevation: 12,
};

export default function CardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const code = routeCode(params.code);
  const { catalog } = useDatabases();
  const { width: windowWidth } = useWindowDimensions();
  const row = useMemo(() => {
    if (!code) return undefined;
    return catalog
      .select({
        code: cards.code,
        name: cards.name,
        typeCode: cards.typeCode,
        typeName: cards.typeName,
        sphereCode: cards.sphereCode,
        sphereName: cards.sphereName,
        cost: cards.cost,
        threat: cards.threat,
        willpower: cards.willpower,
        attack: cards.attack,
        defense: cards.defense,
        health: cards.health,
        traits: cards.traits,
        text: cards.text,
        errata: cards.errata,
        imagesrc: cards.imagesrc,
      })
      .from(cards)
      .where(eq(cards.code, code))
      .get();
  }, [catalog, code]);
  const active = useMemo(
    () => activeCardCodes(catalog.select({ record: effects.record }).from(effects).all().map((entry) => entry.record)),
    [catalog],
  );
  const cached = useCachedImage(code ?? "");
  const bundled = code ? (scanAssets[code] ?? null) : null;
  const { resolved, source } = shownCardImage({
    cached,
    imagesrc: row?.imagesrc ?? null,
    bundled,
  });
  const remotePreview = !source && row?.imagesrc ? ringsdbImageUrl(row.imagesrc) : null;
  const previewSource = source ?? (remotePreview ? { uri: remotePreview } : null);
  const maxWidth = Math.max(0, Math.min(windowWidth - 96, 300));
  const pixels =
    resolved.kind === "file" || resolved.kind === "asset"
      ? imageLayoutSize(resolved.width, resolved.height, maxWidth)
      : remotePreview
        ? imageLayoutSize(423, 600, maxWidth)
        : null;

  useEffect(() => {
    if (!code || !row?.imagesrc) return;
    enqueueImageDownloads([{ code, imagesrc: row.imagesrc, first: true }]);
  }, [code, row?.imagesrc]);

  if (!code) throw new Error("Missing route code");

  return (
    <Screen scene="plain">
      <NavBar
        backTestID="back"
        onBack={() => router.back()}
        right={row?.name ? <Text className="text-label text-faint">{row.code}</Text> : undefined}
      />
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-8 pt-4">
        {previewSource && pixels ? (
          <View className="self-center rounded-card" style={[{ width: pixels.width, height: pixels.height }, halo]}>
            <View className="overflow-hidden rounded-card" style={{ width: pixels.width, height: pixels.height }}>
              <Zoomable width={pixels.width} height={pixels.height}>
                <InspectCardImage code={code} source={previewSource} width={pixels.width} height={pixels.height} />
              </Zoomable>
            </View>
          </View>
        ) : null}
        <View className="mt-8 items-center">
          {row ? (
            <ScreenTitle size="title">{row.name ?? row.code}</ScreenTitle>
          ) : (
            <>
              <ScreenTitle>Card</ScreenTitle>
              <BodyText className="mt-6 text-center">{`Card ${code} is not in the catalog.`}</BodyText>
            </>
          )}
        </View>
        {row ? <CardFacts row={row} inactive={!active.has(row.code)} /> : null}
        {row?.errata ? (
          <View className="mt-8 border-t border-hairline pt-5">
            <Eyebrow>Errata</Eyebrow>
            <BodyText className="mt-2">{row.errata}</BodyText>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
