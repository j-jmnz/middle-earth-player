// A ring of arcs on a phone (the deck's sphere donut, the table's threat dial; docs/design-system.md): one arc per part, its share of
// the ring from the top, clockwise, on a track, drawn with Skia; the web draws the same with CSS (arc-ring.tsx). `children` sit in
// the middle.
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useMemo, type ReactNode } from "react";
import { View } from "react-native";

export type ArcPart = { key: string; share: number; color: string };

export function ArcRing({ size, parts, track, stroke: given, gap = 2, children }: { size: number; parts: readonly ArcPart[]; track: string; stroke?: number; gap?: number; children?: ReactNode }) {
  const stroke = given ?? Math.max(5, size * 0.12);
  const paths = useMemo(() => {
    const r = (size - stroke) / 2;
    const rect = Skia.XYWHRect(stroke / 2, stroke / 2, r * 2, r * 2);
    let at = -90;
    return parts.map((part) => {
      const sweep = part.share * 360;
      const path = Skia.PathBuilder.Make().arcToOval(rect, at, Math.max(0.01, sweep - (parts.length > 1 ? gap : 0)), true).build();
      at += sweep;
      return { key: part.key, path, color: part.color };
    });
  }, [parts, size, stroke, gap]);
  const ring = useMemo(() => {
    const r = (size - stroke) / 2;
    return Skia.PathBuilder.Make().addOval(Skia.XYWHRect(stroke / 2, stroke / 2, r * 2, r * 2)).build();
  }, [size, stroke]);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Canvas style={{ position: "absolute", width: size, height: size }}>
        <Path path={ring} style="stroke" strokeWidth={stroke} color={track} />
        {paths.map((arc) => (
          <Path key={arc.key} path={arc.path} style="stroke" strokeWidth={stroke} color={arc.color} />
        ))}
      </Canvas>
      {children}
    </View>
  );
}
