import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { markedSphere, pressedNight, RingMark, sphereWord, SphereMark } from "./chrome";
import { enqueueImageDownloads } from "./images/queue";
import { CardThumb, CoverCardImage, useCardPreview } from "./images/picture";
import type { PictureSource } from "../play/table-canvas-types";
import { palette } from "./palette.js";

export type HeroFace = {
  code: string;
  name: string;
  sphereCode: string | null;
  sphereName: string | null;
  imagesrc: string | null;
};

/** The face of a hero the catalog lacks: its code (or a name the caller knows), with no sphere and no picture. */
export function heroFace(faces: ReadonlyMap<string, HeroFace>, code: string, name: string = code): HeroFace {
  return faces.get(code) ?? { code, name, sphereCode: null, sphereName: null, imagesrc: null };
}

export function HeroTile({
  hero,
  height,
  onRemove,
  onPress,
  onLongPress,
  flush = false,
  dense = false,
  bare = false,
}: {
  hero: HeroFace;
  height: number;
  onRemove?: () => void;
  // The deck editor opens the hero's card on a tap and previews it on a long press, as it does a card row.
  onPress?: () => void;
  onLongPress?: (source: PictureSource | null) => void;
  flush?: boolean;
  dense?: boolean;
  // The picture alone, with no name band: the deck list's covers, where the deck's own name is the only text.
  bare?: boolean;
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
      {bare ? null : (
        <>
          {/* The night band holds the name first; it grows past a third of the tile rather than lose the name. */}
          <View
            pointerEvents="none"
            className="justify-end px-2 pb-2 pt-1"
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, minHeight: height / 3, backgroundColor: palette.night }}
          >
            <Text className={dense ? "font-display text-label text-bone" : "font-display text-body text-bone"} numberOfLines={dense ? 1 : 2}>
              {hero.name}
            </Text>
            <View className="mt-0.5 flex-row flex-wrap items-center gap-x-1">
              {mark ? <SphereMark sphere={mark} /> : null}
              <Text className="text-label text-bone" numberOfLines={1}>
                {sphere}
              </Text>
              {hero.sphereCode === "fellowship" ? (
                <Text testID={`saga-only-${hero.code}`} className="text-label text-gold" numberOfLines={1}>
                  Saga only
                </Text>
              ) : null}
            </View>
          </View>
        </>
      )}
      {onPress ? (
        <Pressable
          testID={`hero-${hero.code}`}
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={`${hero.name}, ${sphere}`}
          accessibilityHint="Opens the card"
          onPress={onPress}
          onLongPress={onLongPress ? () => onLongPress(preview) : undefined}
          delayLongPress={350}
          style={({ pressed }) => ({ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: pressed ? 0.25 : 0, backgroundColor: palette.night })}
        />
      ) : null}
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
        className="w-full overflow-hidden rounded-tile"
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
    <View testID={testID} className="w-full items-center justify-center rounded-tile" style={frame}>
      <Text className="font-display text-body text-muted">{label}</Text>
    </View>
  );
}

type DeckSummary = {
  name: string;
  heroes: readonly HeroFace[];
  // "3 heroes · 47 of 50 cards".
  detail: string;
  status: { ready: boolean; text: string };
  onPress: () => void;
  onLongPress?: () => void;
  testID: string;
  // The row of actions under the deck while the list is managed.
  children?: ReactNode;
};

function heroNames(heroes: readonly HeroFace[]): string {
  return heroes.length > 0 ? heroes.map((hero) => hero.name).join(", ") : "No heroes yet";
}

function StatusLine({ testID, detail, status }: { testID: string; detail: string; status: DeckSummary["status"] }) {
  return (
    <View className="mt-1 flex-row flex-wrap items-center gap-x-2">
      <Text className="text-label text-muted">{detail}</Text>
      <View className="flex-row items-center gap-1.5">
        <RingMark size={10} state={status.ready ? "done" : "locked"} />
        <Text testID={`${testID}-status`} className={`text-label ${status.ready ? "text-gold" : "text-danger"}`}>
          {status.text}
        </Text>
      </View>
    </View>
  );
}

/**
 * A saved deck in the deck list's Cards view: the hero pictures side by side with no words on them, then a solid strip
 * with the deck's name, its heroes, the counts and whether it is ready to play.
 */
export function DeckCover({ name, heroes, detail, status, height, onPress, onLongPress, testID, children }: DeckSummary & { height: number }) {
  return (
    <View className="overflow-hidden rounded-card border border-hairline bg-raised">
      <Pressable
        testID={testID}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${heroNames(heroes)}, ${detail}, ${status.text}`}
        accessibilityHint="Opens the deck"
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => (pressed ? pressedNight : undefined)}
      >
        <View className="flex-row" style={{ height }}>
          {heroes.length > 0 ? (
            heroes.map((hero) => <HeroTile key={hero.code} hero={hero} height={height} flush bare />)
          ) : (
            <View className="flex-1 items-center justify-center bg-dusk">
              <Text className="text-label text-faint">No heroes yet</Text>
            </View>
          )}
        </View>
        <View className="border-t border-goldLine px-4 pb-3 pt-2">
          <Text className="font-display text-title text-bone" numberOfLines={2}>
            {name}
          </Text>
          <Text className="text-label text-bone" numberOfLines={1}>
            {heroNames(heroes)}
          </Text>
          <StatusLine testID={testID} detail={detail} status={status} />
        </View>
      </Pressable>
      {children ? <View className="border-t border-hairline px-1">{children}</View> : null}
    </View>
  );
}

const rowThumb = { width: 30, height: 42 };

/** A saved deck in the deck list's List view: the heroes as small pictures, the name, the counts and the readiness. */
export function DeckRow({ name, heroes, detail, status, onPress, onLongPress, testID, children }: DeckSummary) {
  return (
    <View className="border-b border-hairline">
      <Pressable
        testID={testID}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${heroNames(heroes)}, ${detail}, ${status.text}`}
        accessibilityHint="Opens the deck"
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        className="min-h-16 flex-row items-center gap-3 py-2"
        style={({ pressed }) => (pressed ? pressedNight : undefined)}
      >
        <View className="flex-row" style={{ width: rowThumb.width * 3 - 16 }}>
          {heroes.length > 0 ? (
            heroes.slice(0, 3).map((hero, at) => (
              <View key={hero.code} style={{ marginLeft: at === 0 ? 0 : -8 }} className="overflow-hidden rounded-sm border border-night">
                <CardThumb code={hero.code} imagesrc={hero.imagesrc} width={rowThumb.width} height={rowThumb.height} />
              </View>
            ))
          ) : (
            <View className="items-center justify-center rounded-sm bg-dusk" style={rowThumb}>
              <Text className="text-label text-faint">—</Text>
            </View>
          )}
        </View>
        <View className="flex-1">
          <Text className="font-display text-body text-bone" numberOfLines={1}>
            {name}
          </Text>
          <StatusLine testID={testID} detail={detail} status={status} />
        </View>
        <Text className="text-body text-faint">›</Text>
      </Pressable>
      {children}
    </View>
  );
}
