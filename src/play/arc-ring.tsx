// A ring of arcs on the web (the deck's sphere donut, the table's threat dial): a conic gradient cut to a ring by a radial mask, the
// same shares as the Skia one on a phone (arc-ring.native.tsx). react-native-web forwards these CSS properties to the DOM.
import type { ReactNode } from "react";
import { View } from "react-native";

export type ArcPart = { key: string; share: number; color: string };

export function ArcRing({ size, parts, track, stroke: given, gap = 2, children }: { size: number; parts: readonly ArcPart[]; track: string; stroke?: number; gap?: number; children?: ReactNode }) {
  const stroke = given ?? Math.max(5, size * 0.12);
  let at = 0;
  void gap;
  const stops = parts.map((part) => {
    const from = at;
    at += part.share * 100;
    return `${part.color} ${from}% ${at}%`;
  });
  const fill = stops.length > 0 ? `conic-gradient(${[...stops, `${track} ${at}% 100%`].join(", ")})` : `conic-gradient(${track} 0 100%)`;
  const inner = size / 2 - stroke;
  const mask = `radial-gradient(circle, transparent ${inner}px, #000 ${inner + 0.5}px)`;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundImage: fill, maskImage: mask, WebkitMaskImage: mask } as object} />
      {children}
    </View>
  );
}
