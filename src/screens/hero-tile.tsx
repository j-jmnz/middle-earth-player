import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { markedSphere, pressedNight, sphereWord, SphereMark } from "./chrome";
import { enqueueImageDownloads } from "./images/queue";
import { CoverCardImage, useCardPreview } from "./images/picture";
import { palette } from "./palette.js";

export type HeroFace = {
  code: string;
  name: string;
  sphereCode: string | null;
  sphereName: string | null;
  imagesrc: string | null;
};

export function HeroTile({
  hero,
  height,
  onRemove,
  flush = false,
  dense = false,
}: {
  hero: HeroFace;
  height: number;
  onRemove?: () => void;
  flush?: boolean;
  dense?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const preview = useCardPreview(hero.code, hero.imagesrc);
  const sphere = sphereWord(hero.sphereName);
  const mark = markedSphere(hero.sphereCode);
  useEffect(() => {
    if (!hero.imagesrc) return;
    enqueueImageDownloads([{ code: hero.code, imagesrc: hero.imagesrc }]);
  }, [hero.code, hero.imagesrc]);

  return (
    <View
      className={`flex-1 overflow-hidden bg-raised ${flush ? "" : "rounded-tile"}`}
      style={{ height }}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setWidth((current) => (current === next ? current : next));
      }}
    >
      {preview && width > 0 ? (
        <CoverCardImage code={hero.code} source={preview} width={width} height={height} />
      ) : null}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: height / 3,
          backgroundColor: palette.night,
        }}
      />
      <View
        pointerEvents="none"
        className="justify-end px-2 pb-2"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height / 3 }}
      >
        <Text className={dense ? "font-display text-label text-bone" : "font-display text-body text-bone"} numberOfLines={1}>
          {hero.name}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1">
          {mark ? <SphereMark sphere={mark} /> : null}
          <Text className="text-label text-bone" numberOfLines={1}>
            {sphere}
          </Text>
        </View>
        {hero.sphereCode === "fellowship" ? (
          <Text testID={`saga-only-${hero.code}`} className="text-label text-gold">
            Saga only
          </Text>
        ) : null}
      </View>
      {onRemove ? (
        <Pressable
          testID={`hero-remove-${hero.code}`}
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${hero.name}`}
          onPress={onRemove}
          className="absolute right-1 top-1 min-h-11 min-w-11 items-center justify-center rounded-tile px-2"
          style={({ pressed }) => (pressed ? pressedNight : undefined)}
        >
          <Text className="text-label text-bone">Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyHeroSlot({ height, label = "Hero" }: { height: number; label?: string }) {
  return (
    <View
      className="flex-1 items-center justify-center rounded-tile"
      style={{ height, borderWidth: 1, borderStyle: "dashed", borderColor: palette.gold }}
    >
      <Text className="font-display text-body text-muted">{label}</Text>
    </View>
  );
}

export function DeckCover({
  name,
  heroes,
  height,
  onPress,
  testID,
}: {
  name: string;
  heroes: readonly HeroFace[];
  height: number;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      onPress={onPress}
      className="overflow-hidden rounded-card bg-raised"
      style={({ pressed }) => (pressed ? pressedNight : undefined)}
    >
      <View className="flex-row" style={{ height }}>
        {heroes.map((hero) => (
          <HeroTile key={hero.code} hero={hero} height={height} flush dense />
        ))}
      </View>
      <View pointerEvents="none" className="absolute left-0 right-0 top-0 px-3 pt-3">
        <Text className="font-display text-title text-bone" numberOfLines={2}>
          {name}
        </Text>
      </View>
    </Pressable>
  );
}
