// A ring of arcs on a phone (the deck's sphere donut, the table's threat dial; docs/design-system.md): one arc per part, its share of
// the ring from the top, clockwise, on a track, drawn with Skia; the web draws the same with CSS (arc-ring.tsx). `children` sit in
// the middle.
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useMemo, type ReactNode } from "react";
import { View } from "react-native";

import { arcSpans, type ArcPart } from "./arc-spans.ts";

export type { ArcPart };

export function ArcRing({ size, parts, track, stroke: given, gap = 2, children }: { size: number; parts: readonly ArcPart[]; track: string; stroke?: number; gap?: number; children?: ReactNode }) {
  const stroke = given ?? Math.max(5, size * 0.12);
  const paths = useMemo(() => {
    const r = (size - stroke) / 2;
    const rect = Skia.XYWHRect(stroke / 2, stroke / 2, r * 2, r * 2);
    return arcSpans(parts).map((span) => {
      const sweep = (span.to - span.from) * 360;
      const path = Skia.PathBuilder.Make().arcToOval(rect, -90 + span.from * 360, Math.max(0.01, sweep - (parts.length > 1 ? gap : 0)), true).build();
      return { key: span.key, path, color: span.color };
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
