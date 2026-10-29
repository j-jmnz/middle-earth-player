// The deck's sphere donut on a phone (docs/design-system.md, Deck builder): one arc per sphere, its share of the deck's cards, drawn
// with Skia; the web draws the same with CSS (sphere-donut.tsx). The count sits in the middle.
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useMemo, type ReactNode } from "react";
import { View } from "react-native";

export type DonutPart = { key: string; share: number; color: string };

export function SphereDonut({ size, parts, track, children }: { size: number; parts: readonly DonutPart[]; track: string; children?: ReactNode }) {
  const stroke = Math.max(5, size * 0.12);
  const paths = useMemo(() => {
    const r = (size - stroke) / 2;
    const rect = Skia.XYWHRect(stroke / 2, stroke / 2, r * 2, r * 2);
    let at = -90;
    return parts.map((part) => {
      const sweep = part.share * 360;
      const path = Skia.PathBuilder.Make().arcToOval(rect, at, Math.max(0.01, sweep - (parts.length > 1 ? 2 : 0)), true).build();
      at += sweep;
      return { key: part.key, path, color: part.color };
    });
  }, [parts, size, stroke]);
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
