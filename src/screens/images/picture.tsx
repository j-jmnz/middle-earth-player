import { Image, type ImageContentPosition } from "expo-image";
import { View } from "react-native";

import { ringsdbImageUrl, shownCardImage } from "./policy";
import { scanAssets } from "./scan-map";
import { useCachedImage } from "./store";

const focusTop: ImageContentPosition = "top";

export function useCardPreview(code: string, imagesrc: string | null): { uri: string } | number | null {
  const cached = useCachedImage(code);
  const { source } = shownCardImage({
    cached,
    imagesrc,
    bundled: scanAssets[code] ?? null,
  });
  if (source) return source;
  if (!imagesrc) return null;
  const remote = ringsdbImageUrl(imagesrc);
  return remote ? { uri: remote } : null;
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
  return (
    <Image
      recyclingKey={code}
      contentFit="contain"
      accessible={false}
      source={source}
      style={{ width, height }}
    />
  );
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
  const preview = useCardPreview(code, imagesrc);
  return (
    <View className="overflow-hidden rounded bg-raised" style={{ width, height }}>
      {preview ? <RowCardImage code={code} source={preview} width={width} height={height} /> : null}
    </View>
  );
}
