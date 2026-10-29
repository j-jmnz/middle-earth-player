// A ring of arcs on the web (the deck's sphere donut, the table's threat dial): a conic gradient cut to a ring by a radial mask, the
// same shares as the Skia one on a phone (arc-ring.native.tsx). react-native-web forwards these CSS properties to the DOM.
import type { ReactNode } from "react";
import { View } from "react-native";

import { arcSpans, type ArcPart } from "./arc-spans.ts";

export type { ArcPart };

export function ArcRing({ size, parts, track, stroke: given, gap = 2, children }: { size: number; parts: readonly ArcPart[]; track: string; stroke?: number; gap?: number; children?: ReactNode }) {
  const stroke = given ?? Math.max(5, size * 0.12);
  // The web's arcs meet without the gap the Skia ones leave between them.
  void gap;
  const spans = arcSpans(parts);
  const end = (spans[spans.length - 1]?.to ?? 0) * 100;
  const stops = spans.map((span) => `${span.color} ${span.from * 100}% ${span.to * 100}%`);
  const fill = `conic-gradient(${[...stops, `${track} ${end}% 100%`].join(", ")})`;
  const inner = size / 2 - stroke;
  const mask = `radial-gradient(circle, transparent ${inner}px, #000 ${inner + 0.5}px)`;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundImage: fill, maskImage: mask, WebkitMaskImage: mask } as object} />
      {children}
    </View>
  );
}
