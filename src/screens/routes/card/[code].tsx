import { eq } from "drizzle-orm";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { cards } from "../../../catalog/schema";
import { BodyText, Chip, Eyebrow, NavBar, Panel, Screen, ScreenTitle, sphereWord } from "../../chrome";
import { nightFade, panelSurface, raisedEdge } from "../../../play/surfaces";
import { CardTextView } from "../../../play/card-text-view";
import { traitLine } from "../../../play/card-text";
import { GameIcon } from "../../../play/game-icon";
import { notApplied, type NotApplied } from "../../../play/not-applied";
import { NotAppliedView } from "../../../play/not-applied-view";
import { SPHERE_TINT, sphereIcon, typeIcon, type IconName } from "../../../play/icon-map";
import { useDatabases } from "../../databases";
import { enqueueImageDownloads } from "../../images/queue";
import { cardImageUrl, imageLayoutSize, shownCardImage } from "../../images/policy";
import { InspectCardImage } from "../../images/picture";
import { palette } from "../../palette.js";
import { routeCode } from "../../route-code";
import { scanAssets } from "../../images/scan-map";
import { useCachedImage } from "../../images/store";
import { goBack } from "../../go-back";

type FactsRow = {
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
  questPoints: number | null;
  engagementCost: number | null;
  isUnique: boolean;
  traits: string | null;
  text: string | null;
};

// Type and sphere in one centered line under the name, each with its printed icon; then the traits as printed, the numbers
// as a row of tiles (icon and value, the word under them), and the text on a raised panel: one paragraph per ability, the
// timing words bold, the icons inline, flavor italic and muted.
function CardFacts({ row, unapplied }: { row: FactsRow; unapplied: NotApplied | null }) {
  const sphereMark = sphereIcon(row.sphereCode);
  const type = typeIcon(row.typeCode);
  // Player cards always name a sphere (Neutral when the catalog has none); encounter cards print none.
  const sphere = row.sphereName || type ? sphereWord(row.sphereName) : null;
  const traits = traitLine(row.traits);
  const cost = costOrThreat(row);
  const stats: { label: string; value: string; icon: IconName }[] = [
    ...(cost ? [{ label: cost.label, value: cost.value, icon: cost.label === "Cost" ? ("cost" as const) : ("threat" as const) }] : []),
    ...(row.willpower != null ? [{ label: "Willpower", value: String(row.willpower), icon: "willpower" as const }] : []),
    ...(row.attack != null ? [{ label: "Attack", value: String(row.attack), icon: "attack" as const }] : []),
    ...(row.defense != null ? [{ label: "Defense", value: String(row.defense), icon: "defense" as const }] : []),
    ...(row.health != null ? [{ label: "Hit points", value: String(row.health), icon: "hitPoints" as const }] : []),
    ...(row.engagementCost != null ? [{ label: "Engagement cost", value: String(row.engagementCost), icon: "engagementCost" as const }] : []),
    ...(row.questPoints != null ? [{ label: "Quest points", value: String(row.questPoints), icon: "questPoints" as const }] : []),
  ];
  return (
    <View>
      <View testID="card-kind" className="mt-2 flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <View className="flex-row items-center gap-1.5">
          {type ? <GameIcon name={type} size={16} tint="muted" /> : null}
          <Text className="text-body text-muted">{row.typeName}</Text>
        </View>
        {sphere ? (
          <View className="flex-row items-center gap-1.5">
            {sphereMark ? <GameIcon name={sphereMark} size={16} tint={SPHERE_TINT[row.sphereCode ?? ""] ?? "faint"} /> : null}
            <Text className="text-body text-muted">{sphere}</Text>
          </View>
        ) : null}
        {row.isUnique ? (
          <View className="flex-row items-center gap-1.5">
            <GameIcon name="unique" size={16} tint="gold" />
            <Text className="text-body text-muted">Unique</Text>
          </View>
        ) : null}
      </View>
      {traits ? (
        <Text testID="card-traits" className="mt-2 text-center text-body font-semibold italic text-gold">
          {traits}
        </Text>
      ) : null}
      {stats.length > 0 ? (
        <View testID="card-stats" className="mt-6 flex-row flex-wrap justify-center gap-2">
          {stats.map((stat) => (
            <Stat key={stat.label} {...stat} />
          ))}
        </View>
      ) : null}
      {row.text || unapplied ? (
        <View className="mt-6">
          <Panel>
          <CardTextView text={row.text} testID="card-text" />
          {/* The lines no effect record reads, and what the card still does without them. */}
          {unapplied ? (
            <View className={row.text ? "mt-3 border-t border-hairline pt-3" : undefined}>
              <NotAppliedView notApplied={unapplied} />
            </View>
          ) : null}
          </Panel>
        </View>
      ) : null}
    </View>
  );
}

// A number with the game's icon beside it, the word under them. The word stays on screen and in the label.
function Stat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <View accessible accessibilityLabel={`${label} ${value}`} className="min-w-20 items-center rounded-tile px-3 py-2" style={{ ...panelSurface(), borderWidth: 1, borderColor: palette.hairline, boxShadow: raisedEdge }}>
      <View className="flex-row items-center gap-1.5">
        <GameIcon name={icon} size={18} tint="bone" />
        <Text className="font-display-bold text-title text-bone">{value}</Text>
      </View>
      <Text className="mt-0.5 text-label text-muted">{label}</Text>
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
        questPoints: cards.quest,
        engagementCost: cards.engagementCost,
        isUnique: cards.isUnique,
        traits: cards.traits,
        text: cards.text,
        errata: cards.errata,
        imagesrc: cards.imagesrc,
      })
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
  const remotePreview = !source && row?.imagesrc ? cardImageUrl(row.imagesrc) : null;
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
      {/* The card's own picture, blurred and darkened, as the light behind it: each card sets its own mood. Drawn once, behind. */}
      {previewSource ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height: 520 }]}>
          <Image source={previewSource} contentFit="cover" blurRadius={28} accessible={false} style={{ width: "100%", height: 520, opacity: 0.45 }} />
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...nightFade(0.15, 1) }} />
        </View>
      ) : null}
      <NavBar
        backTestID="back"
        onBack={() => goBack(router, "/cards")}
        right={row?.name ? <Chip label={row.code} tone="faint" /> : undefined}
      />
      <ScrollView className="min-h-0 flex-1" style={{ marginHorizontal: -8 }} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 32, paddingTop: 16 }}>
        {previewSource && pixels ? (
          <View className="self-center rounded-card" style={[{ width: pixels.width, height: pixels.height }, halo]}>
            <View className="overflow-hidden rounded-card" style={{ width: pixels.width, height: pixels.height }}>
              <Zoomable width={pixels.width} height={pixels.height}>
                <InspectCardImage code={code} source={previewSource} width={pixels.width} height={pixels.height} />
              </Zoomable>
            </View>
          </View>
        ) : null}
        <View className="mt-6 items-center">
          {row ? (
            <ScreenTitle size="title">{row.name ?? row.code}</ScreenTitle>
          ) : (
            <>
              <ScreenTitle>Card</ScreenTitle>
              <BodyText className="mt-6 text-center">{`Card ${code} is not in the catalog.`}</BodyText>
            </>
          )}
        </View>
        {row ? <CardFacts row={row} unapplied={notApplied(row.code, row.typeCode, row.errata ?? row.text)} /> : null}
        {row?.errata ? (
          <View className="mt-6">
            <Panel current>
              <Eyebrow>Errata</Eyebrow>
              <View className="mt-2">
                <CardTextView text={row.errata} />
              </View>
            </Panel>
          </View>
        ) : null}
        <View className="pb-safe" />
      </ScrollView>
    </Screen>
  );
}
