import { Image, type ImageContentPosition } from "expo-image";
import { useMemo } from "react";
import { View } from "react-native";

import { cardCorner } from "../../play/card-corner";
import { CardImage } from "../../play/card-image";

import { cardImageUrl, shownCardImage } from "./policy";
import { scanAssets } from "./scan-map";
import { useCachedImage } from "./store";

const focusTop: ImageContentPosition = "top";

// The same source object until the card's file changes: expo-image reloads on a new source, and a list re-renders its rows often.
export function useCardPreview(code: string, imagesrc: string | null): { uri: string } | number | null {
  const cached = useCachedImage(code);
  return useMemo(() => {
    const { source } = shownCardImage({
      cached,
      imagesrc,
      bundled: scanAssets[code] ?? null,
    });
    if (source) return source;
    if (!imagesrc) return null;
    const remote = cardImageUrl(imagesrc);
    return remote ? { uri: remote } : null;
  }, [code, imagesrc, cached]);
}

export function RowCardImage({
  code,
  source,
  width = 32,
  height = 44,
}: {
  code: string;
  source: { uri: string } | number;
  width?: number;
  height?: number;
}) {
  // Kept decoded in memory as well: a list scrolled back shows its pictures again without reading and decoding the files. Its corners
  // are rounded like the card screen's picture, on the picture itself.
  return <CardImage recyclingKey={code} cachePolicy="memory-disk" source={source} width={width} height={height} />;
}

export function InspectCardImage({
  code,
  source,
  width,
  height,
}: {
  code: string;
  source: { uri: string } | number;
  width: number;
  height: number;
}) {
  return <Image recyclingKey={code} contentFit="contain" source={source} style={{ width, height }} />;
}

export function CoverCardImage({
  code,
  source,
  width,
  height,
}: {
  code: string;
  source: { uri: string } | number;
  width: number;
  height: number;
}) {
  return (
    <Image
      recyclingKey={code}
      contentFit="cover"
      contentPosition={focusTop}
      accessible={false}
      source={source}
      style={{ width, height }}
    />
  );
}

export function CardThumb({
  code,
  imagesrc,
  width,
  height,
}: {
  code: string;
  imagesrc: string | null;
  width: number;
  height: number;
}) {
  return <CardThumbFrame code={code} source={useCardPreview(code, imagesrc)} width={width} height={height} />;
}

/** A CardThumb for a row that already holds the card's picture (useCardPreview), so the image store is read once. */
export function CardThumbFrame({
  code,
  source,
  width,
  height,
}: {
  code: string;
  source: { uri: string } | number | null;
  width: number;
  height: number;
}) {
  return (
    <View className="overflow-hidden bg-raised" style={{ width, height, borderRadius: cardCorner(width, height) }}>
      {source ? <RowCardImage code={code} source={source} width={width} height={height} /> : null}
    </View>
  );
}
