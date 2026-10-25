import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { markedSphere, pressedNight, RingMark, sphereWord, SphereMark } from "./chrome";
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
          className="absolute right-1 top-1 min-h-11 min-w-11 items-center justify-center"
        >
          {({ pressed }) => (
            <View className={`rounded-pill px-2.5 py-1 ${pressed ? "bg-pressed" : "bg-night"}`}>
              <Text className="text-label text-bone">Remove</Text>
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyHeroSlot({
  height,
  label = "Hero",
  onPress,
  testID,
}: {
  height: number;
  label?: string;
  // An empty slot the player can fill (the deck editor's hero slots) is a button: "+ Add hero".
  onPress?: () => void;
  testID?: string;
}) {
  const frame = { height, borderWidth: 1, borderStyle: "dashed" as const, borderColor: palette.gold };
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`Add ${label.toLowerCase()}`}
        onPress={onPress}
        className="flex-1 overflow-hidden rounded-tile"
        style={frame}
      >
        {({ pressed }) => (
          <View className="flex-1 items-center justify-center" style={pressed ? pressedNight : undefined}>
            <Text className="font-display text-title text-gold">+</Text>
            <Text className="font-display text-body text-gold">{`Add ${label.toLowerCase()}`}</Text>
          </View>
        )}
      </Pressable>
    );
  }
  return (
    <View testID={testID} className="flex-1 items-center justify-center rounded-tile" style={frame}>
      <Text className="font-display text-body text-muted">{label}</Text>
    </View>
  );
}

/**
 * A saved deck in the deck list: the hero pictures side by side, fading into night, then the name, the counts and
 * whether it is ready to play. `children` is the row of actions under it while the list is managed.
 */
export function DeckCover({
  name,
  heroes,
  detail,
  status,
  height,
  onPress,
  onLongPress,
  testID,
  children,
}: {
  name: string;
  heroes: readonly HeroFace[];
  detail: string;
  status: { ready: boolean; text: string };
  height: number;
  onPress: () => void;
  onLongPress?: () => void;
  testID: string;
  children?: ReactNode;
}) {
  return (
    <View className="overflow-hidden rounded-card border border-hairline bg-raised">
      <Pressable
        testID={testID}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${detail}, ${status.text}`}
        accessibilityHint="Opens the deck"
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => (pressed ? pressedNight : undefined)}
      >
        <View className="flex-row" style={{ height }}>
          {heroes.length > 0 ? (
            heroes.map((hero) => <HeroTile key={hero.code} hero={hero} height={height} flush dense />)
          ) : (
            <View className="flex-1 items-center justify-center bg-dusk">
              <Text className="text-label text-faint">No heroes yet</Text>
            </View>
          )}
        </View>
        <View className="px-4 pb-3 pt-2">
          <Text className="font-display text-title text-bone" numberOfLines={2}>
            {name}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2">
            <Text className="text-label text-muted">{detail}</Text>
            <View className="flex-row items-center gap-1.5">
              <RingMark size={10} state={status.ready ? "done" : "locked"} />
              <Text testID={`${testID}-status`} className={`text-label ${status.ready ? "text-gold" : "text-danger"}`}>
                {status.text}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
      {children ? <View className="border-t border-hairline px-1">{children}</View> : null}
    </View>
  );
}
