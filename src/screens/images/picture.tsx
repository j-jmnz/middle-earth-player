import { Image } from "expo-image";

const rowStyle = { width: 32, height: 44 };

export function RowCardImage({ code, source }: { code: string; source: { uri: string } | number }) {
  return <Image recyclingKey={code} contentFit="contain" source={source} style={rowStyle} />;
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
